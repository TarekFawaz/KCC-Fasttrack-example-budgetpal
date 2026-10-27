import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb } from '../src/kernel/db/index.js';
import { MigrationError, runMigrations } from '../src/kernel/db/migrate.js';

const realMigrations = fileURLToPath(new URL('../migrations', import.meta.url));

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'bp-db-'));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

const migrationsDir = (files: Record<string, string>): string => {
  const dir = join(tmp, 'migrations');
  mkdirSync(dir, { recursive: true });
  for (const [name, sql] of Object.entries(files)) writeFileSync(join(dir, name), sql);
  return dir;
};

describe('openDb', () => {
  it('T-017 creates a missing nested folder and enables WAL and foreign keys', () => {
    const db = openDb(join(tmp, 'a', 'b', 'x.db'));
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    db.close();
  });
});

describe('runMigrations', () => {
  it('T-018 applies 0001-init.sql, creates app_meta and records name and sha256', () => {
    const db = openDb(join(tmp, 'm.db'));
    // Later specs add their own files (0010 auth, ...); 0001 is always applied first.
    expect(runMigrations(db, realMigrations)[0]).toBe('0001-init.sql');
    db.prepare("INSERT INTO app_meta (key, value) VALUES ('k', 'v')").run();
    const row = db.prepare("SELECT name, sha256 FROM _migrations WHERE name = '0001-init.sql'").get() as { name: string; sha256: string };
    expect(row.name).toBe('0001-init.sql');
    expect(row.sha256).toMatch(/^[0-9a-f]{64}$/);
    db.close();
  });

  it('T-018 applies in numeric order and rolls a failing file back', () => {
    const dir = migrationsDir({
      '0002-b.sql': 'CREATE TABLE b (id INTEGER); INSERT INTO a VALUES (1);',
      '0001-a.sql': 'CREATE TABLE a (id INTEGER);',
    });
    const db = new Database(':memory:');
    expect(runMigrations(db, dir)).toEqual(['0001-a.sql', '0002-b.sql']);

    writeFileSync(join(dir, '0003-bad.sql'), 'CREATE TABLE c (id INTEGER); SELECT * FROM missing_table;');
    expect(() => runMigrations(db, dir)).toThrow(MigrationError);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'c'").all()).toHaveLength(0);
    expect(db.prepare("SELECT name FROM _migrations WHERE name = '0003-bad.sql'").all()).toHaveLength(0);
    db.close();
  });

  it('T-019 re-run applies nothing, a changed applied file fails naming it, bad names are rejected', () => {
    const dir = migrationsDir({ '0001-a.sql': 'CREATE TABLE a (id INTEGER);' });
    const db = new Database(':memory:');
    expect(runMigrations(db, dir)).toEqual(['0001-a.sql']);
    expect(runMigrations(db, dir)).toEqual([]);

    writeFileSync(join(dir, '0001-a.sql'), 'CREATE TABLE a (id INTEGER, extra TEXT);');
    expect(() => runMigrations(db, dir)).toThrow(/0001-a\.sql.*checksum/);

    writeFileSync(join(dir, '0001-a.sql'), 'CREATE TABLE a (id INTEGER);');
    writeFileSync(join(dir, 'init.sql'), 'SELECT 1;');
    expect(() => runMigrations(db, dir)).toThrow(/init\.sql/);
    db.close();
  });
});
