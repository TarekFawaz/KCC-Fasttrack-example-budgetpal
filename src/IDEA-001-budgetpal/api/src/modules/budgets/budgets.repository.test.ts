import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb } from '../../kernel/db/index.js';
import { runMigrations } from '../../kernel/db/migrate.js';
import * as repo from './budgets.repository.js';
import { budgetStatus } from './budgets.status.js';

const migrationsDir = fileURLToPath(new URL('../../../migrations', import.meta.url));
const MONTH = '2026-03';

let db: Database.Database;
let userA: number;
let userB: number;
let foodA: number; // expense, user A
let rentA: number; // expense, user A
let salaryA: number; // income, user A
let foodB: number; // expense, user B
let accountA: number;
let accountB: number;

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
const addCategory = (userId: number, name: string, kind: 'expense' | 'income' = 'expense'): number =>
  Number(
    db
      .prepare('INSERT INTO categories (user_id, name, kind, created_at) VALUES (?, ?, ?, ?)')
      .run(userId, name, kind, '2026-01-01T00:00:00.000Z').lastInsertRowid,
  );
const addTx = (userId: number, accountId: number, categoryId: number, occurredOn: string, amountMinor: number): void => {
  db.prepare(
    `INSERT INTO transactions
       (user_id, account_id, category_id, occurred_on, amount_minor, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'x', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
  ).run(userId, accountId, categoryId, occurredOn, amountMinor);
};

beforeEach(() => {
  db = openDb(':memory:');
  runMigrations(db, migrationsDir);
  userA = addUser('a@example.test');
  userB = addUser('b@example.test');
  accountA = addAccount(userA);
  accountB = addAccount(userB);
  foodA = addCategory(userA, 'Food');
  rentA = addCategory(userA, 'Rent');
  salaryA = addCategory(userA, 'Salary', 'income');
  foodB = addCategory(userB, 'Food');
});
afterEach(() => {
  db.close();
});

describe('budgets migration', () => {
  it('T-001 creates the table with columns, cascade foreign keys and the unique user+category+month index', () => {
    const columns = db.prepare('PRAGMA table_info(budgets)').all() as Array<{ name: string; type: string }>;
    expect(columns.map((c) => c.name).sort()).toEqual(
      ['amount_minor', 'category_id', 'created_at', 'id', 'month', 'updated_at', 'user_id'].sort(),
    );
    expect(columns.find((c) => c.name === 'amount_minor')?.type).toBe('INTEGER');
    expect(columns.find((c) => c.name === 'month')?.type).toBe('TEXT');

    const fks = db.prepare('PRAGMA foreign_key_list(budgets)').all() as Array<{
      table: string;
      from: string;
      on_delete: string;
    }>;
    expect(fks.map((f) => `${f.from}->${f.table}:${f.on_delete}`).sort()).toEqual([
      'category_id->categories:CASCADE',
      'user_id->users:CASCADE',
    ]);

    const indexes = db.prepare('PRAGMA index_list(budgets)').all() as Array<{ name: string; unique: number }>;
    const unique = indexes.filter((i) => i.unique === 1);
    const cols = unique.map(
      (i) =>
        (db.prepare(`PRAGMA index_info(${i.name})`).all() as Array<{ name: string }>).map((c) => c.name).join(','),
    );
    expect(cols).toContain('user_id,category_id,month');

    const insert = (month: string, amount: number) =>
      db
        .prepare(
          `INSERT INTO budgets (user_id, category_id, month, amount_minor, created_at, updated_at)
           VALUES (?, ?, ?, ?, 't', 't')`,
        )
        .run(userA, foodA, month, amount);
    expect(() => insert(MONTH, 0)).toThrow(/CHECK/);
    expect(() => insert(MONTH, -5)).toThrow(/CHECK/);
    expect(() => insert('2026-13', 100)).toThrow(/CHECK/);
    expect(() => insert('2026-00', 100)).toThrow(/CHECK/);
    expect(() => insert('2026-3', 100)).toThrow(/CHECK/);
    insert(MONTH, 100);
    expect(() => insert(MONTH, 200)).toThrow(/UNIQUE/);
    expect(db.prepare('SELECT COUNT(*) AS n FROM budgets').get()).toEqual({ n: 1 });
  });

  it('T-001 removes budgets with their category and with their user', () => {
    repo.upsert(db, userA, foodA, MONTH, 100);
    repo.upsert(db, userA, rentA, MONTH, 100);
    db.prepare('DELETE FROM categories WHERE id = ?').run(foodA);
    expect(repo.find(db, userA, foodA, MONTH)).toBeUndefined();
    expect(repo.find(db, userA, rentA, MONTH)).toBeDefined();
    db.prepare('DELETE FROM users WHERE id = ?').run(userA);
    expect(db.prepare('SELECT COUNT(*) AS n FROM budgets').get()).toEqual({ n: 0 });
  });
});

describe('budgets repository upsert', () => {
  it('T-002 replaces the amount for the same user, category and month and reports created vs replaced', () => {
    const first = repo.upsert(db, userA, foodA, MONTH, 5000, '2026-03-01T00:00:00.000Z');
    expect(first.created).toBe(true);
    expect(first.budget).toMatchObject({ categoryId: foodA, month: MONTH, amountMinor: 5000 });

    const second = repo.upsert(db, userA, foodA, MONTH, 7500, '2026-03-02T00:00:00.000Z');
    expect(second.created).toBe(false);
    expect(second.budget.id).toBe(first.budget.id);
    expect(second.budget.amountMinor).toBe(7500);
    expect(second.budget.createdAt).toBe('2026-03-01T00:00:00.000Z');
    expect(second.budget.updatedAt).toBe('2026-03-02T00:00:00.000Z');
    expect(db.prepare('SELECT COUNT(*) AS n FROM budgets').get()).toEqual({ n: 1 });

    // a different month or category is a different budget
    expect(repo.upsert(db, userA, foodA, '2026-04', 100).created).toBe(true);
    expect(repo.upsert(db, userA, rentA, MONTH, 100).created).toBe(true);
    expect(db.prepare('SELECT COUNT(*) AS n FROM budgets').get()).toEqual({ n: 3 });
  });

  it('T-002 remove deletes the row and reports whether one existed', () => {
    repo.upsert(db, userA, foodA, MONTH, 100);
    expect(repo.remove(db, userA, foodA, MONTH)).toBe(true);
    expect(repo.remove(db, userA, foodA, MONTH)).toBe(false);
    expect(repo.find(db, userA, foodA, MONTH)).toBeUndefined();
  });
});

describe('budgets repository isolation', () => {
  it('T-003 user B cannot find, change, remove or list user A budget; A row is unchanged', () => {
    const a = repo.upsert(db, userA, foodA, MONTH, 5000).budget;
    addTx(userA, accountA, foodA, '2026-03-10', 1200);

    expect(repo.find(db, userB, foodA, MONTH)).toBeUndefined();
    expect(repo.findById(db, userB, a.id)).toBeUndefined();
    expect(repo.remove(db, userB, foodA, MONTH)).toBe(false);
    expect(repo.listWithSpent(db, userB, MONTH)).toEqual([]);
    expect(repo.listUnbudgeted(db, userB, MONTH)).toEqual([]);
    expect(repo.categoryKind(db, userB, foodA)).toBeUndefined();

    // B's upsert on A's category id writes a row for B, never touches A's
    repo.upsert(db, userB, foodA, MONTH, 1);
    expect(repo.find(db, userA, foodA, MONTH)).toEqual(a);
    expect(repo.findById(db, userA, a.id)).toEqual(a);
    expect(repo.listWithSpent(db, userB, MONTH)).toEqual([]); // not B's category: no join
    expect(repo.listWithSpent(db, userA, MONTH)).toEqual([
      { categoryId: foodA, categoryName: 'Food', budgetMinor: 5000, spentMinor: 1200 },
    ]);
    expect(repo.categoryKind(db, userA, foodA)).toBe('expense');
  });
});

describe('budgets repository progress queries', () => {
  it('T-004 listWithSpent sums only the user, month and category transactions', () => {
    repo.upsert(db, userA, foodA, MONTH, 10000);
    repo.upsert(db, userA, rentA, MONTH, 90000);
    repo.upsert(db, userA, foodA, '2026-04', 4000);
    repo.upsert(db, userB, foodB, MONTH, 3000);

    addTx(userA, accountA, foodA, '2026-03-01', 1000); // month start, included
    addTx(userA, accountA, foodA, '2026-03-31', 2500); // month end, included
    addTx(userA, accountA, foodA, '2026-02-28', 7777); // before
    addTx(userA, accountA, foodA, '2026-04-01', 8888); // after
    addTx(userA, accountA, rentA, '2026-03-15', 50000); // other category
    addTx(userB, accountB, foodB, '2026-03-10', 999); // other user, own category

    expect(repo.listWithSpent(db, userA, MONTH)).toEqual([
      { categoryId: foodA, categoryName: 'Food', budgetMinor: 10000, spentMinor: 3500 },
      { categoryId: rentA, categoryName: 'Rent', budgetMinor: 90000, spentMinor: 50000 },
    ]);
    expect(repo.listWithSpent(db, userA, '2026-04')).toEqual([
      { categoryId: foodA, categoryName: 'Food', budgetMinor: 4000, spentMinor: 8888 },
    ]);
    expect(repo.listWithSpent(db, userB, MONTH)).toEqual([
      { categoryId: foodB, categoryName: 'Food', budgetMinor: 3000, spentMinor: 999 },
    ]);
    expect(repo.listWithSpent(db, userA, '2026-05')).toEqual([]);
  });

  it('T-004 a budgeted category with no transactions has spent 0; December rolls into the next year', () => {
    repo.upsert(db, userA, foodA, '2026-12', 100);
    addTx(userA, accountA, foodA, '2026-12-31', 40);
    addTx(userA, accountA, foodA, '2027-01-01', 999);
    expect(repo.listWithSpent(db, userA, '2026-12')[0]?.spentMinor).toBe(40);
    repo.upsert(db, userA, rentA, '2026-11', 100);
    expect(repo.listWithSpent(db, userA, '2026-11')).toEqual([
      { categoryId: rentA, categoryName: 'Rent', budgetMinor: 100, spentMinor: 0 },
    ]);
    expect(repo.monthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2027-01-01' });
    expect(() => repo.monthRange('2026-13')).toThrow(RangeError);
  });

  it('T-004 listUnbudgeted lists expense categories with spend and no budget; never income or other users', () => {
    repo.upsert(db, userA, foodA, MONTH, 100); // budgeted: excluded
    addTx(userA, accountA, foodA, '2026-03-05', 10);
    addTx(userA, accountA, rentA, '2026-03-05', 700);
    addTx(userA, accountA, rentA, '2026-03-06', 300);
    addTx(userA, accountA, rentA, '2026-02-06', 5000); // other month
    addTx(userA, accountA, salaryA, '2026-03-07', 100000); // income
    addTx(userB, accountB, foodB, '2026-03-05', 42); // other user

    expect(repo.listUnbudgeted(db, userA, MONTH)).toEqual([{ categoryId: rentA, categoryName: 'Rent', spentMinor: 1000 }]);
    expect(repo.listUnbudgeted(db, userB, MONTH)).toEqual([{ categoryId: foodB, categoryName: 'Food', spentMinor: 42 }]);
  });

  it('T-004 ignores a budget whose category is no longer an expense category', () => {
    repo.upsert(db, userA, foodA, MONTH, 100);
    db.prepare("UPDATE categories SET kind = 'income' WHERE id = ?").run(foodA);
    expect(repo.listWithSpent(db, userA, MONTH)).toEqual([]);
  });

  it('T-004 categoryKind returns the kind or undefined for unknown ids', () => {
    expect(repo.categoryKind(db, userA, foodA)).toBe('expense');
    expect(repo.categoryKind(db, userA, salaryA)).toBe('income');
    expect(repo.categoryKind(db, userA, 99999)).toBeUndefined();
  });
});

describe('budgetStatus', () => {
  it('T-005 is ok below 80%, warning from 80% to 100% inclusive, over above 100%', () => {
    expect(budgetStatus(7999, 10000)).toBe('ok'); // 79.99%
    expect(budgetStatus(8000, 10000)).toBe('warning'); // 80%
    expect(budgetStatus(10000, 10000)).toBe('warning'); // 100%
    expect(budgetStatus(10001, 10000)).toBe('over'); // 100.01%
  });

  it('T-005 handles zero spent and tiny budgets by integer comparison, not rounded percent', () => {
    expect(budgetStatus(0, 10000)).toBe('ok');
    expect(budgetStatus(0, 1)).toBe('ok');
    expect(budgetStatus(1, 1)).toBe('warning');
    expect(budgetStatus(2, 1)).toBe('over');
    expect(budgetStatus(3, 5)).toBe('ok'); // 60%
    expect(budgetStatus(4, 5)).toBe('warning'); // 80%
    // 79.995% would round to 80 in a display percent but is still below the line
    expect(budgetStatus(79995, 100000)).toBe('ok');
  });

  it('T-005 stays exact for values where plain double arithmetic would lose precision', () => {
    const budget = 9007199254740990; // < 2^53, multiple of 5
    const edge = (budget / 5) * 4; // exactly 80%
    expect(budgetStatus(edge - 1, budget)).toBe('ok');
    expect(budgetStatus(edge, budget)).toBe('warning');
    expect(budgetStatus(budget, budget)).toBe('warning');
    expect(budgetStatus(budget + 0, budget - 1)).toBe('over');
  });

  it('T-005 rejects non-integer or negative minor units', () => {
    expect(() => budgetStatus(1.5, 10)).toThrow(RangeError);
    expect(() => budgetStatus(-1, 10)).toThrow(RangeError);
    expect(() => budgetStatus(1, Number.NaN)).toThrow(RangeError);
  });
});
