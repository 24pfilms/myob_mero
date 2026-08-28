ALTER TABLE notes ADD COLUMN embedding_model TEXT;
ALTER TABLE notes ADD COLUMN embedding_dimensions INTEGER;
ALTER TABLE notes ADD COLUMN embedding_status TEXT NOT NULL DEFAULT 'missing' CHECK (embedding_status IN ('missing', 'pending', 'ready', 'failed', 'legacy'));
ALTER TABLE notes ADD COLUMN embedding_error TEXT;
UPDATE notes SET embedding_status = 'legacy' WHERE embedding IS NOT NULL;

CREATE TABLE embedding_jobs (
    owner_id TEXT NOT NULL,
    id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    model TEXT NOT NULL,
    dimensions INTEGER NOT NULL,
    last_note_id TEXT,
    processed_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    failures JSON,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (owner_id, id)
);
CREATE INDEX idx_embedding_jobs_status ON embedding_jobs (owner_id, status, updated_at);
