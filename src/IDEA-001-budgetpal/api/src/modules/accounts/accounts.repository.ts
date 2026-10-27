import type Database from 'better-sqlite3';
import type { Account, AccountType, CreateAccountInput, UpdateAccountInput } from './accounts.schemas.js';

/**
 * All SQL for the accounts module lives here (GR-003). Every function takes `userId` first and
 * every statement is parameterised and filtered by `user_id` (GR-002), so one user can never
 * read or change another user's row.
 */

/** The user already has an account with this name (compared ignoring case and surrounding spaces). */
export class DuplicateName extends Error {
  constructor() {
    super('An account with this name already exists.');
    this.name = 'DuplicateName';
  }
}

/** A foreign key (a transaction) still references the account, so it cannot be deleted. */
export class InUse extends Error {
  constructor() {
    super('The account is referenced by transactions.');
    this.name = 'InUse';
  }
}

interface AccountRow {
  id: number;
  name: string;
  type: AccountType;
  opening_balance_minor: number;
  created_at: number;
  updated_at: number;
}

const toAccount = (row: AccountRow): Account => ({
  id: row.id,
  name: row.name,
  type: row.type,
  openingBalanceMinor: row.opening_balance_minor,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const sqliteCode = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null ? (error as { code?: string }).code : undefined;

/**
 * A violated foreign key. A plain reference reports SQLITE_CONSTRAINT_FOREIGNKEY; an
 * `ON DELETE RESTRICT` action reports SQLITE_CONSTRAINT_TRIGGER, both with this message.
 */
const isForeignKeyViolation = (error: unknown): boolean => {
  const code = sqliteCode(error);
  if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY') return true;
  return (
    code === 'SQLITE_CONSTRAINT_TRIGGER' && error instanceof Error && /FOREIGN KEY constraint failed/.test(error.message)
  );
};

/** The user's accounts, ordered by name (case-insensitive), then id. */
export function list(db: Database.Database, userId: number): Account[] {
  const rows = db
    .prepare(
      `SELECT id, name, type, opening_balance_minor, created_at, updated_at
         FROM accounts WHERE user_id = ? ORDER BY name COLLATE NOCASE, id`,
    )
    .all(userId) as AccountRow[];
  return rows.map(toAccount);
}

export function findById(db: Database.Database, userId: number, id: number): Account | undefined {
  const row = db
    .prepare(
      `SELECT id, name, type, opening_balance_minor, created_at, updated_at
         FROM accounts WHERE user_id = ? AND id = ?`,
    )
    .get(userId, id) as AccountRow | undefined;
  return row ? toAccount(row) : undefined;
}

/** Throws `DuplicateName` when the user already has this name in any case. */
export function create(
  db: Database.Database,
  userId: number,
  input: CreateAccountInput,
  now: number = Date.now(),
): Account {
  try {
    const result = db
      .prepare(
        `INSERT INTO accounts (user_id, name, type, opening_balance_minor, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(userId, input.name.trim(), input.type, input.openingBalanceMinor, now, now);
    return findById(db, userId, Number(result.lastInsertRowid)) as Account;
  } catch (error) {
    if (sqliteCode(error) === 'SQLITE_CONSTRAINT_UNIQUE') throw new DuplicateName();
    throw error;
  }
}

/** Returns `undefined` when the user has no such account. Throws `DuplicateName` on a name clash. */
export function update(
  db: Database.Database,
  userId: number,
  id: number,
  input: UpdateAccountInput,
  now: number = Date.now(),
): Account | undefined {
  try {
    const result = db
      .prepare(
        `UPDATE accounts SET name = ?, type = ?, opening_balance_minor = ?, updated_at = ?
          WHERE user_id = ? AND id = ?`,
      )
      .run(input.name.trim(), input.type, input.openingBalanceMinor, now, userId, id);
    if (result.changes === 0) return undefined;
    return findById(db, userId, id);
  } catch (error) {
    if (sqliteCode(error) === 'SQLITE_CONSTRAINT_UNIQUE') throw new DuplicateName();
    throw error;
  }
}

/**
 * Returns true when a row was removed, false when the user has no such account.
 * Throws `InUse` when a RESTRICT foreign key (transactions.account_id) still points at it.
 */
export function remove(db: Database.Database, userId: number, id: number): boolean {
  try {
    return db.prepare('DELETE FROM accounts WHERE user_id = ? AND id = ?').run(userId, id).changes > 0;
  } catch (error) {
    if (isForeignKeyViolation(error)) throw new InUse();
    throw error;
  }
}
