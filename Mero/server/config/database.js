const path = require('path');
const Database = require('better-sqlite3');
const { runMigrations } = require('./migrations');

function getServerRoot() {
  return path.resolve(__dirname, '..');
}

function getDatabasePath() {
  const configured = process.env.DATABASE_PATH;
  const dbPath = configured && configured.trim().length > 0 ? configured : './database.sqlite';
  if (dbPath === ':memory:') return ':memory:';
  return path.isAbsolute(dbPath) ? dbPath : path.resolve(getServerRoot(), dbPath);
}


function initializeDatabase(db) {
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
}

const db = new Database(getDatabasePath());
initializeDatabase(db);

module.exports = { db, getDatabasePath, initializeDatabase, runMigrations };
