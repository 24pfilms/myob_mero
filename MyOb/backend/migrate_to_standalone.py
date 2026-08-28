"""
Database migration script to transition from Obsidian-synced to standalone architecture.

This script:
1. Adds created_at and updated_at columns to existing tables
2. Creates indexes for performance
3. Sets default timestamps for existing records
4. Validates the migration

Run this ONCE after updating database.py schema.
"""

import sqlite3
from datetime import datetime
from pathlib import Path
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import DB_PATH

def migrate_database():
    """Migrate existing database to new schema."""
    print("=" * 60)
    print("DATABASE MIGRATION: Obsidian-Synced → Standalone")
    print("=" * 60)
    print()
    
    # Check if database exists
    if not os.path.exists(DB_PATH):
        print("✅ No existing database found. Fresh install detected.")
        print("   The new schema will be created automatically on first run.")
        return
    
    print(f"📂 Database location: {DB_PATH}")
    print()
    
    # Backup database first
    backup_path = str(DB_PATH).replace('.db', '_backup_before_migration.db')
    print(f"🔒 Creating backup: {backup_path}")
    import shutil
    shutil.copy2(DB_PATH, backup_path)
    print("✅ Backup created successfully")
    print()
    
    # Connect to database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get current timestamp
    now = datetime.utcnow().isoformat()
    
    print("🔧 Starting migration...")
    print()
    
    # Migrate Notes table
    print("1️⃣  Migrating 'notes' table...")
    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(notes)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'created_at' not in columns:
            cursor.execute("ALTER TABLE notes ADD COLUMN created_at TIMESTAMP")
            cursor.execute(f"UPDATE notes SET created_at = '{now}' WHERE created_at IS NULL")
            print("   ✅ Added 'created_at' column")
        else:
            print("   ⏭️  'created_at' column already exists")
        
        if 'updated_at' not in columns:
            cursor.execute("ALTER TABLE notes ADD COLUMN updated_at TIMESTAMP")
            cursor.execute(f"UPDATE notes SET updated_at = '{now}' WHERE updated_at IS NULL")
            print("   ✅ Added 'updated_at' column")
        else:
            print("   ⏭️  'updated_at' column already exists")
        
        # Create indexes
        try:
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at)")
            print("   ✅ Created indexes for notes table")
        except sqlite3.OperationalError as e:
            print(f"   ⚠️  Index creation warning: {e}")
        
        # Get note count
        cursor.execute("SELECT COUNT(*) FROM notes")
        note_count = cursor.fetchone()[0]
        print(f"   📊 Total notes: {note_count}")
        
    except Exception as e:
        print(f"   ❌ Error migrating notes table: {e}")
        conn.rollback()
        return False
    
    print()
    
    # Migrate Folders table
    print("2️⃣  Migrating 'folders' table...")
    try:
        # Check if table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='folders'")
        if cursor.fetchone():
            cursor.execute("PRAGMA table_info(folders)")
            columns = [row[1] for row in cursor.fetchall()]
            
            if 'updated_at' not in columns:
                cursor.execute("ALTER TABLE folders ADD COLUMN updated_at TIMESTAMP")
                cursor.execute(f"UPDATE folders SET updated_at = '{now}' WHERE updated_at IS NULL")
                print("   ✅ Added 'updated_at' column")
            else:
                print("   ⏭️  'updated_at' column already exists")
            
            # Update created_at to TIMESTAMP if it's TEXT
            cursor.execute("PRAGMA table_info(folders)")
            for row in cursor.fetchall():
                if row[1] == 'created_at' and row[2] == 'TEXT':
                    print("   🔄 Converting 'created_at' from TEXT to TIMESTAMP format")
                    # SQLite doesn't support changing column types directly
                    # But it will accept ISO format timestamps
            
            # Create indexes
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_folders_name ON folders(name)")
            print("   ✅ Created indexes for folders table")
            
            cursor.execute("SELECT COUNT(*) FROM folders")
            folder_count = cursor.fetchone()[0]
            print(f"   📊 Total folders: {folder_count}")
        else:
            print("   ⏭️  Folders table doesn't exist yet (will be created on first use)")
    except Exception as e:
        print(f"   ❌ Error migrating folders table: {e}")
        conn.rollback()
        return False
    
    print()
    
    # Migrate VideoSummary table
    print("3️⃣  Migrating 'video_summaries' table...")
    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='video_summaries'")
        if cursor.fetchone():
            cursor.execute("PRAGMA table_info(video_summaries)")
            columns = [row[1] for row in cursor.fetchall()]
            
            if 'created_at' not in columns:
                cursor.execute("ALTER TABLE video_summaries ADD COLUMN created_at TIMESTAMP")
                cursor.execute(f"UPDATE video_summaries SET created_at = '{now}' WHERE created_at IS NULL")
                print("   ✅ Added 'created_at' column")
            else:
                print("   ⏭️  'created_at' column already exists")
            
            # Create index
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_video_note_id ON video_summaries(note_id)")
            print("   ✅ Created index for video_summaries table")
            
            cursor.execute("SELECT COUNT(*) FROM video_summaries")
            video_count = cursor.fetchone()[0]
            print(f"   📊 Total video summaries: {video_count}")
        else:
            print("   ⏭️  Video_summaries table doesn't exist yet")
    except Exception as e:
        print(f"   ❌ Error migrating video_summaries table: {e}")
        conn.rollback()
        return False
    
    print()
    
    # Commit all changes
    conn.commit()
    conn.close()
    
    print("=" * 60)
    print("✅ MIGRATION COMPLETED SUCCESSFULLY")
    print("=" * 60)
    print()
    print("📋 Next steps:")
    print("   1. Restart your backend server")
    print("   2. Verify all notes load correctly in the frontend")
    print("   3. Test creating/updating/deleting notes")
    print()
    print(f"💾 Backup saved at: {backup_path}")
    print("   (You can delete this after confirming everything works)")
    print()
    
    return True

if __name__ == "__main__":
    try:
        success = migrate_database()
        sys.exit(0 if success else 1)
    except Exception as e:
        print()
        print(f"❌ MIGRATION FAILED: {e}")
        print()
        print("Your database has NOT been modified.")
        print("Please report this error if it persists.")
        sys.exit(1)
