"""
Check if the base64 image data contains parentheses.
"""

import sqlite3
import re
from config import DB_PATH

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

cursor.execute("SELECT id, title, content FROM notes WHERE content LIKE '%data:image%' LIMIT 1")
note = cursor.fetchone()

if note:
    note_id, title, content = note
    
    # Find the image markdown
    match = re.search(r'!\[([^\]]*)\]\((data:image/[^\)]+)\)', content)
    if match:
        alt = match.group(1)
        src_snippet = match.group(2)[:200]  # First 200 chars
        
        print(f"Alt text: {alt}")
        print(f"First 200 chars of src: {src_snippet}")
        print()
        
        # Check full base64 data
        full_match = re.search(r'!\[[^\]]*\]\((data:image/[^,]+,[A-Za-z0-9+/=]+)\)', content)
        if full_match:
            full_src = full_match.group(1)
            print(f"Full base64 data length: {len(full_src)}")
            print(f"Contains '(': {')' in full_src or '(' in full_src}")
            
            # Count parentheses in base64 data
            paren_count = full_src.count('(') + full_src.count(')')
            print(f"Parentheses in base64: {paren_count}")
        else:
            print("Could not extract full base64 data")
    else:
        print("No image markdown found")
        print(f"First 500 chars: {content[:500]}")
else:
    print("No notes with images found")

conn.close()
