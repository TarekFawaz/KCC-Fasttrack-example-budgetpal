import type Database from 'better-sqlite3';

/** Proves the database answers by reading the table the first migration creates. */
export function checkDatabase(db: Database.Database): void {
  db.prepare('SELECT 1 FROM app_meta LIMIT 1').get();
}
