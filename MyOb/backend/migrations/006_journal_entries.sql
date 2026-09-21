ALTER TABLE notes ADD COLUMN kind TEXT NOT NULL DEFAULT 'note';
ALTER TABLE notes ADD COLUMN entry_date DATE;
ALTER TABLE notes ADD COLUMN space TEXT NOT NULL DEFAULT 'work';
ALTER TABLE notes ADD COLUMN project_id TEXT;
ALTER TABLE notes ADD COLUMN assignment TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE notes ADD COLUMN source TEXT NOT NULL DEFAULT 'text';
ALTER TABLE notes ADD COLUMN word_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notes ADD COLUMN extracted JSON;
ALTER TABLE notes ADD COLUMN period_type TEXT;
ALTER TABLE notes ADD COLUMN period_start DATE;

ALTER TABLE note_versions ADD COLUMN space TEXT;
ALTER TABLE note_versions ADD COLUMN project_id TEXT;

CREATE TABLE clients (
    owner_id TEXT NOT NULL,
    id TEXT NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
    created_at DATETIME NOT NULL,
    PRIMARY KEY (owner_id, id),
    UNIQUE (owner_id, name)
);

CREATE TABLE projects (
    owner_id TEXT NOT NULL,
    id TEXT NOT NULL,
    client_id TEXT,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'done')),
    stale_after_days INTEGER NOT NULL DEFAULT 7 CHECK (stale_after_days > 0),
    created_at DATETIME NOT NULL,
    PRIMARY KEY (owner_id, id),
    UNIQUE (owner_id, name),
    FOREIGN KEY (owner_id, client_id) REFERENCES clients(owner_id, id) ON DELETE SET NULL
);
CREATE INDEX idx_projects_client ON projects (owner_id, client_id);

CREATE TABLE jobs (
    owner_id TEXT NOT NULL,
    id TEXT NOT NULL,
    type TEXT NOT NULL,
    target_id TEXT,
    needs_signin INTEGER NOT NULL DEFAULT 0 CHECK (needs_signin IN (0, 1)),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    error TEXT,
    result JSON,
    processed_count INTEGER NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL DEFAULT 0,
    run_after DATETIME,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (owner_id, id)
);
CREATE INDEX idx_jobs_queue ON jobs (owner_id, status, run_after);

CREATE INDEX idx_notes_entry_date ON notes (owner_id, kind, entry_date);
CREATE INDEX idx_notes_project_entry_date ON notes (owner_id, project_id, entry_date);
CREATE UNIQUE INDEX idx_notes_summary_period ON notes (owner_id, kind, period_type, period_start) WHERE kind = 'summary';
