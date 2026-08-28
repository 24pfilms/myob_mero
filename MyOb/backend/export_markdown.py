"""
Export notes from the database to markdown files.

This allows you to:
- Back up your notes as plain markdown files
- Export notes to use in other apps (Obsidian, Notion, etc.)
- Maintain portability - your notes aren't locked in the database

Usage:
    python export_markdown.py [output_directory]

If output_directory is not provided, creates an 'exported_notes' folder
"""

import sys
import os
import argparse
from pathlib import Path
from datetime import datetime
# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, Note, Folder

def sanitize_filename(filename):
    """Remove or replace characters that are invalid in filenames."""
    invalid_chars = '<>:"/\\|?*'
    for char in invalid_chars:
        filename = filename.replace(char, '_')
    return filename

def export_notes(owner_id, output_dir=None):
    """Export all notes from database to markdown files."""
    # Default output directory
    if output_dir is None:
        output_dir = Path.cwd() / "exported_notes"
    else:
        output_dir = Path(output_dir)
    
    print("=" * 70)
    print("EXPORT NOTES TO MARKDOWN")
    print("=" * 70)
    print(f"📂 Export location: {output_dir}")
    print()
    
    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    
    db = SessionLocal(owner_id=owner_id)
    
    # Get all notes
    notes = db.query(Note).order_by(Note.created_at).all()
    total_notes = len(notes)
    
    if total_notes == 0:
        print("❌ No notes found in database.")
        print("   Create some notes first or import from Obsidian.")
        return
    
    print(f"✅ Found {total_notes} notes in database")
    print()
    print("🔧 Starting export...")
    print()
    
    exported_count = 0
    error_count = 0
    
    # Get folders to recreate directory structure
    folders = db.query(Folder).all()
    folder_map = {f.id: f for f in folders}
    
    # Create folder structure
    for folder in folders:
        folder_path = output_dir / sanitize_filename(folder.name)
        folder_path.mkdir(parents=True, exist_ok=True)
    
    for i, note in enumerate(notes, 1):
        try:
            # Determine file path
            if note.folder_id and note.folder_id in folder_map:
                folder = folder_map[note.folder_id]
                file_dir = output_dir / sanitize_filename(folder.name)
            else:
                file_dir = output_dir
            
            # Create filename from title
            filename = sanitize_filename(note.title) + ".md"
            file_path = file_dir / filename
            
            # Handle filename conflicts
            counter = 1
            while file_path.exists():
                filename = f"{sanitize_filename(note.title)}_{counter}.md"
                file_path = file_dir / filename
                counter += 1
            
            # Build frontmatter
            frontmatter_lines = ["---"]
            frontmatter_lines.append(f'title: "{note.title}"')
            
            if note.tags and len(note.tags) > 0:
                frontmatter_lines.append("tags:")
                for tag in note.tags:
                    frontmatter_lines.append(f'  - "{tag}"')
            
            if note.created_at:
                frontmatter_lines.append(f'created: "{note.created_at.isoformat()}"')
            
            if note.updated_at:
                frontmatter_lines.append(f'updated: "{note.updated_at.isoformat()}"')
            
            frontmatter_lines.append("---")
            frontmatter = "\\n".join(frontmatter_lines)
            
            # Write file
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(frontmatter)
                f.write("\\n\\n")
                f.write(note.content)
            
            print(f"[{i}/{total_notes}] ✓ {note.title[:50]}")
            exported_count += 1
            
        except Exception as e:
            print(f"[{i}/{total_notes}] ✗ ERROR: {note.title[:50]} - {e}")
            error_count += 1
            continue
    
    db.close()
    
    print()
    print("=" * 70)
    print("✅ EXPORT COMPLETED")
    print("=" * 70)
    print(f"📊 Statistics:")
    print(f"   - Notes exported: {exported_count}")
    print(f"   - Errors: {error_count}")
    print()
    print(f"📁 Your notes are saved at: {output_dir}")
    print("   You can now use these markdown files in any text editor or note app!")
    print()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Export notes from MyOb database to markdown files'
    )
    parser.add_argument(
        'output_dir',
        nargs='?',
        help='Directory to export notes to (default: ./exported_notes)'
    )
    parser.add_argument('--owner', required=True, help='Version 4 Mero user UUID')
    
    args = parser.parse_args()
    
    try:
        export_notes(owner_id=args.owner, output_dir=args.output_dir)
    except Exception as e:
        print()
        print(f"❌ EXPORT FAILED: {e}")
        print()
        sys.exit(1)
