const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const { createBackup, preflightMigration, restoreBackup } = require('../scripts/data-safety');

test('online backup restores seeded database and attachments into a separate target', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mero-backup-'));
  const live = path.join(root, 'live');
  const attachments = path.join(live, 'uploads');
  const backupRoot = path.join(root, 'backups');
  const restoreTarget = path.join(root, 'verified-restore');
  fs.mkdirSync(attachments, { recursive: true });
  fs.writeFileSync(path.join(attachments, 'proof.txt'), 'attachment-before-backup');
  const databasePath = path.join(live, 'database.sqlite');
  const database = new Database(databasePath);
  database.exec('CREATE TABLE notes (id TEXT PRIMARY KEY, content TEXT NOT NULL); INSERT INTO notes VALUES (\'note-1\', \'before-backup\');');
  database.pragma('journal_mode = WAL');

  try {
    const backup = await createBackup({ databasePath, attachmentsPath: attachments, outputRoot: backupRoot });
    database.prepare('UPDATE notes SET content = ? WHERE id = ?').run('after-backup', 'note-1');
    fs.writeFileSync(path.join(attachments, 'proof.txt'), 'attachment-after-backup');

    const restored = await restoreBackup({ backupDirectory: backup.backupDirectory, targetDirectory: restoreTarget });
    assert.ok(restored.elapsedMs >= 0);
    const restoredDatabase = new Database(path.join(restoreTarget, 'database.sqlite'), { readonly: true });
    try {
      assert.equal(restoredDatabase.prepare('SELECT content FROM notes WHERE id = ?').get('note-1').content, 'before-backup');
    } finally {
      restoredDatabase.close();
    }
    assert.equal(fs.readFileSync(path.join(restoreTarget, 'attachments', 'proof.txt'), 'utf8'), 'attachment-before-backup');
    assert.equal(backup.manifest.database.counts.notes, 1);
    assert.equal(backup.manifest.attachments.length, 1);
  } finally {
    database.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('migration preflight backs up, restores, and migrates only the restored legacy database', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mero-preflight-'));
  const live = path.join(root, 'live');
  fs.mkdirSync(live);
  const databasePath = path.join(live, 'database.sqlite');
  const database = new Database(databasePath);
  database.exec(fs.readFileSync(path.join(__dirname, 'fixtures', 'legacy_database.sql'), 'utf8'));
  database.close();
  try {
    const result = await preflightMigration({
      databasePath,
      attachmentsPath: path.join(live, 'uploads'),
      outputRoot: path.join(root, 'backups'),
      targetDirectory: path.join(root, 'migration-copy'),
    });
    assert.deepEqual(result.appliedMigrations, [1, 2, 3]);
    assert.equal(result.counts.users, 1);
    assert.equal(result.counts.boards, 1);
    assert.ok(result.elapsedMs >= 0);
    const original = new Database(databasePath, { readonly: true });
    try {
      assert.equal(original.prepare("SELECT 1 FROM sqlite_schema WHERE name = 'schema_migrations'").get(), undefined);
    } finally {
      original.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('backup refuses an output directory inside the live database directory', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mero-backup-boundary-'));
  const databasePath = path.join(root, 'database.sqlite');
  const database = new Database(databasePath);
  database.exec('CREATE TABLE proof (id INTEGER PRIMARY KEY);');
  database.close();
  try {
    await assert.rejects(
      createBackup({ databasePath, attachmentsPath: path.join(root, 'uploads'), outputRoot: path.join(root, 'backups') }),
      /outside the live database directory/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
