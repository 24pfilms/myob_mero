CREATE TABLE IF NOT EXISTS notes (
    id VARCHAR PRIMARY KEY,
    title VARCHAR NOT NULL,
    content TEXT NOT NULL,
    tags JSON,
    embedding TEXT,
    folder_id VARCHAR,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_title ON notes (title);
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes (folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes (created_at);

CREATE TABLE IF NOT EXISTS folders (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    parent_id VARCHAR,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders (parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_name ON folders (name);

CREATE TABLE IF NOT EXISTS video_summaries (
    video_id VARCHAR PRIMARY KEY,
    note_id VARCHAR NOT NULL,
    title VARCHAR,
    summary TEXT,
    transcript TEXT,
    created_at DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_video_note_id ON video_summaries (note_id);

CREATE TABLE IF NOT EXISTS import_jobs (
    id VARCHAR PRIMARY KEY,
    status VARCHAR NOT NULL,
    total_items JSON,
    completed_items JSON,
    failed_items JSON,
    results JSON,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs (status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON import_jobs (created_at);

CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR PRIMARY KEY,
    title VARCHAR,
    note_id VARCHAR,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations (created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_note_id ON conversations (note_id);

CREATE TABLE IF NOT EXISTS conversation_messages (
    id VARCHAR PRIMARY KEY,
    conversation_id VARCHAR NOT NULL,
    role VARCHAR NOT NULL,
    content TEXT NOT NULL,
    citations JSON,
    created_at DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON conversation_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON conversation_messages (created_at);

CREATE TABLE IF NOT EXISTS note_links (
    id VARCHAR PRIMARY KEY,
    source_note_id VARCHAR NOT NULL,
    target_note_id VARCHAR NOT NULL,
    link_type VARCHAR,
    confidence_score JSON,
    created_at DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_links_source ON note_links (source_note_id);
CREATE INDEX IF NOT EXISTS idx_links_target ON note_links (target_note_id);
CREATE INDEX IF NOT EXISTS idx_links_type ON note_links (link_type);

CREATE TABLE IF NOT EXISTS ai_suggestions (
    id VARCHAR PRIMARY KEY,
    note_id VARCHAR NOT NULL,
    suggestion_type VARCHAR NOT NULL,
    suggestion_data JSON NOT NULL,
    status VARCHAR,
    created_at DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_suggestions_note_id ON ai_suggestions (note_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON ai_suggestions (status);
CREATE INDEX IF NOT EXISTS idx_suggestions_type ON ai_suggestions (suggestion_type);

CREATE TABLE IF NOT EXISTS generated_images (
    id VARCHAR PRIMARY KEY,
    note_id VARCHAR,
    prompt TEXT NOT NULL,
    image_data TEXT NOT NULL,
    thumbnail_data TEXT,
    mime_type VARCHAR,
    aspect_ratio VARCHAR,
    tags JSON,
    category VARCHAR,
    is_favorite JSON,
    display_order JSON,
    generation_params JSON,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_generated_images_note_id ON generated_images (note_id);
CREATE INDEX IF NOT EXISTS idx_generated_images_created_at ON generated_images (created_at);
CREATE INDEX IF NOT EXISTS idx_generated_images_is_favorite ON generated_images (is_favorite);
CREATE INDEX IF NOT EXISTS idx_generated_images_category ON generated_images (category);

CREATE TABLE IF NOT EXISTS image_collections (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    description TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_image_collections_created_at ON image_collections (created_at);

CREATE TABLE IF NOT EXISTS image_collection_memberships (
    id VARCHAR PRIMARY KEY,
    collection_id VARCHAR NOT NULL,
    image_id VARCHAR NOT NULL,
    added_at DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memberships_collection_id ON image_collection_memberships (collection_id);
CREATE INDEX IF NOT EXISTS idx_memberships_image_id ON image_collection_memberships (image_id);

CREATE TABLE IF NOT EXISTS ai_settings (
    id VARCHAR PRIMARY KEY,
    ai_chat_enabled JSON,
    link_suggestions_enabled JSON,
    auto_tag_enabled JSON,
    chat_model VARCHAR,
    temperature JSON,
    max_context_notes JSON,
    send_full_content JSON,
    exclude_private_tags JSON,
    save_conversations JSON,
    link_suggestion_debounce JSON,
    updated_at DATETIME NOT NULL
);
