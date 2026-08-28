import json
import time
import random
from sqlalchemy.orm import sessionmaker
from database import engine, Note
from ai import get_embedding
from app import scan_vault

Session = sessionmaker(bind=engine)

def test_import_notes(sample_size=50):
    """Scans a random sample of notes from the vault, generates embeddings, and saves to the DB."""
    db = Session()
    notes_from_vault = list(scan_vault())
    total_notes = len(notes_from_vault)
    
    if total_notes == 0:
        print("No notes found in the vault!")
        return
    
    # Select random sample
    sample_size = min(sample_size, total_notes)
    sample_notes = random.sample(notes_from_vault, sample_size)
    
    print(f"Found {total_notes} total notes in the vault.")
    print(f"Processing random sample of {sample_size} notes for testing...")
    print("This is a test run - not all notes will be imported.")
    print("-" * 60)
    
    successful_imports = 0
    failed_imports = 0
    
    for i, note_data in enumerate(sample_notes):
        print(f"Processing ({i+1}/{sample_size}): {note_data['title']}")
        
        try:
            # Check if note already exists
            db_note = db.query(Note).filter(Note.id == note_data['id']).first()
            
            # Generate embedding
            print(f"  → Generating embedding...")
            embedding = get_embedding(f"{note_data['title']}\n{note_data['content']}")
            
            if db_note:
                # Update existing note
                print(f"  → Updating existing note in database")
                db_note.title = note_data['title']
                db_note.content = note_data['content']
                db_note.tags = note_data['tags']
                db_note.embedding = json.dumps(embedding)
            else:
                # Create new note
                print(f"  → Adding new note to database")
                db_note = Note(
                    id=note_data['id'],
                    title=note_data['title'],
                    content=note_data['content'],
                    tags=note_data['tags'],
                    embedding=json.dumps(embedding)
                )
                db.add(db_note)
            
            db.commit()
            successful_imports += 1
            print(f"  ✓ Success!")
            
            # Rate limiting for the embeddings API
            time.sleep(1.1)  # Stay under 60 requests per minute
            
        except Exception as e:
            print(f"  ✗ ERROR processing {note_data['title']}: {e}")
            db.rollback()
            failed_imports += 1
            continue
    
    db.close()
    print("\n" + "=" * 60)
    print("TEST IMPORT COMPLETE!")
    print(f"Successfully processed: {successful_imports} notes")
    print(f"Failed to process: {failed_imports} notes")
    print(f"Total notes in vault: {total_notes}")
    print(f"Remaining notes for full import: {total_notes - successful_imports}")
    print("=" * 60)

if __name__ == '__main__':
    test_import_notes(50)