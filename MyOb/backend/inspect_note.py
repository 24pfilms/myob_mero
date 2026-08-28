"""
Inspect note content to see exact markdown format.
"""

import sqlite3
from config import DB_PATH

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Get the note with images
cursor.execute("SELECT id, title, content FROM notes WHERE content LIKE '%data:image%'")
notes = cursor.fetchall()

for note_id, title, content in notes:
    print(f"Note: {title}")
    print(f"ID: {note_id}")
    print(f"Content length: {len(content)}")
    print("\nFirst 1000 characters of content:")
    print("="*80)
    print(content[:1000])
    print("="*80)
    
    # Find all image syntax
    import re
    images = re.findall(r'!\[[^\]]*\]\([^)]+\)', content[:2000])
    print(f"\nFound {len(images)} image(s) in first 2000 chars:")
    for i, img in enumerate(images):
        # Show just the format, not the full base64
        parts = img.split('(')
        if len(parts) > 1:
            url_part = parts[1][:100]  # First 100 chars of URL
            print(f"  Image {i+1}: {parts[0]}({url_part}...)")
    print()

conn.close()
