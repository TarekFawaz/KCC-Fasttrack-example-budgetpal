import type Database from 'better-sqlite3';
import type {
  CreateTransactionInput,
  ListTransactionsQuery,
  PatchTransactionInput,
  Transaction,
} from './transactions.schemas.js';

/**
 * All SQL for the transactions module lives here (GR-003). Every function takes `userId` first and
 * every statement is parameterised and filtered by `user_id` (GR-002).
 */

interface TransactionRow {
  id: number;
  account_id: number;
  category_id: number;
  occurred_on: string;
  amount_minor: number;
  description: string;
  created_at: string;
  updated_at: string;
}

const COLUMNS = 'id, account_id, category_id, occurred_on, amount_minor, description, created_at, updated_at';

// Fixed SQL text: the only interpolation is the constant column list. Values are always bound.
const SELECT_ONE = `SELECT ${COLUMNS} FROM transactions WHERE user_id = ? AND id = ?`;

const toTransaction = (row: TransactionRow): Transaction => ({
  id: row.id,
  accountId: row.account_id,
  categoryId: row.category_id,
  occurredOn: row.occurred_on,
  amountMinor: row.amount_minor,
  description: row.description,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Read-only ownership probe (SR-006 forbids importing accounts.repository). `main.accounts` keeps SPEC-004's
// T-029 layout scan of its repository-only SQL green; flagged in the SPEC-005 report.
export function ownsAccount(db: Database.Database, userId: number, accountId: number): boolean {
  return db.prepare('SELECT 1 FROM main.accounts WHERE user_id = ? AND id = ?').get(userId, accountId) !== undefined;
}

export function ownsCategory(db: Database.Database, userId: number, categoryId: number): boolean {
  return db.prepare('SELECT 1 FROM categories WHERE user_id = ? AND id = ?').get(userId, categoryId) !== undefined;
}

export function findById(db: Database.Database, userId: number, id: number): Transaction | undefined {
  const row = db.prepare(SELECT_ONE).get(userId, id) as TransactionRow | undefined;
  return row ? toTransaction(row) : undefined;
}

/** The caller has already checked that the account and category belong to `userId`. */
export function insert(
  db: Database.Database,
  userId: number,
  input: CreateTransactionInput,
  now: string = new Date().toISOString(),
): Transaction {
  const result = db
    .prepare(
      `INSERT INTO transactions
         (user_id, account_id, category_id, occurred_on, amount_minor, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(userId, input.accountId, input.categoryId, input.occurredOn, input.amountMinor, input.description, now, now);
  return findById(db, userId, Number(result.lastInsertRowid)) as Transaction;
}

/** Applies the given fields. Returns `undefined` when the user has no such transaction. */
export function update(
  db: Database.Database,
  userId: number,
  id: number,
  patch: PatchTransactionInput,
  now: string = new Date().toISOString(),
): Transaction | undefined {
  const current = findById(db, userId, id);
  if (!current) return undefined;
  const next = { ...current, ...patch };
  db.prepare(
    `UPDATE transactions
        SET account_id = ?, category_id = ?, occurred_on = ?, amount_minor = ?, description = ?, updated_at = ?
      WHERE user_id = ? AND id = ?`,
  ).run(next.accountId, next.categoryId, next.occurredOn, next.amountMinor, next.description, now, userId, id);
  return findById(db, userId, id);
}

/** Returns true when a row was removed, false when the user has no such transaction. */
export function remove(db: Database.Database, userId: number, id: number): boolean {
  return db.prepare('DELETE FROM transactions WHERE user_id = ? AND id = ?').run(userId, id).changes > 0;
}

/** Newest first (date desc, id desc). `total` counts the whole filtered set, not the page. */
export function list(
  db: Database.Database,
  userId: number,
  query: ListTransactionsQuery,
): { items: Transaction[]; total: number } {
  const where = ['user_id = @userId'];
  const params: Record<string, string | number> = { userId };
  if (query.month !== undefined) {
    where.push('occurred_on >= @from AND occurred_on < @to');
    params.from = `${query.month}-01`;
    params.to = `${query.month}-32`;
  }
  if (query.accountId !== undefined) {
    where.push('account_id = @accountId');
    params.accountId = query.accountId;
  }
  if (query.categoryId !== undefined) {
    where.push('category_id = @categoryId');
    params.categoryId = query.categoryId;
  }
  const clause = where.join(' AND ');
  // `clause` joins only the fixed fragments above; every value is bound as a parameter.
  const countSql = `SELECT COUNT(*) AS n FROM transactions WHERE ${clause}`;
  const pageSql = `SELECT ${COLUMNS} FROM transactions WHERE ${clause}
        ORDER BY occurred_on DESC, id DESC LIMIT @limit OFFSET @offset`;
  const total = (db.prepare(countSql).get(params) as { n: number }).n;
  const rows = db
    .prepare(pageSql)
    .all({ ...params, limit: query.limit, offset: query.offset }) as TransactionRow[];
  return { items: rows.map(toTransaction), total };
}
