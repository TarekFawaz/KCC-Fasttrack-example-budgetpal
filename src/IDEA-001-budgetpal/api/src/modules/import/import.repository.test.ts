import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb } from '../../kernel/db/index.js';
import { runMigrations } from '../../kernel/db/migrate.js';
import { dedupeKey } from './import.dedupe.js';
import * as repo from './import.repository.js';

const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));
const moduleDir = fileURLToPath(new URL('.', import.meta.url));

let db: Database.Database;
let tempDir: string | undefined;
let userA: number;
let userB: number;
let accountA: number;
let accountB: number;
let expenseA: number;
let incomeA: number;
let expenseB: number;

const addUser = (email: string): number =>
  Number(
    db
      .prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)')
      .run(email, 'not-a-real-hash', Date.now()).lastInsertRowid,
  );
const addAccount = (userId: number): number =>
  Number(
    db
      .prepare(
        'INSERT INTO accounts (user_id, name, type, opening_balance_minor, created_at, updated_at) VALUES (?, ?, ?, 0, 1, 1)',
      )
      .run(userId, `acct-${userId}`, 'checking').lastInsertRowid,
  );
const addCategory = (userId: number, kind: 'expense' | 'income'): number =>
  Number(
    db
      .prepare('INSERT INTO categories (user_id, name, kind, created_at) VALUES (?, ?, ?, ?)')
      .run(userId, `${kind}-${userId}`, kind, '2026-01-01T00:00:00.000Z').lastInsertRowid,
  );

const row = (userId: number, accountId: number, categoryId: number, description = 'Coffee', amountMinor = 1250) => ({
  categoryId,
  occurredOn: '2026-03-01',
  amountMinor,
  description,
  dedupeKey: dedupeKey({ userId, accountId, date: '2026-03-01', amountMinor: -amountMinor, description }),
});

const count = (userId?: number): number => {
  const result =
    userId === undefined
      ? db.prepare('SELECT COUNT(*) AS n FROM transactions').get()
      : db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE user_id = ?').get(userId);
  return (result as { n: number }).n;
};

beforeEach(() => {
  db = openDb(':memory:');
  runMigrations(db, migrationsDir);
  userA = addUser('a@example.test');
  userB = addUser('b@example.test');
  accountA = addAccount(userA);
  accountB = addAccount(userB);
  expenseA = addCategory(userA, 'expense');
  incomeA = addCategory(userA, 'income');
  expenseB = addCategory(userB, 'expense');
});
afterEach(() => {
  db.close();
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe('T-008 migration 0060 (Enabler-002 AC-1)', () => {
  it('T-008 adds dedupe_key and the partial unique index, leaving older rows untouched', () => {
    // Apply only the migrations below 0060, store a row, then apply 0060 on top.
    tempDir = mkdtempSync(join(tmpdir(), 'budgetpal-mig-'));
    const older = join(tempDir, 'older');
    mkdirSync(older);
    for (const name of readdirSync(migrationsDir).filter((file) => file < '0060')) {
      copyFileSync(join(migrationsDir, name), join(older, name));
    }
    const legacy = openDb(':memory:');
    try {
      runMigrations(legacy, older);
      legacy.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)').run('l@example.test', 'x', 1);
      legacy
        .prepare(
          'INSERT INTO accounts (user_id, name, type, opening_balance_minor, created_at, updated_at) VALUES (1, ?, ?, 0, 1, 1)',
        )
        .run('legacy', 'cash');
      legacy.prepare('INSERT INTO categories (user_id, name, kind, created_at) VALUES (1, ?, ?, ?)').run('c', 'expense', 'x');
      legacy
        .prepare(
          'INSERT INTO transactions (user_id, account_id, category_id, occurred_on, amount_minor, description, created_at, updated_at) VALUES (1, 1, 1, ?, 500, ?, ?, ?)',
        )
        .run('2026-01-01', 'old row', 'x', 'x');
      const before = legacy.prepare('SELECT * FROM transactions').all();

      expect(runMigrations(legacy, migrationsDir)).toEqual(['0060-import-dedupe.sql']);

      const columns = legacy
        .prepare('SELECT name, type, "notnull" FROM pragma_table_info(\'transactions\')')
        .all() as Array<{ name: string; type: string; notnull: number }>;
      expect(columns.find((column) => column.name === 'dedupe_key')).toEqual({
        name: 'dedupe_key',
        type: 'TEXT',
        notnull: 0,
      });
      const index = legacy
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'transactions' AND sql LIKE '%dedupe_key%'",
        )
        .get() as { sql: string };
      expect(index.sql).toMatch(/UNIQUE INDEX/i);
      expect(index.sql).toMatch(/\(user_id, dedupe_key\)/);
      expect(index.sql).toMatch(/WHERE dedupe_key IS NOT NULL/i);

      const after = legacy.prepare('SELECT * FROM transactions').all() as Array<Record<string, unknown>>;
      expect(after).toHaveLength(1);
      expect(after[0]).toMatchObject({ ...(before[0] as object), dedupe_key: null });
    } finally {
      legacy.close();
    }
  });

  it('T-008 several rows with a NULL key do not collide', () => {
    const insert = db.prepare(
      'INSERT INTO transactions (user_id, account_id, category_id, occurred_on, amount_minor, description, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)',
    );
    insert.run(userA, accountA, expenseA, '2026-01-01', 'manual', 'x', 'x');
    insert.run(userA, accountA, expenseA, '2026-01-01', 'manual', 'x', 'x');
    expect(count(userA)).toBe(2);
  });
});

describe('T-009 accountBelongsToUser (Enabler-002 AC-2)', () => {
  it('T-009 true for the owner, false for another user and for an unknown id', () => {
    expect(repo.accountBelongsToUser(db, userA, accountA)).toBe(true);
    expect(repo.accountBelongsToUser(db, userA, accountB)).toBe(false);
    expect(repo.accountBelongsToUser(db, userB, accountA)).toBe(false);
    expect(repo.accountBelongsToUser(db, userA, 9999)).toBe(false);
  });
});

describe('T-010 insertBatch reports per-row outcomes (Enabler-002 AC-3)', () => {
  it('T-010 in-batch and cross-batch duplicates', () => {
    const first = repo.insertBatch(db, userA, accountA, [
      row(userA, accountA, expenseA, 'Coffee'),
      row(userA, accountA, expenseA, 'Coffee'),
      row(userA, accountA, expenseA, 'Bread', 300),
    ]);
    expect(first).toEqual(['inserted', 'duplicate', 'inserted']);
    expect(count(userA)).toBe(2);

    const second = repo.insertBatch(db, userA, accountA, [
      row(userA, accountA, expenseA, 'Coffee'),
      row(userA, accountA, expenseA, 'Bread', 300),
      row(userA, accountA, expenseA, 'Milk', 100),
    ]);
    expect(second).toEqual(['duplicate', 'duplicate', 'inserted']);
    expect(count(userA)).toBe(3);
  });

  it('T-010 stores integer minor units, the account and the dedupe key', () => {
    repo.insertBatch(db, userA, accountA, [row(userA, accountA, expenseA, 'Coffee')], '2026-03-02T00:00:00.000Z');
    const stored = db.prepare('SELECT * FROM transactions').get() as Record<string, unknown>;
    expect(stored).toMatchObject({
      user_id: userA,
      account_id: accountA,
      category_id: expenseA,
      occurred_on: '2026-03-01',
      amount_minor: 1250,
      description: 'Coffee',
      created_at: '2026-03-02T00:00:00.000Z',
    });
    expect(typeof stored.dedupe_key).toBe('string');
    expect(db.prepare('SELECT typeof(amount_minor) AS t FROM transactions').get()).toEqual({ t: 'integer' });
  });

  it('T-010 an empty batch is a no-op', () => {
    expect(repo.insertBatch(db, userA, accountA, [])).toEqual([]);
  });
});

describe('T-011 insertBatch is atomic (Enabler-002 AC-3)', () => {
  it('T-011 a failing row rolls back every earlier row', () => {
    const rows = [
      row(userA, accountA, expenseA, 'Coffee'),
      row(userA, accountA, expenseA, 'Bread', 300),
      { ...row(userA, accountA, expenseA, 'Broken', 100), amountMinor: 0 }, // violates CHECK (amount_minor > 0)
    ];
    expect(() => repo.insertBatch(db, userA, accountA, rows)).toThrow(/CHECK constraint/);
    expect(count()).toBe(0);
  });
});

describe('T-012 the key is per user (Enabler-002 AC-4)', () => {
  it('T-012 the same row for two users stores two rows', () => {
    const a = repo.insertBatch(db, userA, accountA, [row(userA, accountA, expenseA)]);
    const b = repo.insertBatch(db, userB, accountB, [row(userB, accountB, expenseB)]);
    expect([a, b]).toEqual([['inserted'], ['inserted']]);
    expect(count(userA)).toBe(1);
    expect(count(userB)).toBe(1);
  });

  it('T-012 an identical stored key under two users is allowed, under one user it is not', () => {
    const insert = db.prepare(
      "INSERT INTO transactions (user_id, account_id, category_id, occurred_on, amount_minor, description, dedupe_key, created_at, updated_at) VALUES (?, ?, ?, '2026-01-01', 1, 'x', 'same', 'x', 'x')",
    );
    insert.run(userA, accountA, expenseA);
    insert.run(userB, accountB, expenseB);
    expect(() => insert.run(userA, accountA, expenseA)).toThrow(/UNIQUE constraint/);
  });
});

describe('T-013 static layout (Enabler-002 AC-5)', () => {
  it('T-013 the migration uses INTEGER money and no REAL, FLOAT or DECIMAL', () => {
    const sql = readFileSync(join(migrationsDir, '0060-import-dedupe.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(REAL|FLOAT|DOUBLE|DECIMAL|NUMERIC)\b/i);
  });

  it('T-013 the repository binds values with placeholders only', () => {
    const source = readFileSync(join(moduleDir, 'import.repository.ts'), 'utf8');
    expect(source).not.toMatch(/\$\{/);
    expect(source).toMatch(/ON CONFLICT DO NOTHING/);
  });

  it('T-013 no .prepare outside *.repository.ts in the module', () => {
    const offenders = readdirSync(moduleDir)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.repository.ts'))
      .filter((file) => /\.prepare\(|\bdb\.exec\(/.test(readFileSync(join(moduleDir, file), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('T-013 the repository does not import another module (GR-006)', () => {
    const source = readFileSync(join(moduleDir, 'import.repository.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"][^'"]*(transactions|accounts|categories)\//);
  });
});

describe('T-014 categoryHasKind (Enabler-002 A-1)', () => {
  it('T-014 true only for an own category of the asked kind', () => {
    expect(repo.categoryHasKind(db, userA, expenseA, 'expense')).toBe(true);
    expect(repo.categoryHasKind(db, userA, incomeA, 'income')).toBe(true);
    expect(repo.categoryHasKind(db, userA, expenseA, 'income')).toBe(false);
    expect(repo.categoryHasKind(db, userA, incomeA, 'expense')).toBe(false);
    expect(repo.categoryHasKind(db, userA, expenseB, 'expense')).toBe(false);
    expect(repo.categoryHasKind(db, userA, 9999, 'expense')).toBe(false);
  });
});
