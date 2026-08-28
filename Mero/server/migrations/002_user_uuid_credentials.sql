ALTER TABLE users ADD COLUMN user_uuid TEXT;

CREATE UNIQUE INDEX users_user_uuid_unique ON users(user_uuid);

CREATE TRIGGER users_user_uuid_immutable
BEFORE UPDATE OF user_uuid ON users
WHEN OLD.user_uuid IS NOT NULL AND NEW.user_uuid IS NOT OLD.user_uuid
BEGIN
    SELECT RAISE(ABORT, 'user_uuid is immutable');
END;

CREATE TABLE provider_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_uuid TEXT NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('gemini', 'openai')),
    credential_type TEXT NOT NULL CHECK (credential_type IN ('api_key', 'refreshable_token')),
    ciphertext TEXT NOT NULL,
    nonce TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    key_version INTEGER NOT NULL,
    verified_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (owner_uuid, provider),
    FOREIGN KEY (owner_uuid) REFERENCES users(user_uuid) ON DELETE CASCADE
);
