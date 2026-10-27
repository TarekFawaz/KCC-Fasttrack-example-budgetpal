import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb } from '../../kernel/db/index.js';
import { runMigrations } from '../../kernel/db/migrate.js';
import { insertUser } from '../auth/auth.repository.js';
import {
  CategoryInUseError,
  DuplicateNameError,
  create,
  findById,
  list,
  remove,
  update,
} from './categories.repository.js';

const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));

let db: Database.Database;
let userA: number;
let userB: number;

const addUser = (email: string): number => {
  const user = insertUser(db, { email, passwordHash: 'not-a-real-hash', now: Date.now() });
  if (!user) throw new Error('user exists');
  return user.id;
};

beforeEach(() => {
  db = openDb(':memory:');
  runMigrations(db, migrationsDir);
  userA = addUser('a@example.test');
  userB = addUser('b@example.test');
});
afterEach(() => {
  db.close();
});

describe('migration 0030-categories.sql', () => {
  it('T-001 file is 0030-categories.sql, has no REAL/FLOAT columns and defines the table, CHECK and unique index', () => {
    const files = readdirSync(migrationsDir).filter((name) => name.startsWith('0030-'));
    expect(files).toEqual(['0030-categories.sql']);
    const sql = readFileSync(`${migrationsDir}/0030-categories.sql`, 'utf8');
    expect(sql).not.toMatch(/\b(real|float|numeric|decimal)\b/i);

    const columns = db.prepare("SELECT name, type, \"notnull\" FROM pragma_table_info('categories')").all() as Array<{
      name: string;
      type: string;
      notnull: number;
    }>;
    expect(columns.map((c) => c.name)).toEqual(['id', 'user_id', 'name', 'kind', 'created_at']);
    expect(columns.filter((c) => c.name !== 'id').every((c) => c.notnull === 1)).toBe(true);

    const tableSql = (db.prepare("SELECT sql FROM sqlite_master WHERE name = 'categories'").get() as { sql: string }).sql;
    expect(tableSql).toMatch(/CHECK\s*\(\s*kind IN \('expense', 'income'\)\s*\)/);
    expect(() =>
      db.prepare("INSERT INTO categories (user_id, name, kind, created_at) VALUES (?, 'x', 'other', 'now')").run(userA),
    ).toThrow(/CHECK/);

    const indexes = db.prepare("SELECT name, \"unique\" FROM pragma_index_list('categories')").all() as Array<{
      name: string;
      unique: number;
    }>;
    const unique = indexes.find((i) => i.name === 'categories_user_name');
    expect(unique?.unique).toBe(1);
    const indexSql = (db.prepare("SELECT sql FROM sqlite_master WHERE name = 'categories_user_name'").get() as { sql: string }).sql;
    expect(indexSql).toMatch(/\(user_id, name COLLATE NOCASE\)/);
  });

  it('T-002 the runner applies 0030 once on an empty database, a second run is a no-op, and deleting a user cascades', () => {
    const fresh = openDb(':memory:');
    try {
      const first = runMigrations(fresh, migrationsDir);
      expect(first).toContain('0030-categories.sql');
      expect(runMigrations(fresh, migrationsDir)).toEqual([]);

      const user = fresh
        .prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)')
        .run('c@example.test', 'h', Date.now());
      const id = Number(user.lastInsertRowid);
      create(fresh, id, { name: 'Food', kind: 'expense' });
      expect(list(fresh, id)).toHaveLength(1);
      fresh.prepare('DELETE FROM users WHERE id = ?').run(id);
      const left = fresh.prepare('SELECT COUNT(*) AS n FROM categories').get() as { n: number };
      expect(left.n).toBe(0);
    } finally {
      fresh.close();
    }
  });
});

describe('categories.repository', () => {
  it('T-003 "food" after "Food" throws DuplicateNameError for the same user; another user may reuse the name', () => {
    create(db, userA, { name: 'Food', kind: 'expense' });
    expect(() => create(db, userA, { name: 'food', kind: 'expense' })).toThrow(DuplicateNameError);
    expect(list(db, userA)).toHaveLength(1);
    expect(create(db, userB, { name: 'Food', kind: 'expense' }).name).toBe('Food');
  });

  it('T-003 update to another category name in a different case throws DuplicateNameError; own name is allowed', () => {
    const food = create(db, userA, { name: 'Food', kind: 'expense' });
    const pay = create(db, userA, { name: 'Pay', kind: 'income' });
    expect(() => update(db, userA, pay.id, { name: 'FOOD' })).toThrow(DuplicateNameError);
    expect(findById(db, userA, pay.id)?.name).toBe('Pay');
    expect(update(db, userA, food.id, { name: 'FOOD' })?.name).toBe('FOOD');
  });

  it('T-004 list returns only the caller\'s rows ordered by name; other users\' ids give nothing/false', () => {
    const zed = create(db, userA, { name: 'Zed', kind: 'expense' });
    create(db, userA, { name: 'apple', kind: 'income' });
    create(db, userA, { name: 'Bread', kind: 'expense' });
    const theirs = create(db, userB, { name: 'Other', kind: 'expense' });

    expect(list(db, userA).map((c) => c.name)).toEqual(['apple', 'Bread', 'Zed']);
    expect(list(db, userB).map((c) => c.name)).toEqual(['Other']);

    expect(findById(db, userA, theirs.id)).toBeUndefined();
    expect(update(db, userA, theirs.id, { name: 'Hacked' })).toBeUndefined();
    expect(remove(db, userA, theirs.id)).toBe(false);
    expect(findById(db, userB, theirs.id)).toEqual(theirs);
    expect(findById(db, userA, zed.id)?.kind).toBe('expense');
  });

  it('T-004 update changes only the given fields and remove deletes an unused row', () => {
    const row = create(db, userA, { name: 'Food', kind: 'expense' });
    expect(update(db, userA, row.id, { kind: 'income' })).toMatchObject({ name: 'Food', kind: 'income' });
    expect(update(db, userA, row.id, { name: 'Meals' })).toMatchObject({ name: 'Meals', kind: 'income' });
    expect(remove(db, userA, row.id)).toBe(true);
    expect(findById(db, userA, row.id)).toBeUndefined();
  });

  it('T-005 remove throws CategoryInUseError when a RESTRICT row references the category, and the row stays', () => {
    const row = create(db, userA, { name: 'Food', kind: 'expense' });
    db.exec(
      'CREATE TABLE referencing_rows (id INTEGER PRIMARY KEY, category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT)',
    );
    db.prepare('INSERT INTO referencing_rows (category_id) VALUES (?)').run(row.id);

    expect(() => remove(db, userA, row.id)).toThrow(CategoryInUseError);
    expect(findById(db, userA, row.id)).toEqual(row);

    db.prepare('DELETE FROM referencing_rows').run();
    expect(remove(db, userA, row.id)).toBe(true);
  });
});
