CREATE TABLE attachments (
    owner_id TEXT NOT NULL,
    id TEXT NOT NULL,
    note_id TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    bytes INTEGER NOT NULL CHECK (bytes > 0),
    storage_path TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (owner_id, id),
    UNIQUE (owner_id, note_id, sha256),
    FOREIGN KEY (owner_id, note_id) REFERENCES notes(owner_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_attachments_note ON attachments (owner_id, note_id);

CREATE TABLE attachment_migration_jobs (
    owner_id TEXT NOT NULL,
    id TEXT NOT NULL,
    status TEXT NOT NULL,
    last_note_id TEXT,
    processed_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    failures JSON,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (owner_id, id)
);
