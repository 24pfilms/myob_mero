"""
Import notes from an Obsidian vault into the standalone database.

This is an OPTIONAL tool for users who want to migrate their existing
Obsidian notes into MyOb. Once imported, notes are stored in the database
and no longer require the Obsidian vault.

Usage:
    python import_obsidian.py [vault_path]

If vault_path is not provided, uses VAULT_PATH from config.py
"""

import sys
import os
import json
import time
import argparse
import frontmatter
from pathlib import Path
from datetime import datetime
# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, Note
from ai import get_embedding
from config import VAULT_PATH, validate_vault_path
from security import RequestContext, run_with_request_context

def scan_vault_files(vault_path):
    """Generator function to read all markdown files from the vault."""
    vault_path = Path(vault_path)
    
    if not vault_path.exists():
        raise Exception(f"Vault path does not exist: {vault_path}")
    
    if not vault_path.is_dir():
        raise Exception(f"Vault path is not a directory: {vault_path}")
    
    markdown_files = list(vault_path.rglob('*.md'))
    
    # Filter out .obsidian folder
    markdown_files = [f for f in markdown_files if '.obsidian' not in str(f)]
    
    for file_path in markdown_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                post = frontmatter.load(f)
                rel_path = str(file_path.relative_to(vault_path))
                yield {
                    'id': rel_path,
                    'title': post.get('title') or file_path.stem,
                    'content': post.content,
                    'tags': post.get('tags', []),
                    'path': str(file_path)
                }
        except Exception as e:
            print(f"  ⚠️  Error reading {file_path}: {e}")
            continue

def import_from_vault(owner_id, vault_path=None, rate_limit=True):
    """Import all notes from an Obsidian vault into the database."""
    # Use provided vault_path or fall back to config
    if vault_path is None:
        vault_path = validate_vault_path()
        if vault_path is None:
            raise Exception(
                "No vault path provided and VAULT_PATH in config.py is not set.\\n"
                "Usage: python import_obsidian.py [vault_path]"
            )
    else:
        vault_path = Path(vault_path)
        if not vault_path.exists() or not vault_path.is_dir():
            raise Exception(f"Invalid vault path: {vault_path}")
    
    print("=" * 70)
    print("OBSIDIAN VAULT IMPORT")
    print("=" * 70)
    print(f"📂 Vault location: {vault_path}")
    print()
    
    db = SessionLocal(owner_id=owner_id)
    notes_from_vault = list(scan_vault_files(vault_path))
    total_notes = len(notes_from_vault)
    
    if total_notes == 0:
        print("❌ No markdown files found in vault.")
        print("   Make sure the path points to your Obsidian vault directory.")
        return
    
    print(f"✅ Found {total_notes} markdown files in vault")
    print()
    print("🔧 Starting import...")
    print("   - Generating AI embeddings for semantic search")
    print("   - This may take 30-60 minutes for 1000+ notes")
    if rate_limit:
        print("   - Rate limiting: ~1 note per second (to respect API limits)")
    print()
    
    imported_count = 0
    updated_count = 0
    error_count = 0
    
    for i, note_data in enumerate(notes_from_vault, 1):
        print(f"[{i}/{total_notes}] {note_data['title'][:50]}...", end=" ")
        
        try:
            # Check if note already exists
            db_note = db.query(Note).filter(Note.id == note_data['id']).first()
            
            # Generate embedding
            embedding_text = f"{note_data['title']}\\n{note_data['content']}"
            try:
                embedding = get_embedding(embedding_text)
                embedding_json = json.dumps(embedding)
            except Exception as e:
                print(f"⚠️  (embedding failed: {e})")
                embedding_json = None
            
            if db_note:
                # Update existing note
                db_note.title = note_data['title']
                db_note.content = note_data['content']
                db_note.tags = note_data['tags']
                db_note.embedding = embedding_json
                db_note.updated_at = datetime.utcnow()
                print("✓ updated")
                updated_count += 1
            else:
                # Create new note
                db_note = Note(
                    id=note_data['id'],
                    title=note_data['title'],
                    content=note_data['content'],
                    tags=note_data['tags'],
                    embedding=embedding_json,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                db.add(db_note)
                print("✓ imported")
                imported_count += 1
            
            db.commit()
            
            # Rate limiting for the embeddings API (if enabled)
            if rate_limit and embedding_json:
                time.sleep(1.1)  # Stay under 60 requests per minute
            
        except Exception as e:
            print(f"✗ ERROR: {e}")
            db.rollback()
            error_count += 1
            continue
    
    db.close()
    
    print()
    print("=" * 70)
    print("✅ IMPORT COMPLETED")
    print("=" * 70)
    print(f"📊 Statistics:")
    print(f"   - New notes imported: {imported_count}")
    print(f"   - Existing notes updated: {updated_count}")
    print(f"   - Errors: {error_count}")
    print(f"   - Total processed: {imported_count + updated_count}")
    print()
    print("📝 Your notes are now in the database and ready to use!")
    print("   You can start the backend server with: python runner.py")
    print()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Import notes from an Obsidian vault into MyOb database'
    )
    parser.add_argument(
        'vault_path',
        nargs='?',
        help='Path to your Obsidian vault directory (optional if set in config.py)'
    )
    parser.add_argument('--owner', required=True, help='Version 4 Mero user UUID')
    parser.add_argument(
        '--no-rate-limit',
        action='store_true',
        help='Disable rate limiting (use if you have unlimited API access)'
    )
    
    args = parser.parse_args()
    
    try:
        context = RequestContext(args.owner, 'cli-import-obsidian', os.getenv('OPENROUTER_API_KEY'))
        run_with_request_context(context, lambda: import_from_vault(
            owner_id=args.owner,
            vault_path=args.vault_path,
            rate_limit=not args.no_rate_limit
        ))
    except Exception as e:
        print()
        print(f"❌ IMPORT FAILED: {e}")
        print()
        sys.exit(1)
