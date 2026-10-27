import type Database from 'better-sqlite3';

/**
 * All SQL for the budgets module lives here (GR-003). Every function takes `userId` after the handle and
 * every statement is parameterised and filtered by `user_id` (GR-002). The module reads `transactions` and
 * `categories` by SQL only and imports no other module (GR-006).
 */

export interface Budget {
  id: number;
  categoryId: number;
  month: string;
  amountMinor: number;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetWithSpent {
  categoryId: number;
  categoryName: string;
  budgetMinor: number;
  spentMinor: number;
}

export interface UnbudgetedSpend {
  categoryId: number;
  categoryName: string;
  spentMinor: number;
}

export type CategoryKind = 'expense' | 'income';

interface BudgetRow {
  id: number;
  category_id: number;
  month: string;
  amount_minor: number;
  created_at: string;
  updated_at: string;
}

const toBudget = (row: BudgetRow): Budget => ({
  id: row.id,
  categoryId: row.category_id,
  month: row.month,
  amountMinor: row.amount_minor,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Half-open date range `[from, to)` covering `month` ('YYYY-MM'), so the (user_id, occurred_on) index serves it. */
export function monthRange(month: string): { from: string; to: string } {
  const match = MONTH.exec(month);
  if (!match) throw new RangeError('month must be YYYY-MM');
  const year = Number(match[1]);
  const monthNo = Number(match[2]);
  const nextYear = monthNo === 12 ? year + 1 : year;
  const nextMonth = monthNo === 12 ? 1 : monthNo + 1;
  const pad = (n: number, width: number): string => String(n).padStart(width, '0');
  return { from: `${month}-01`, to: `${pad(nextYear, 4)}-${pad(nextMonth, 2)}-01` };
}

export function find(db: Database.Database, userId: number, categoryId: number, month: string): Budget | undefined {
  const row = db
    .prepare(
      `SELECT id, category_id, month, amount_minor, created_at, updated_at
         FROM budgets WHERE user_id = ? AND category_id = ? AND month = ?`,
    )
    .get(userId, categoryId, month) as BudgetRow | undefined;
  return row ? toBudget(row) : undefined;
}

export function findById(db: Database.Database, userId: number, id: number): Budget | undefined {
  const row = db
    .prepare(
      `SELECT id, category_id, month, amount_minor, created_at, updated_at
         FROM budgets WHERE user_id = ? AND id = ?`,
    )
    .get(userId, id) as BudgetRow | undefined;
  return row ? toBudget(row) : undefined;
}

/**
 * Creates the budget, or replaces the amount of the existing one for the same user, category and month.
 * The caller has already checked that the category belongs to `userId` and is an expense category.
 * `created` is true for a new row, false when an existing amount was replaced.
 */
export function upsert(
  db: Database.Database,
  userId: number,
  categoryId: number,
  month: string,
  amountMinor: number,
  now: string = new Date().toISOString(),
): { budget: Budget; created: boolean } {
  return db.transaction((): { budget: Budget; created: boolean } => {
    const existed = find(db, userId, categoryId, month) !== undefined;
    db.prepare(
      `INSERT INTO budgets (user_id, category_id, month, amount_minor, created_at, updated_at)
       VALUES (@userId, @categoryId, @month, @amountMinor, @now, @now)
       ON CONFLICT (user_id, category_id, month)
       DO UPDATE SET amount_minor = excluded.amount_minor, updated_at = excluded.updated_at`,
    ).run({ userId, categoryId, month, amountMinor, now });
    return { budget: find(db, userId, categoryId, month) as Budget, created: !existed };
  })();
}

/** Returns true when a row was removed, false when the user has no such budget. */
export function remove(db: Database.Database, userId: number, categoryId: number, month: string): boolean {
  return (
    db.prepare('DELETE FROM budgets WHERE user_id = ? AND category_id = ? AND month = ?').run(userId, categoryId, month)
      .changes > 0
  );
}

/**
 * The user's budgets for `month` with the SQL sum of their transactions in that category and month.
 * A budget whose category is no longer an expense category is ignored.
 */
export function listWithSpent(db: Database.Database, userId: number, month: string): BudgetWithSpent[] {
  const { from, to } = monthRange(month);
  const rows = db
    .prepare(
      `SELECT b.category_id AS category_id,
              c.name AS category_name,
              b.amount_minor AS budget_minor,
              COALESCE(
                (SELECT SUM(t.amount_minor)
                   FROM transactions t
                  WHERE t.user_id = b.user_id
                    AND t.category_id = b.category_id
                    AND t.occurred_on >= @from AND t.occurred_on < @to),
                0) AS spent_minor
         FROM budgets b
         JOIN categories c ON c.id = b.category_id AND c.user_id = b.user_id AND c.kind = 'expense'
        WHERE b.user_id = @userId AND b.month = @month
        ORDER BY c.name COLLATE NOCASE, b.category_id`,
    )
    .all({ userId, month, from, to }) as Array<{
    category_id: number;
    category_name: string;
    budget_minor: number;
    spent_minor: number;
  }>;
  return rows.map((r) => ({
    categoryId: r.category_id,
    categoryName: r.category_name,
    budgetMinor: r.budget_minor,
    spentMinor: r.spent_minor,
  }));
}

/** Expense categories of the user with spend in `month` and no budget for that month. */
export function listUnbudgeted(db: Database.Database, userId: number, month: string): UnbudgetedSpend[] {
  const { from, to } = monthRange(month);
  const rows = db
    .prepare(
      `SELECT c.id AS category_id, c.name AS category_name, SUM(t.amount_minor) AS spent_minor
         FROM categories c
         JOIN transactions t
           ON t.category_id = c.id AND t.user_id = c.user_id
          AND t.occurred_on >= @from AND t.occurred_on < @to
        WHERE c.user_id = @userId AND c.kind = 'expense'
          AND NOT EXISTS (SELECT 1 FROM budgets b
                           WHERE b.user_id = c.user_id AND b.category_id = c.id AND b.month = @month)
        GROUP BY c.id, c.name
        ORDER BY c.name COLLATE NOCASE, c.id`,
    )
    .all({ userId, month, from, to }) as Array<{ category_id: number; category_name: string; spent_minor: number }>;
  return rows.map((r) => ({ categoryId: r.category_id, categoryName: r.category_name, spentMinor: r.spent_minor }));
}

/** Kind of the user's category, or `undefined` when it does not exist or belongs to someone else. */
export function categoryKind(db: Database.Database, userId: number, categoryId: number): CategoryKind | undefined {
  const row = db.prepare('SELECT kind FROM categories WHERE user_id = ? AND id = ?').get(userId, categoryId) as
    | { kind: CategoryKind }
    | undefined;
  return row?.kind;
}
