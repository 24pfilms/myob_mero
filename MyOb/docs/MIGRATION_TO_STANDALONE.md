# Migration to Standalone Database Mode

## Overview

MyOb has been migrated from **Obsidian-synced mode** to **standalone database mode**. This means:

- ✅ Notes are now stored directly in the database
- ✅ No Obsidian vault required
- ✅ Full CRUD operations (create, update, delete)
- ✅ Better performance with proper indexing
- ✅ Simpler architecture (no file sync complexity)
- ✅ Optional Obsidian import for migration
- ✅ Export to markdown for portability

## What Changed?

### Before (Obsidian-Synced)
- Required an Obsidian vault path in `config.py`
- File watcher constantly monitored vault changes
- Database was a cache of file system
- Couldn't easily add features beyond markdown files
- Sync bugs when files changed externally

### After (Standalone Database)
- Database is the source of truth
- No file watcher needed
- CRUD operations work directly on database
- Easy to extend with new features
- More reliable and faster

---

## Migration Steps

### Step 1: Run Database Migration

This adds timestamps and indexes to your existing database:

```powershell
cd backend
python migrate_to_standalone.py
```

**What it does:**
- Adds `created_at` and `updated_at` columns
- Creates performance indexes
- Backs up your database first
- Validates the migration

### Step 2: Update Your Environment (Optional)

If you no longer need Obsidian integration:

1. Open `backend/config.py`
2. Set `VAULT_PATH = None`

Your existing database will continue to work.

### Step 3: Restart Backend Server

```powershell
cd backend
.\\venv\\Scripts\\Activate.ps1
python runner.py
```

You should see:
```
============================================================
MyOb Backend Server - Standalone Database Mode
============================================================
API available at: http://localhost:8000
Note: File watcher is disabled. Notes are stored in database.
```

### Step 4: Verify in Frontend

1. Start the frontend: `cd My_Obsidian_FrontEnd-main && npm run dev`
2. Open http://localhost:8080
3. Check that all your notes still load
4. Try creating/editing/deleting a note

---

##  New Features

### 1. Create Notes via API

```typescript
// Frontend
await api.createNote({
  title: "My New Note",
  content: "# Heading\\n\\nContent here",
  tags: ["important"],
  folder_id: null
});
```

### 2. Update Notes

```typescript
await api.updateNote(noteId, {
  content: "Updated content",
  tags: ["updated", "important"]
});
```

### 3. Delete Notes

```typescript
await api.deleteNote(noteId);
```

### 4. Bulk Import Markdown Files

```typescript
await api.bulkImportNotes([
  {
    filename: "note1.md",
    content: "---\\ntitle: Note 1\\n---\\n\\nContent",
    folder_id: null
  },
  // ... more files
]);
```

### 5. Export All Notes

```powershell
cd backend
python export_markdown.py ./my_backup
```

Creates markdown files in `./my_backup/` directory.

### 6. Import from Obsidian (Optional)

If you want to import notes from an Obsidian vault:

```powershell
cd backend
python import_obsidian.py "C:/path/to/vault"
```

Or use the vault path from config.py:

```powershell
python import_obsidian.py
```

---

## Database Performance

### Capacity
- **SQLite can handle:** 281 TB database size
- **Your app:** ~100 MB for 10,000 notes (with embeddings)
- **Speed:** 50,000+ reads/sec, 10,000+ writes/sec

### Indexes Added
```sql
CREATE INDEX idx_notes_title ON notes(title);
CREATE INDEX idx_notes_folder_id ON notes(folder_id);
CREATE INDEX idx_notes_created_at ON notes(created_at);
CREATE INDEX idx_folders_parent_id ON folders(parent_id);
CREATE INDEX idx_folders_name ON folders(name);
CREATE INDEX idx_video_note_id ON video_summaries(note_id);
```

### Schema Changes
- Added `created_at` and `updated_at` timestamps
- Notes now use UUID for IDs instead of file paths
- Content includes full markdown with frontmatter

---

## Backward Compatibility

### Your Existing Notes
- ✅ All existing notes remain in the database
- ✅ Embeddings are preserved
- ✅ Tags and metadata are preserved
- ✅ Video summaries are preserved

### What's Removed
- ❌ File watcher (`watcher.py` no longer runs)
- ❌ Automatic vault sync
- ❌ Direct file I/O in create/update operations

### Optional Features Kept
- ✅ Import from Obsidian (`import_obsidian.py`)
- ✅ Export to markdown (`export_markdown.py`)
- ✅ File watcher code still exists (not used)

---

## Troubleshooting

### "Notes not loading"
1. Check that migration ran successfully
2. Verify database file exists: `data/notes.db`
3. Check backend logs for errors
4. Test API directly: http://localhost:8000/docs

### "Can't create notes"
1. Make sure you ran `migrate_to_standalone.py`
2. Check that backend is running (port 8000)
3. Verify frontend is calling new API endpoints

### "Import from Obsidian fails"
1. Check `VAULT_PATH` in `config.py`
2. Ensure vault directory exists and contains `.md` files
3. Check for API rate limits (1 req/sec default)

### "Performance issues"
1. Verify indexes were created (check migration output)
2. Run `VACUUM` on database:
   ```python
   import sqlite3
   conn = sqlite3.connect('data/notes.db')
   conn.execute('VACUUM')
   conn.close()
   ```

---

## Rollback (Emergency Only)

If you need to roll back:

1. Stop the backend server
2. Restore the backup: `data/notes_backup_before_migration.db`
3. Rename it to: `data/notes.db`
4. Revert code changes (use git)
5. Restart backend

**Note:** You'll lose any notes created after migration.

---

## FAQ

**Q: Can I still use Obsidian?**  
A: Yes! Use `export_markdown.py` to export notes, then open them in Obsidian. Changes won't sync automatically though.

**Q: Are my notes locked in the database?**  
A: No. Use `export_markdown.py` anytime to get plain markdown files.

**Q: Will this work with 100,000 notes?**  
A: Yes. SQLite with proper indexing can easily handle that. Database will be ~1GB.

**Q: Can I import my Obsidian vault later?**  
A: Yes. Run `python import_obsidian.py [vault_path]` anytime.

**Q: What about attachments/images?**  
A: Markdown with image links works. Actual image storage is a future feature.

---

## Next Steps

1. ✅ Migration complete
2. Test creating/editing/deleting notes
3. Consider adding:
   - Markdown export button in UI
   - Bulk import UI component
   - Note templates
   - Attachment support
   - Collaborative features

---

## Support

If you encounter issues:
1. Check `backend/vault_watcher.log` (if file watcher was running)
2. Check backend console output
3. Test API endpoints: http://localhost:8000/docs
4. Verify database backup exists before making changes
