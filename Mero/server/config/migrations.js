const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const appliedVersions = new Set(db.prepare('SELECT version FROM schema_migrations').all().map(row => row.version));
  const migrations = fs.readdirSync(migrationsDir)
    .filter(name => /^\d+_[a-z0-9_]+\.sql$/.test(name))
    .sort()
    .map(name => ({ name, version: Number.parseInt(name, 10) }));

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, migration.name), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      if (migration.version === 2) {
        const missing = db.prepare('SELECT id FROM users WHERE user_uuid IS NULL').all();
        const assignUuid = db.prepare('UPDATE users SET user_uuid = ? WHERE id = ?');
        for (const user of missing) assignUuid.run(crypto.randomUUID(), user.id);
      }
      db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(migration.version, migration.name);
    })();
  }
}

module.exports = { runMigrations };
