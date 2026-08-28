CREATE TABLE notes (
    id VARCHAR PRIMARY KEY,
    title VARCHAR NOT NULL,
    content TEXT NOT NULL,
    tags JSON,
    embedding TEXT,
    folder_id VARCHAR,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
CREATE TABLE folders (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    parent_id VARCHAR,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
INSERT INTO folders (id, name, parent_id, created_at, updated_at)
VALUES ('legacy-folder', 'Legacy', NULL, '2026-01-01 00:00:00', '2026-01-01 00:00:00');
INSERT INTO notes (id, title, content, tags, embedding, folder_id, created_at, updated_at)
VALUES ('legacy-note', 'Legacy note', '# Preserved', '[]', NULL, 'legacy-folder', '2026-01-01 00:00:00', '2026-01-01 00:00:00');
