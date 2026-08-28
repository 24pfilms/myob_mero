const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

process.env.DATABASE_PATH = ':memory:';
const { initializeDatabase } = require('../config/database');

test('seeded legacy database migrates transactionally without data loss', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mero-migration-'));
  const databasePath = path.join(directory, 'legacy.db');
  const database = new Database(databasePath);
  try {
    const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'legacy_database.sql'), 'utf8');
    database.exec(fixture);

    initializeDatabase(database);
    initializeDatabase(database);

    assert.equal(database.pragma('journal_mode', { simple: true }), 'wal');
    assert.equal(database.pragma('busy_timeout', { simple: true }), 5000);
    assert.equal(database.pragma('foreign_keys', { simple: true }), 1);
    assert.deepEqual(database.prepare('SELECT version, name FROM schema_migrations ORDER BY version').all(), [
      { version: 1, name: '001_initial.sql' },
      { version: 2, name: '002_user_uuid_credentials.sql' },
      { version: 3, name: '003_oauth_refresh_leases.sql' },
    ]);
    const user = database.prepare('SELECT user_uuid, username FROM users WHERE id = 1').get();
    assert.equal(user.username, 'legacy-user');
    assert.match(user.user_uuid, /^[0-9a-f-]{36}$/i);
    assert.equal(database.prepare('SELECT name FROM boards WHERE board_id = ?').get('legacy-board').name, 'Preserved board');
    assert.throws(
      () => database.prepare('UPDATE users SET user_uuid = ? WHERE id = 1').run('00000000-0000-4000-8000-000000000000'),
      /user_uuid is immutable/
    );
  } finally {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
