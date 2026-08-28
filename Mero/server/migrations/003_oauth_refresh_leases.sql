CREATE TABLE oauth_refresh_leases (
    owner_uuid TEXT NOT NULL,
    provider TEXT NOT NULL CHECK (provider = 'openai'),
    lease_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    PRIMARY KEY (owner_uuid, provider),
    FOREIGN KEY (owner_uuid) REFERENCES users(user_uuid) ON DELETE CASCADE
);
