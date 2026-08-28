"""
Database migration to add import_jobs table for content import tracking.
"""

import sqlite3
from config import DB_PATH

def migrate_import_jobs():
    """Add import_jobs table to the database."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if import_jobs table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='import_jobs'")
        table_exists = cursor.fetchone()
        
        if not table_exists:
            # Create import_jobs table
            cursor.execute("""
                CREATE TABLE import_jobs (
                    id TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    total_items INTEGER DEFAULT 0,
                    completed_items INTEGER DEFAULT 0,
                    failed_items INTEGER DEFAULT 0,
                    results TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            print("✓ Created import_jobs table")
            
            # Create indexes
            cursor.execute("CREATE INDEX idx_import_jobs_status ON import_jobs(status)")
            cursor.execute("CREATE INDEX idx_import_jobs_created_at ON import_jobs(created_at)")
            print("✓ Created indexes on import_jobs table")
        else:
            print("✓ import_jobs table already exists")
        
        conn.commit()
        print("\n✓ Database migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"\n✗ Error during migration: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    print("Running import_jobs table migration...\n")
    success = migrate_import_jobs()
    exit(0 if success else 1)
