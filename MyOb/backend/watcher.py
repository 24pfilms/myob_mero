from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import time
import json
import logging
from pathlib import Path
from database import SessionLocal, Note, Folder
from ai import get_embedding
from config import VAULT_PATH
import frontmatter
from datetime import datetime

# Setup logging to file and console
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(message)s',
    handlers=[
        logging.FileHandler("vault_watcher.log"),
        logging.StreamHandler()
    ]
)

class VaultChangeHandler(FileSystemEventHandler):
    def __init__(self):
        self.files_cache = {}

    def on_any_event(self, event):
        # Handle directory events
        if event.is_directory:
            if event.event_type in ('created', 'moved'):
                self.process_folder_change(event.src_path, event.event_type)
            return
        
        # Handle file events
        if event.src_path.endswith('.md') and event.event_type in ('created', 'modified'):
            self.process_file_change(event.src_path)

    def process_file_change(self, file_path_str):
        file_path = Path(file_path_str)
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            if self.files_cache.get(str(file_path)) == content:
                return # Skip if content is identical

            self.files_cache[str(file_path)] = content
            post = frontmatter.loads(content)
            note_id = str(file_path.relative_to(VAULT_PATH))

            logging.info(f"Change detected in: {note_id}. Updating embedding.")
            embedding = get_embedding(f"{post.get('title') or file_path.stem}\n{post.content}")
            
            db = SessionLocal()
            db_note = db.query(Note).filter_by(id=note_id).first()
            if db_note:
                db_note.title = post.get('title') or file_path.stem
                db_note.content = post.content
                db_note.tags = post.get('tags', [])
                db_note.embedding = json.dumps(embedding)
            else:
                db_note = Note(
                    id=note_id,
                    title=post.get('title') or file_path.stem,
                    content=post.content,
                    tags=post.get('tags', []),
                    embedding=json.dumps(embedding)
                )
                db.add(db_note)
            
            db.commit()
            logging.info(f"Successfully updated: {note_id}")

        except FileNotFoundError:
            logging.warning(f"File not found during processing: {file_path}")
        except Exception as e:
            logging.error(f"Error processing {file_path}: {e}")
    def process_folder_change(self, folder_path_str, event_type):
        """Process folder creation or movement."""
        folder_path = Path(folder_path_str)
        try:
            folder_id = str(folder_path.relative_to(VAULT_PATH))
            folder_name = folder_path.name
            parent_id = str(folder_path.parent.relative_to(VAULT_PATH)) if folder_path.parent != Path(VAULT_PATH) else None
            
            logging.info(f"Folder {event_type}: {folder_id}")
            
            db = SessionLocal()
            
            # Check if folder already exists
            existing_folder = db.query(Folder).filter_by(id=folder_id).first()
            
            if not existing_folder:
                # Create new folder
                new_folder = Folder(
                    id=folder_id,
                    name=folder_name,
                    parent_id=parent_id,
                    created_at=datetime.now().isoformat()
                )
                db.add(new_folder)
                db.commit()
                logging.info(f"Successfully created folder in DB: {folder_id}")
            
        except Exception as e:
            logging.error(f"Error processing folder {folder_path}: {e}")
            if 'db' in locals() and db:
                db.rollback()
        finally:
            if 'db' in locals() and db:
                db.close()

def start_watching():
    """Starts the file system observer."""
    event_handler = VaultChangeHandler()
    observer = Observer()
    observer.schedule(event_handler, VAULT_PATH, recursive=True)
    observer.start()
    logging.info(f"Started watching vault at {VAULT_PATH}")
    try:
        while True:
            time.sleep(5)
    except KeyboardInterrupt:
        observer.stop()
        logging.info("Observer stopped.")
    observer.join()

if __name__ == '__main__':
    start_watching()