import sqlite3
from config import DB_PATH

def migrate_database():
    """Add new columns and tables to the existing database."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if folders table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='folders'")
        folders_table_exists = cursor.fetchone()
        
        if not folders_table_exists:
            # Create folders table
            cursor.execute("""
                CREATE TABLE folders (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    parent_id TEXT,
                    created_at TEXT NOT NULL
                )
            """)
            print("Created folders table")
        
        # Check if folder_id column exists in notes table
        cursor.execute("PRAGMA table_info(notes)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'folder_id' not in columns:
            # Add folder_id column to notes table
            cursor.execute("ALTER TABLE notes ADD COLUMN folder_id TEXT")
            print("Added folder_id column to notes table")
        
        conn.commit()
        print("Database migration completed successfully!")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_database()