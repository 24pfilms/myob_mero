CREATE VIRTUAL TABLE notes_fts USING fts5(
    note_id UNINDEXED,
    owner_id UNINDEXED,
    title,
    content,
    tokenize = 'porter unicode61'
);

INSERT INTO notes_fts (note_id, owner_id, title, content)
SELECT id, owner_id, COALESCE(title, ''), COALESCE(content, '') FROM notes;

CREATE TRIGGER notes_fts_after_insert AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts (note_id, owner_id, title, content)
    VALUES (new.id, new.owner_id, COALESCE(new.title, ''), COALESCE(new.content, ''));
END;

CREATE TRIGGER notes_fts_after_delete AFTER DELETE ON notes BEGIN
    DELETE FROM notes_fts WHERE note_id = old.id AND owner_id IS old.owner_id;
END;

CREATE TRIGGER notes_fts_after_update AFTER UPDATE ON notes BEGIN
    DELETE FROM notes_fts WHERE note_id = old.id AND owner_id IS old.owner_id;
    INSERT INTO notes_fts (note_id, owner_id, title, content)
    VALUES (new.id, new.owner_id, COALESCE(new.title, ''), COALESCE(new.content, ''));
END;

CREATE TABLE note_groups (
    owner_id TEXT NOT NULL,
    id TEXT NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    mode TEXT NOT NULL DEFAULT 'fixed' CHECK (mode IN ('fixed', 'live')),
    definition JSON NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (owner_id, id),
    UNIQUE (owner_id, name)
);

CREATE TABLE personas (
    owner_id TEXT NOT NULL,
    id TEXT NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    instructions TEXT NOT NULL CHECK (length(instructions) <= 10000),
    default_scope JSON,
    is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
    created_at DATETIME NOT NULL,
    PRIMARY KEY (owner_id, id),
    UNIQUE (owner_id, name)
);

CREATE UNIQUE INDEX idx_personas_single_default ON personas (owner_id) WHERE is_default = 1;
