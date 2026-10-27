import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';

/** `0001-init.sql`: four digits, kebab-case name. Forward-only, no down files. */
export const MIGRATION_NAME = /^\d{4}-[a-z0-9-]+\.sql$/;

export class MigrationError extends Error {
  readonly file: string;
  constructor(file: string, message: string, options?: ErrorOptions) {
    super(`Migration ${file}: ${message}`, options);
    this.name = 'MigrationError';
    this.file = file;
  }
}

interface AppliedRow {
  name: string;
  sha256: string;
}

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

function listMigrationFiles(dir: string): string[] {
  const names = readdirSync(dir).filter((entry) => statSync(join(dir, entry)).isFile());
  for (const name of names) {
    if (!MIGRATION_NAME.test(name)) {
      throw new MigrationError(name, 'file name must match NNNN-name.sql (lowercase, digits, hyphens)');
    }
  }
  // Four-digit zero-padded names sort numerically as plain strings.
  return names.sort();
}

/**
 * Applies every pending `*.sql` file in `dir` in numeric order, one transaction
 * per file (the file and its `_migrations` row commit or roll back together).
 * An already-applied file whose content changed aborts with its name.
 * Returns the names applied in this run.
 */
export function runMigrations(db: Database.Database, dir: string): string[] {
  db.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (
       name TEXT PRIMARY KEY,
       sha256 TEXT NOT NULL,
       applied_at TEXT NOT NULL
     )`,
  );

  const applied = new Map<string, string>(
    (db.prepare('SELECT name, sha256 FROM _migrations').all() as AppliedRow[]).map((row) => [
      row.name,
      row.sha256,
    ]),
  );
  const record = db.prepare('INSERT INTO _migrations (name, sha256, applied_at) VALUES (?, ?, ?)');
  const newlyApplied: string[] = [];

  for (const name of listMigrationFiles(dir)) {
    const sql = readFileSync(join(dir, name), 'utf8');
    const checksum = sha256(sql);
    const previous = applied.get(name);
    if (previous !== undefined) {
      if (previous !== checksum) {
        throw new MigrationError(name, 'file changed after it was applied (checksum mismatch)');
      }
      continue;
    }
    try {
      db.transaction(() => {
        db.exec(sql);
        record.run(name, checksum, new Date().toISOString());
      })();
    } catch (error) {
      throw new MigrationError(name, `failed and was rolled back: ${(error as Error).message}`, {
        cause: error,
      });
    }
    newlyApplied.push(name);
  }
  return newlyApplied;
}
