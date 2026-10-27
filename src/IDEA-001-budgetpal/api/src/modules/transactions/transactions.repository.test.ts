import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb } from '../../kernel/db/index.js';
import { runMigrations } from '../../kernel/db/migrate.js';
import * as repo from './transactions.repository.js';

const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));

let db: Database.Database;
let userA: number;
let userB: number;
let accountA: number;
let accountB: number;
let categoryA: number;
let categoryB: number;

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
const addCategory = (userId: number): number =>
  Number(
    db
      .prepare('INSERT INTO categories (user_id, name, kind, created_at) VALUES (?, ?, ?, ?)')
      .run(userId, `cat-${userId}`, 'expense', '2026-01-01T00:00:00.000Z').lastInsertRowid,
  );

const input = (userAccount: number, userCategory: number, overrides: Record<string, unknown> = {}) => ({
  accountId: userAccount,
  categoryId: userCategory,
  occurredOn: '2026-03-15',
  amountMinor: 1250,
  description: 'Coffee',
  ...overrides,
});

beforeEach(() => {
  db = openDb(':memory:');
  runMigrations(db, migrationsDir);
  userA = addUser('a@example.test');
  userB = addUser('b@example.test');
  accountA = addAccount(userA);
  accountB = addAccount(userB);
  categoryA = addCategory(userA);
  categoryB = addCategory(userB);
});
afterEach(() => {
  db.close();
});

describe('transactions migration', () => {
  it('T-001 creates the table with columns, RESTRICT foreign keys and the (user_id, occurred_on) index', () => {
    const columns = db.prepare('PRAGMA table_info(transactions)').all() as Array<{ name: string; type: string }>;
    expect(columns.map((c) => c.name).sort()).toEqual(
      [
        'account_id',
        'amount_minor',
        'category_id',
        'created_at',
        'dedupe_key', // added by SPEC-006 migration 0060
        'description',
        'id',
        'occurred_on',
        'updated_at',
        'user_id',
      ].sort(),
    );
    expect(columns.find((c) => c.name === 'amount_minor')?.type).toBe('INTEGER');
    expect(columns.find((c) => c.name === 'occurred_on')?.type).toBe('TEXT');

    const fks = db.prepare('PRAGMA foreign_key_list(transactions)').all() as Array<{
      table: string;
      from: string;
      on_delete: string;
    }>;
    const byFrom = new Map(fks.map((f) => [f.from, f]));
    expect(byFrom.get('account_id')).toMatchObject({ table: 'accounts', on_delete: 'RESTRICT' });
    expect(byFrom.get('category_id')).toMatchObject({ table: 'categories', on_delete: 'RESTRICT' });
    expect(byFrom.get('user_id')?.table).toBe('users');

    const indexes = db.prepare('PRAGMA index_list(transactions)').all() as Array<{ name: string }>;
    const index = indexes.find((i) => i.name === 'transactions_user_occurred_on');
    expect(index).toBeDefined();
    const indexed = db.prepare('PRAGMA index_info(transactions_user_occurred_on)').all() as Array<{ name: string }>;
    expect(indexed.map((c) => c.name)).toEqual(['user_id', 'occurred_on']);
  });

  it('T-002 is 0050-transactions.sql, has no REAL/FLOAT/DECIMAL and cannot be re-applied or edited', () => {
    const files = readdirSync(migrationsDir);
    expect(files).toContain('0050-transactions.sql');
    const sql = readFileSync(join(migrationsDir, '0050-transactions.sql'), 'utf8');
    expect(sql).not.toMatch(/\b(REAL|FLOAT|DOUBLE|DECIMAL|NUMERIC)\b/i);
    // Already applied: running again applies nothing.
    expect(runMigrations(db, migrationsDir)).toEqual([]);
    // Applying the file's DDL a second time fails: the table exists.
    expect(() => db.exec(sql)).toThrow(/already exists/);
  });

  it('T-006 refuses to delete an account or category that a transaction references', () => {
    repo.insert(db, userA, input(accountA, categoryA));
    expect(() => db.prepare('DELETE FROM accounts WHERE id = ?').run(accountA)).toThrow(/FOREIGN KEY/);
    expect(() => db.prepare('DELETE FROM categories WHERE id = ?').run(categoryA)).toThrow(/FOREIGN KEY/);
    expect(db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE id = ?').get(accountA)).toEqual({ n: 1 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM categories WHERE id = ?').get(categoryA)).toEqual({ n: 1 });
  });
});

describe('transactions repository', () => {
  it('T-004 inserts and reads back for the owner with integer amount', () => {
    const created = repo.insert(db, userA, input(accountA, categoryA), '2026-03-15T10:00:00.000Z');
    expect(created).toMatchObject({ amountMinor: 1250, occurredOn: '2026-03-15', description: 'Coffee' });
    expect(Number.isInteger(created.amountMinor)).toBe(true);
    expect(repo.findById(db, userA, created.id)).toEqual(created);
  });

  it("T-004 never reads or changes another user's row", () => {
    const row = repo.insert(db, userA, input(accountA, categoryA));
    expect(repo.findById(db, userB, row.id)).toBeUndefined();
    expect(repo.update(db, userB, row.id, { description: 'Hacked' })).toBeUndefined();
    expect(repo.remove(db, userB, row.id)).toBe(false);
    expect(repo.list(db, userB, { limit: 50, offset: 0 })).toEqual({ items: [], total: 0 });
    expect(repo.findById(db, userA, row.id)).toEqual(row);
  });

  it('T-004 update changes only the given fields and touches updated_at; remove deletes', () => {
    const row = repo.insert(db, userA, input(accountA, categoryA), '2026-03-15T10:00:00.000Z');
    const updated = repo.update(db, userA, row.id, { amountMinor: 999 }, '2026-03-16T10:00:00.000Z');
    expect(updated).toMatchObject({ amountMinor: 999, description: 'Coffee', createdAt: row.createdAt });
    expect(updated?.updatedAt).toBe('2026-03-16T10:00:00.000Z');
    expect(repo.remove(db, userA, row.id)).toBe(true);
    expect(repo.findById(db, userA, row.id)).toBeUndefined();
  });

  it('T-004 list filters, orders newest first and counts the filtered set', () => {
    const a = repo.insert(db, userA, input(accountA, categoryA, { occurredOn: '2026-03-01' }));
    const b = repo.insert(db, userA, input(accountA, categoryA, { occurredOn: '2026-03-31' }));
    const c = repo.insert(db, userA, input(accountA, categoryA, { occurredOn: '2026-03-31' }));
    repo.insert(db, userA, input(accountA, categoryA, { occurredOn: '2026-04-01' }));
    repo.insert(db, userB, input(accountB, categoryB, { occurredOn: '2026-03-10' }));
    const march = repo.list(db, userA, { month: '2026-03', limit: 50, offset: 0 });
    expect(march.total).toBe(3);
    expect(march.items.map((t) => t.id)).toEqual([c.id, b.id, a.id]);
    expect(repo.list(db, userA, { month: '2026-03', limit: 1, offset: 1 }).items.map((t) => t.id)).toEqual([b.id]);
    // Filtering by the other user's account yields nothing of theirs.
    expect(repo.list(db, userA, { accountId: accountB, limit: 50, offset: 0 })).toEqual({ items: [], total: 0 });
  });

  it('T-005 ownsAccount and ownsCategory are true only for the owner', () => {
    expect(repo.ownsAccount(db, userA, accountA)).toBe(true);
    expect(repo.ownsAccount(db, userA, accountB)).toBe(false);
    expect(repo.ownsAccount(db, userA, 99999)).toBe(false);
    expect(repo.ownsCategory(db, userA, categoryA)).toBe(true);
    expect(repo.ownsCategory(db, userA, categoryB)).toBe(false);
    expect(repo.ownsCategory(db, userA, 99999)).toBe(false);
  });
});
