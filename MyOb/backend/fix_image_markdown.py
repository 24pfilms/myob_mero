"""
Fix corrupted image markdown syntax in notes.

This script will find and fix broken image markdown like:
  title: "[image.jpg[148]    (WRONG)
  
And convert it to proper format:
  ![image.jpg|148](data:image/...)    (CORRECT)
"""

import sqlite3
import re
import os
from config import DB_PATH

def fix_image_markdown(content: str) -> tuple[str, bool]:
    """
    Fix corrupted image markdown syntax.
    
    Returns: (fixed_content, was_changed)
    """
    original = content
    changed = False
    
    # First, fix double exclamation marks: !! -> !
    if '!!' in content:
        double_bang = r'!!\[([^\]]+)\]\((data:image/[^)]+)\)'
        if re.search(double_bang, content):
            changed = True
            content = re.sub(double_bang, r'![\1](\2)', content)
            print("  Fixed double exclamation marks")
    
    # Pattern to find broken image syntax like: "[filename[width]
    # where it should be: ![filename|width](url)
    
    # Fix case where image syntax is completely broken
    # Look for patterns like: "[something](data:image..."
    broken_pattern = r'\[([^\]]+)\]\((data:image/[^)]+)\)'
    def fix_broken(match):
        nonlocal changed
        changed = True
        alt_text = match.group(1)
        src = match.group(2)
        # Check if there's a width specifier with wrong format [148]
        alt_parts = alt_text.split('[')
        if len(alt_parts) > 1:
            # Extract width
            width_match = re.search(r'\[(\d+)\]', alt_text)
            if width_match:
                clean_alt = alt_parts[0]
                width = width_match.group(1)
                return f'![{clean_alt}|{width}]({src})'
        return f'![{alt_text}]({src})'
    
    content = re.sub(broken_pattern, fix_broken, content)
    
    # Fix images missing the leading !
    # Pattern: [alt](data:image/...) should be ![alt](data:image/...)
    missing_bang = r'(?<![!])\[([^\]]+)\]\((data:image/[^)]+)\)'
    if re.search(missing_bang, content):
        changed = True
        content = re.sub(missing_bang, r'![\1](\2)', content)
    
    return content, changed

def scan_and_fix_notes():
    """Scan all notes and fix corrupted image markdown."""
    if not os.path.exists(DB_PATH):
        print(f"Database not found at: {DB_PATH}")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("Scanning notes for corrupted image markdown...\n")
    
    # Get all notes
    cursor.execute("SELECT id, title, content FROM notes")
    notes = cursor.fetchall()
    
    fixed_count = 0
    
    for note_id, title, content in notes:
        if not content:
            continue
        
        # Check if note has image data
        if 'data:image/' in content:
            fixed_content, was_changed = fix_image_markdown(content)
            
            if was_changed:
                fixed_count += 1
                print(f"✓ Fixed: {title} (ID: {note_id})")
                print(f"  Original length: {len(content)}")
                print(f"  Fixed length: {len(fixed_content)}")
                
                # Update in database
                cursor.execute(
                    "UPDATE notes SET content = ? WHERE id = ?",
                    (fixed_content, note_id)
                )
    
    if fixed_count > 0:
        conn.commit()
        print(f"\n✓ Fixed {fixed_count} note(s) with corrupted image markdown")
    else:
        print("✓ No corrupted image markdown found")
    
    conn.close()

if __name__ == "__main__":
    scan_and_fix_notes()
