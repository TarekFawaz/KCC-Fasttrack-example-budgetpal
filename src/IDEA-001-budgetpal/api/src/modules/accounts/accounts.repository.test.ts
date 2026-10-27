import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb } from '../../kernel/db/index.js';
import { runMigrations } from '../../kernel/db/migrate.js';
import * as repo from './accounts.repository.js';
import { DuplicateName, InUse } from './accounts.repository.js';
import { createAccountSchema, MAX_BALANCE_MINOR, updateAccountSchema } from './accounts.schemas.js';

const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));
const srcDir = fileURLToPath(new URL('../..', import.meta.url));

let db: Database.Database;
let userA: number;
let userB: number;

const addUser = (email: string): number =>
  Number(
    db
      .prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)')
      .run(email, 'not-a-real-hash', Date.now()).lastInsertRowid,
  );

const input = (name: string, openingBalanceMinor = 0) => ({ name, type: 'checking' as const, openingBalanceMinor });

beforeEach(() => {
  db = openDb(':memory:');
  runMigrations(db, migrationsDir);
  userA = addUser('a@example.test');
  userB = addUser('b@example.test');
});
afterEach(() => {
  db.close();
});

describe('accounts migration', () => {
  it('T-001 creates the accounts table with integer money, a type CHECK and a unique NOCASE index', () => {
    const columns = db.prepare('PRAGMA table_info(accounts)').all() as Array<{
      name: string;
      type: string;
      notnull: number;
    }>;
    const byName = new Map(columns.map((c) => [c.name, c]));
    expect([...byName.keys()].sort()).toEqual(
      ['created_at', 'id', 'name', 'opening_balance_minor', 'type', 'updated_at', 'user_id'].sort(),
    );
    expect(byName.get('opening_balance_minor')?.type).toBe('INTEGER');
    expect(byName.get('opening_balance_minor')?.notnull).toBe(1);
    for (const column of columns) expect(column.type).not.toMatch(/REAL|FLOA|DOUB|DECIMAL|NUMERIC/i);

    const fks = db.prepare('PRAGMA foreign_key_list(accounts)').all() as Array<{ table: string; from: string }>;
    expect(fks).toEqual([expect.objectContaining({ table: 'users', from: 'user_id' })]);

    const indexes = db.prepare('PRAGMA index_list(accounts)').all() as Array<{ name: string; unique: number }>;
    const unique = indexes.find((i) => i.unique === 1 && i.name === 'accounts_user_id_name');
    expect(unique).toBeDefined();
    const sql = (
      db.prepare("SELECT sql FROM sqlite_master WHERE name = 'accounts_user_id_name'").get() as { sql: string }
    ).sql;
    expect(sql).toMatch(/user_id,\s*name COLLATE NOCASE/i);

    expect(() =>
      db
        .prepare(
          "INSERT INTO accounts (user_id, name, type, created_at, updated_at) VALUES (?, 'x', 'brokerage', 1, 1)",
        )
        .run(userA),
    ).toThrow(/CHECK/i);
    const ok = db
      .prepare("INSERT INTO accounts (user_id, name, type, created_at, updated_at) VALUES (?, 'x', 'cash', 1, 1)")
      .run(userA);
    expect(
      (db.prepare('SELECT opening_balance_minor AS v FROM accounts WHERE id = ?').get(ok.lastInsertRowid) as { v: number }).v,
    ).toBe(0);
  });
});

describe('accounts repository', () => {
  it('T-002 scopes every function by user id', () => {
    const a = repo.create(db, userA, input('Main', 500));
    expect(repo.list(db, userA)).toEqual([a]);

    expect(repo.list(db, userB)).toEqual([]);
    expect(repo.findById(db, userB, a.id)).toBeUndefined();
    expect(repo.update(db, userB, a.id, input('Hijacked', 1))).toBeUndefined();
    expect(repo.remove(db, userB, a.id)).toBe(false);

    expect(repo.findById(db, userA, a.id)).toEqual(a);
    expect(repo.remove(db, userA, a.id)).toBe(true);
    expect(repo.list(db, userA)).toEqual([]);
  });

  it('T-002 takes userId as the first argument after the handle and filters every statement by user_id', () => {
    const source = readFileSync(fileURLToPath(new URL('./accounts.repository.ts', import.meta.url)), 'utf8');
    for (const fn of ['list', 'findById', 'create', 'update', 'remove']) {
      expect(source).toMatch(new RegExp(`export function ${fn}\\(\\s*db: Database\\.Database,\\s*userId: number`));
    }
    const statements = [...source.matchAll(/\.prepare\(\s*(`[^`]*`|'[^']*')/g)].map((m) => m[1] ?? '');
    expect(statements.length).toBeGreaterThanOrEqual(5);
    for (const statement of statements) {
      expect(statement).toContain('user_id');
    }
  });

  it('T-002 returns accounts ordered by name ignoring case', () => {
    repo.create(db, userA, input('savings'));
    repo.create(db, userA, input('Cash'));
    repo.create(db, userA, input('brokerage'));
    expect(repo.list(db, userA).map((a) => a.name)).toEqual(['brokerage', 'Cash', 'savings']);
  });

  it('T-003 rejects the same name in another case or with spaces, on create and update', () => {
    repo.create(db, userA, input('Savings'));
    expect(() => repo.create(db, userA, input(' savings '))).toThrow(DuplicateName);
    expect(() => repo.create(db, userA, input('SAVINGS'))).toThrow(DuplicateName);

    const other = repo.create(db, userA, input('Current'));
    expect(() => repo.update(db, userA, other.id, input(' savings '))).toThrow(DuplicateName);
    expect(repo.findById(db, userA, other.id)?.name).toBe('Current');
    expect(repo.list(db, userA)).toHaveLength(2);

    // Renaming an account to its own name in another case is not a clash.
    expect(repo.update(db, userA, other.id, input('CURRENT'))?.name).toBe('CURRENT');
  });

  it('T-003 lets another user use the same name', () => {
    repo.create(db, userA, input('Savings'));
    expect(repo.create(db, userB, input('savings')).name).toBe('savings');
  });

  it('T-003 stores the trimmed name and updates the timestamp and values', () => {
    const created = repo.create(db, userA, input('  Wallet  ', 100), 1_000);
    expect(created).toMatchObject({ name: 'Wallet', openingBalanceMinor: 100, createdAt: 1_000, updatedAt: 1_000 });
    const updated = repo.update(db, userA, created.id, { name: 'Purse', type: 'cash', openingBalanceMinor: -250 }, 2_000);
    expect(updated).toMatchObject({
      id: created.id,
      name: 'Purse',
      type: 'cash',
      openingBalanceMinor: -250,
      createdAt: 1_000,
      updatedAt: 2_000,
    });
  });

  it('T-004 maps a RESTRICT foreign-key failure on delete to InUse and keeps the row', () => {
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    // Test-only stand-in for SPEC-005's transactions.account_id (never a migration).
    db.exec('CREATE TABLE t_ref (id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT)');
    const account = repo.create(db, userA, input('Used'));
    db.prepare('INSERT INTO t_ref (account_id) VALUES (?)').run(account.id);

    expect(() => repo.remove(db, userA, account.id)).toThrow(InUse);
    expect(repo.findById(db, userA, account.id)).toEqual(account);

    db.prepare('DELETE FROM t_ref').run();
    expect(repo.remove(db, userA, account.id)).toBe(true);
  });
});

describe('accounts schemas', () => {
  const valid = { name: 'Savings', type: 'savings', openingBalanceMinor: 12_345 };

  it('T-005 accepts valid input, trims the name and defaults the balance to 0', () => {
    expect(createAccountSchema.parse(valid)).toEqual(valid);
    expect(createAccountSchema.parse({ name: '  Cash  ', type: 'cash' })).toEqual({
      name: 'Cash',
      type: 'cash',
      openingBalanceMinor: 0,
    });
    expect(createAccountSchema.parse({ ...valid, openingBalanceMinor: -MAX_BALANCE_MINOR }).openingBalanceMinor).toBe(
      -MAX_BALANCE_MINOR,
    );
    expect(updateAccountSchema.parse({ ...valid, openingBalanceMinor: MAX_BALANCE_MINOR }).openingBalanceMinor).toBe(
      MAX_BALANCE_MINOR,
    );
    expect(createAccountSchema.parse({ ...valid, name: 'x'.repeat(60) }).name).toHaveLength(60);
  });

  it.each([
    ['empty name', { ...valid, name: '' }],
    ['blank name', { ...valid, name: '   ' }],
    ['61-char name', { ...valid, name: 'x'.repeat(61) }],
    ['unknown type', { ...valid, type: 'brokerage' }],
    ['missing type', { name: 'A' }],
    ['fractional balance', { ...valid, openingBalanceMinor: 1.5 }],
    ['balance as string', { ...valid, openingBalanceMinor: '10' }],
    ['balance above 10^12', { ...valid, openingBalanceMinor: MAX_BALANCE_MINOR + 1 }],
    ['balance below -10^12', { ...valid, openingBalanceMinor: -MAX_BALANCE_MINOR - 1 }],
    ['unknown key', { ...valid, extra: true }],
  ])('T-005 rejects %s', (_label, body) => {
    expect(createAccountSchema.safeParse(body).success).toBe(false);
    expect(updateAccountSchema.safeParse(body).success).toBe(false);
  });
});

describe('accounts static layout', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });

  it('T-029 names the migration 0040-create-accounts.sql inside the SPEC-004 range', () => {
    const files = readdirSync(migrationsDir).filter((f) => /accounts/.test(f));
    expect(files).toEqual(['0040-create-accounts.sql']);
    const number = Number(files[0]?.slice(0, 4));
    expect(number).toBeGreaterThanOrEqual(40);
    expect(number).toBeLessThanOrEqual(49);
    const sql = readFileSync(join(migrationsDir, '0040-create-accounts.sql'), 'utf8');
    expect(sql).not.toMatch(/\bDROP\b|\bALTER\b/i);
  });

  it('T-029 keeps accounts SQL out of every file except the repository and the migration', () => {
    const sqlOnAccounts = /\b(FROM|INTO|UPDATE|JOIN)\s+accounts\b/i;
    const offenders = walk(srcDir)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('accounts.repository.ts'))
      .filter((f) => sqlOnAccounts.test(readFileSync(f, 'utf8')))
      .map((f) => relative(srcDir, f));
    expect(offenders).toEqual([]);
  });
});
