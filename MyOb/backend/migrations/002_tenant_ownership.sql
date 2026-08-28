ALTER TABLE notes RENAME TO notes_legacy;
CREATE TABLE notes (
    owner_id TEXT NOT NULL, id VARCHAR NOT NULL, title VARCHAR NOT NULL, content TEXT NOT NULL,
    tags JSON, embedding TEXT, folder_id VARCHAR, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
    PRIMARY KEY (owner_id, id)
);
INSERT INTO notes SELECT {{LEGACY_OWNER}}, id, title, content, tags, embedding, folder_id, created_at, updated_at FROM notes_legacy;
DROP TABLE notes_legacy;
CREATE INDEX idx_notes_title ON notes (owner_id, title);
CREATE INDEX idx_notes_folder_id ON notes (owner_id, folder_id);
CREATE INDEX idx_notes_created_at ON notes (owner_id, created_at);

ALTER TABLE folders RENAME TO folders_legacy;
CREATE TABLE folders (
    owner_id TEXT NOT NULL, id VARCHAR NOT NULL, name VARCHAR NOT NULL, parent_id VARCHAR,
    created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, PRIMARY KEY (owner_id, id)
);
INSERT INTO folders SELECT {{LEGACY_OWNER}}, id, name, parent_id, created_at, updated_at FROM folders_legacy;
DROP TABLE folders_legacy;
CREATE INDEX idx_folders_parent_id ON folders (owner_id, parent_id);
CREATE INDEX idx_folders_name ON folders (owner_id, name);

ALTER TABLE video_summaries RENAME TO video_summaries_legacy;
CREATE TABLE video_summaries (
    owner_id TEXT NOT NULL, video_id VARCHAR NOT NULL, note_id VARCHAR NOT NULL, title VARCHAR,
    summary TEXT, transcript TEXT, created_at DATETIME NOT NULL, PRIMARY KEY (owner_id, video_id)
);
INSERT INTO video_summaries SELECT {{LEGACY_OWNER}}, video_id, note_id, title, summary, transcript, created_at FROM video_summaries_legacy;
DROP TABLE video_summaries_legacy;
CREATE INDEX idx_video_note_id ON video_summaries (owner_id, note_id);

ALTER TABLE import_jobs RENAME TO import_jobs_legacy;
CREATE TABLE import_jobs (
    owner_id TEXT NOT NULL, id VARCHAR NOT NULL, status VARCHAR NOT NULL, total_items JSON,
    completed_items JSON, failed_items JSON, results JSON, created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL, PRIMARY KEY (owner_id, id)
);
INSERT INTO import_jobs SELECT {{LEGACY_OWNER}}, id, status, total_items, completed_items, failed_items, results, created_at, updated_at FROM import_jobs_legacy;
DROP TABLE import_jobs_legacy;
CREATE INDEX idx_import_jobs_status ON import_jobs (owner_id, status);
CREATE INDEX idx_import_jobs_created_at ON import_jobs (owner_id, created_at);

ALTER TABLE conversations RENAME TO conversations_legacy;
CREATE TABLE conversations (
    owner_id TEXT NOT NULL, id VARCHAR NOT NULL, title VARCHAR, note_id VARCHAR,
    created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, PRIMARY KEY (owner_id, id)
);
INSERT INTO conversations SELECT {{LEGACY_OWNER}}, id, title, note_id, created_at, updated_at FROM conversations_legacy;
DROP TABLE conversations_legacy;
CREATE INDEX idx_conversations_created_at ON conversations (owner_id, created_at);
CREATE INDEX idx_conversations_note_id ON conversations (owner_id, note_id);

ALTER TABLE conversation_messages RENAME TO conversation_messages_legacy;
CREATE TABLE conversation_messages (
    owner_id TEXT NOT NULL, id VARCHAR NOT NULL, conversation_id VARCHAR NOT NULL, role VARCHAR NOT NULL,
    content TEXT NOT NULL, citations JSON, created_at DATETIME NOT NULL, PRIMARY KEY (owner_id, id)
);
INSERT INTO conversation_messages SELECT {{LEGACY_OWNER}}, id, conversation_id, role, content, citations, created_at FROM conversation_messages_legacy;
DROP TABLE conversation_messages_legacy;
CREATE INDEX idx_messages_conversation_id ON conversation_messages (owner_id, conversation_id);
CREATE INDEX idx_messages_created_at ON conversation_messages (owner_id, created_at);

ALTER TABLE note_links RENAME TO note_links_legacy;
CREATE TABLE note_links (
    owner_id TEXT NOT NULL, id VARCHAR NOT NULL, source_note_id VARCHAR NOT NULL, target_note_id VARCHAR NOT NULL,
    link_type VARCHAR, confidence_score JSON, created_at DATETIME NOT NULL, PRIMARY KEY (owner_id, id)
);
INSERT INTO note_links SELECT {{LEGACY_OWNER}}, id, source_note_id, target_note_id, link_type, confidence_score, created_at FROM note_links_legacy;
DROP TABLE note_links_legacy;
CREATE INDEX idx_links_source ON note_links (owner_id, source_note_id);
CREATE INDEX idx_links_target ON note_links (owner_id, target_note_id);
CREATE INDEX idx_links_type ON note_links (owner_id, link_type);

ALTER TABLE ai_suggestions RENAME TO ai_suggestions_legacy;
CREATE TABLE ai_suggestions (
    owner_id TEXT NOT NULL, id VARCHAR NOT NULL, note_id VARCHAR NOT NULL, suggestion_type VARCHAR NOT NULL,
    suggestion_data JSON NOT NULL, status VARCHAR, created_at DATETIME NOT NULL, PRIMARY KEY (owner_id, id)
);
INSERT INTO ai_suggestions SELECT {{LEGACY_OWNER}}, id, note_id, suggestion_type, suggestion_data, status, created_at FROM ai_suggestions_legacy;
DROP TABLE ai_suggestions_legacy;
CREATE INDEX idx_suggestions_note_id ON ai_suggestions (owner_id, note_id);
CREATE INDEX idx_suggestions_status ON ai_suggestions (owner_id, status);
CREATE INDEX idx_suggestions_type ON ai_suggestions (owner_id, suggestion_type);

ALTER TABLE generated_images RENAME TO generated_images_legacy;
CREATE TABLE generated_images (
    owner_id TEXT NOT NULL, id VARCHAR NOT NULL, note_id VARCHAR, prompt TEXT NOT NULL, image_data TEXT NOT NULL,
    thumbnail_data TEXT, mime_type VARCHAR, aspect_ratio VARCHAR, tags JSON, category VARCHAR, is_favorite JSON,
    display_order JSON, generation_params JSON, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
    PRIMARY KEY (owner_id, id)
);
INSERT INTO generated_images SELECT {{LEGACY_OWNER}}, id, note_id, prompt, image_data, thumbnail_data, mime_type, aspect_ratio, tags, category, is_favorite, display_order, generation_params, created_at, updated_at FROM generated_images_legacy;
DROP TABLE generated_images_legacy;
CREATE INDEX idx_generated_images_note_id ON generated_images (owner_id, note_id);
CREATE INDEX idx_generated_images_created_at ON generated_images (owner_id, created_at);
CREATE INDEX idx_generated_images_is_favorite ON generated_images (owner_id, is_favorite);
CREATE INDEX idx_generated_images_category ON generated_images (owner_id, category);

ALTER TABLE image_collections RENAME TO image_collections_legacy;
CREATE TABLE image_collections (
    owner_id TEXT NOT NULL, id VARCHAR NOT NULL, name VARCHAR NOT NULL, description TEXT,
    created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, PRIMARY KEY (owner_id, id)
);
INSERT INTO image_collections SELECT {{LEGACY_OWNER}}, id, name, description, created_at, updated_at FROM image_collections_legacy;
DROP TABLE image_collections_legacy;
CREATE INDEX idx_image_collections_created_at ON image_collections (owner_id, created_at);

ALTER TABLE image_collection_memberships RENAME TO image_collection_memberships_legacy;
CREATE TABLE image_collection_memberships (
    owner_id TEXT NOT NULL, id VARCHAR NOT NULL, collection_id VARCHAR NOT NULL, image_id VARCHAR NOT NULL,
    added_at DATETIME NOT NULL, PRIMARY KEY (owner_id, id), UNIQUE (owner_id, collection_id, image_id)
);
INSERT INTO image_collection_memberships SELECT {{LEGACY_OWNER}}, id, collection_id, image_id, added_at FROM image_collection_memberships_legacy;
DROP TABLE image_collection_memberships_legacy;
CREATE INDEX idx_memberships_collection_id ON image_collection_memberships (owner_id, collection_id);
CREATE INDEX idx_memberships_image_id ON image_collection_memberships (owner_id, image_id);

ALTER TABLE ai_settings RENAME TO ai_settings_legacy;
CREATE TABLE ai_settings (
    owner_id TEXT NOT NULL, id VARCHAR NOT NULL, ai_chat_enabled JSON, link_suggestions_enabled JSON,
    auto_tag_enabled JSON, chat_model VARCHAR, temperature JSON, max_context_notes JSON, send_full_content JSON,
    exclude_private_tags JSON, save_conversations JSON, link_suggestion_debounce JSON, updated_at DATETIME NOT NULL,
    PRIMARY KEY (owner_id, id)
);
INSERT INTO ai_settings SELECT {{LEGACY_OWNER}}, id, ai_chat_enabled, link_suggestions_enabled, auto_tag_enabled, chat_model, temperature, max_context_notes, send_full_content, exclude_private_tags, save_conversations, link_suggestion_debounce, updated_at FROM ai_settings_legacy;
DROP TABLE ai_settings_legacy;
