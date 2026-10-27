import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';

/**
 * Opens the SQLite database, creating its parent folder first.
 * WAL keeps readers and the single writer from blocking each other; foreign
 * keys are off by default in SQLite and must be enabled per connection.
 */
export function openDb(path: string): Database.Database {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}
