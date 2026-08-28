"""
Direct fix for double exclamation marks in image markdown.
"""

import sqlite3
from config import DB_PATH

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Get all notes with double !!
cursor.execute("SELECT id, title, content FROM notes WHERE content LIKE '%!!%'")
notes = cursor.fetchall()

print(f"Found {len(notes)} note(s) with !! pattern\n")

for note_id, title, content in notes:
    # Replace !! with ! for image syntax
    new_content = content.replace('!!', '!')
    
    if new_content != content:
        print(f"Fixing: {title[:80]}")
        print(f"  Changes: {content.count('!!')} double !! replaced")
        
        cursor.execute("UPDATE notes SET content = ? WHERE id = ?", (new_content, note_id))
        
        # Verify
        print(f"  First 100 chars BEFORE: {content[:100]}")
        print(f"  First 100 chars AFTER:  {new_content[:100]}")
        print()

conn.commit()
print("✓ Database updated")
conn.close()
