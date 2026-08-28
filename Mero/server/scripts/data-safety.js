const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('util');
const Database = require('better-sqlite3');

function resolveInside(root, relativePath) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Path escapes root: ${relativePath}`);
  }
  return resolved;
}

function isInside(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  const file = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    while ((bytesRead = fs.readSync(file, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    fs.closeSync(file);
  }
  return hash.digest('hex');
}

function listFiles(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Attachment symlink is not allowed: ${absolute}`);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  walk(root);
  return files.sort();
}

function inventoryDatabase(database) {
  const tables = database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  return Object.fromEntries(tables.map(({ name }) => {
    const identifier = `"${name.replaceAll('"', '""')}"`;
    return [name, database.prepare(`SELECT COUNT(*) AS count FROM ${identifier}`).get().count];
  }));
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function createBackup({ databasePath, attachmentsPath, outputRoot }) {
  const sourceDatabase = path.resolve(databasePath);
  const sourceAttachments = path.resolve(attachmentsPath);
  const liveRoot = path.dirname(sourceDatabase);
  if (!fs.existsSync(sourceDatabase)) throw new Error(`Database not found: ${sourceDatabase}`);
  if (isInside(liveRoot, outputRoot)) throw new Error('Backup output must be outside the live database directory');

  fs.mkdirSync(outputRoot, { recursive: true });
  const backupDirectory = path.join(path.resolve(outputRoot), `mero-${timestamp()}`);
  fs.mkdirSync(backupDirectory);
  const backupDatabase = path.join(backupDirectory, 'database.sqlite');
  const source = new Database(sourceDatabase, { readonly: true, fileMustExist: true });
  let counts;
  try {
    counts = inventoryDatabase(source);
    await source.backup(backupDatabase);
  } finally {
    source.close();
  }

  const attachmentEntries = [];
  for (const sourceFile of listFiles(sourceAttachments)) {
    const relative = path.relative(sourceAttachments, sourceFile);
    const destination = resolveInside(path.join(backupDirectory, 'attachments'), relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(sourceFile, destination, fs.constants.COPYFILE_EXCL);
    attachmentEntries.push({ path: relative.replaceAll(path.sep, '/'), bytes: fs.statSync(destination).size, sha256: hashFile(destination) });
  }

  const manifest = {
    formatVersion: 1,
    service: 'mero',
    createdAt: new Date().toISOString(),
    database: { path: 'database.sqlite', bytes: fs.statSync(backupDatabase).size, sha256: hashFile(backupDatabase), counts },
    attachments: attachmentEntries,
  };
  fs.writeFileSync(path.join(backupDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  return { backupDirectory, manifest };
}

function readManifest(backupDirectory) {
  const manifest = JSON.parse(fs.readFileSync(resolveInside(backupDirectory, 'manifest.json'), 'utf8'));
  if (manifest?.formatVersion !== 1 || manifest?.service !== 'mero') throw new Error('Unsupported backup manifest');
  return manifest;
}

async function restoreBackup({ backupDirectory, targetDirectory }) {
  const started = process.hrtime.bigint();
  const backupRoot = path.resolve(backupDirectory);
  const targetRoot = path.resolve(targetDirectory || `${backupRoot}-restore-${timestamp()}`);
  if (fs.existsSync(targetRoot)) throw new Error(`Restore target already exists: ${targetRoot}`);
  const manifest = readManifest(backupRoot);
  const backupDatabase = resolveInside(backupRoot, manifest.database.path);
  if (hashFile(backupDatabase) !== manifest.database.sha256) throw new Error('Backup database hash mismatch');

  fs.mkdirSync(targetRoot, { recursive: false });
  try {
    const restoredDatabase = path.join(targetRoot, 'database.sqlite');
    const source = new Database(backupDatabase, { readonly: true, fileMustExist: true });
    try {
      await source.backup(restoredDatabase);
    } finally {
      source.close();
    }
    const restored = new Database(restoredDatabase, { readonly: true, fileMustExist: true });
    try {
      const counts = inventoryDatabase(restored);
      if (JSON.stringify(counts) !== JSON.stringify(manifest.database.counts)) throw new Error('Restored database row counts do not match manifest');
    } finally {
      restored.close();
    }

    for (const entry of manifest.attachments) {
      const sourceFile = resolveInside(path.join(backupRoot, 'attachments'), entry.path);
      if (hashFile(sourceFile) !== entry.sha256) throw new Error(`Backup attachment hash mismatch: ${entry.path}`);
      const destination = resolveInside(path.join(targetRoot, 'attachments'), entry.path);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(sourceFile, destination, fs.constants.COPYFILE_EXCL);
      if (hashFile(destination) !== entry.sha256) throw new Error(`Restored attachment hash mismatch: ${entry.path}`);
    }
  } catch (error) {
    fs.rmSync(targetRoot, { recursive: true, force: true });
    throw error;
  }

  return { targetDirectory: targetRoot, elapsedMs: Number(process.hrtime.bigint() - started) / 1e6 };
}

async function preflightMigration({ databasePath, attachmentsPath, outputRoot, targetDirectory }) {
  const backup = await createBackup({ databasePath, attachmentsPath, outputRoot });
  const restore = await restoreBackup({ backupDirectory: backup.backupDirectory, targetDirectory });
  const restoredDatabasePath = path.join(restore.targetDirectory, 'database.sqlite');
  const restored = new Database(restoredDatabasePath);
  try {
    restored.pragma('journal_mode = WAL');
    restored.pragma('busy_timeout = 5000');
    restored.pragma('foreign_keys = ON');
    const hasMigrationTable = restored.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'schema_migrations'").get();
    const before = new Set(hasMigrationTable ? restored.prepare('SELECT version FROM schema_migrations').all().map(row => row.version) : []);
    require('../config/migrations').runMigrations(restored);
    const versions = restored.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(row => row.version);
    return {
      ...restore,
      backupDirectory: backup.backupDirectory,
      appliedMigrations: versions.filter(version => !before.has(version)),
      counts: inventoryDatabase(restored),
      databaseSha256: hashFile(restoredDatabasePath),
    };
  } finally {
    restored.close();
  }
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      database: { type: 'string' },
      attachments: { type: 'string' },
      output: { type: 'string' },
      backup: { type: 'string' },
      target: { type: 'string' },
    },
  });
  const command = positionals[0];
  if (command === 'backup') {
    const result = await createBackup({
      databasePath: values.database || process.env.DATABASE_PATH || path.join(__dirname, '..', 'database.sqlite'),
      attachmentsPath: values.attachments || process.env.UPLOADS_PATH || path.join(__dirname, '..', 'uploads'),
      outputRoot: values.output || path.join(__dirname, '..', '..', 'backups'),
    });
    console.log(JSON.stringify(result));
    return;
  }
  if (command === 'restore' && values.backup) {
    console.log(JSON.stringify(await restoreBackup({ backupDirectory: values.backup, targetDirectory: values.target })));
    return;
  }
  if (command === 'preflight') {
    console.log(JSON.stringify(await preflightMigration({
      databasePath: values.database || process.env.DATABASE_PATH || path.join(__dirname, '..', 'database.sqlite'),
      attachmentsPath: values.attachments || process.env.UPLOADS_PATH || path.join(__dirname, '..', 'uploads'),
      outputRoot: values.output || path.join(__dirname, '..', '..', 'backups'),
      targetDirectory: values.target,
    })));
    return;
  }
  throw new Error('Usage: data-safety.js backup|preflight [--database path --attachments path --output path --target path] | restore --backup path [--target path]');
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { createBackup, preflightMigration, restoreBackup };
