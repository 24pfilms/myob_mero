ALTER TABLE notes ADD COLUMN current_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE note_versions (
    owner_id TEXT NOT NULL,
    id TEXT NOT NULL,
    note_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags JSON,
    folder_id TEXT,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (owner_id, id),
    UNIQUE (owner_id, note_id, version),
    FOREIGN KEY (owner_id, note_id) REFERENCES notes(owner_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_note_versions_note ON note_versions (owner_id, note_id, version DESC);

INSERT INTO note_versions (owner_id, id, note_id, version, title, content, tags, folder_id, created_at)
SELECT owner_id, lower(hex(randomblob(16))), id, 1, title, content, tags, folder_id, updated_at
FROM notes;
