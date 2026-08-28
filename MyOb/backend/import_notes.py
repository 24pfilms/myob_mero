import argparse
import json
import os
import time
from database import SessionLocal, Note
from ai import get_embedding
from app import scan_vault
from security import RequestContext, run_with_request_context

def import_all_notes(owner_id):
    """Scans all notes from the vault, generates embeddings, and saves to the DB."""
    db = SessionLocal(owner_id=owner_id)
    notes_from_vault = list(scan_vault())
    total_notes = len(notes_from_vault)
    
    print(f"Found {total_notes} notes in the vault.")
    print("Starting import and embedding generation. This may take a while...")
    
    for i, note_data in enumerate(notes_from_vault):
        print(f"Processing ({i+1}/{total_notes}): {note_data['title']}")
        
        try:
            # Check if note already exists
            db_note = db.query(Note).filter(Note.id == note_data['id']).first()
            
            # Generate embedding
            embedding = get_embedding(f"{note_data['title']}\n{note_data['content']}")
            
            if db_note:
                # Update existing note
                db_note.title = note_data['title']
                db_note.content = note_data['content']
                db_note.tags = note_data['tags']
                db_note.embedding = json.dumps(embedding)
            else:
                # Create new note
                db_note = Note(
                    id=note_data['id'],
                    title=note_data['title'],
                    content=note_data['content'],
                    tags=note_data['tags'],
                    embedding=json.dumps(embedding)
                )
                db.add(db_note)
            
            db.commit()
            
            # Rate limiting for the embeddings API
            time.sleep(1.1) # Stay under 60 requests per minute
            
        except Exception as e:
            print(f"  !! ERROR processing {note_data['title']}: {e}")
            db.rollback()
            continue
    
    db.close()
    print("\nImport complete! Database is up to date.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Import configured vault notes for one Mero owner')
    parser.add_argument('--owner', required=True, help='Version 4 Mero user UUID')
    args = parser.parse_args()
    context = RequestContext(args.owner, 'cli-import-notes', os.getenv('OPENROUTER_API_KEY'))
    run_with_request_context(context, lambda: import_all_notes(args.owner))