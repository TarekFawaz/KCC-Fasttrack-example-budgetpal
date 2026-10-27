import type Database from 'better-sqlite3';

/**
 * All SQL for the spending aggregate lives here (GR-003). Every statement is parameterised and
 * filtered by `user_id` on both the transactions and the categories side (GR-002). Only
 * expense-kind categories count (D-15). The range is half-open so the `(user_id, occurred_on)`
 * index serves the scan.
 */

export interface CategoryTotal {
  categoryId: number;
  name: string;
  amountMinor: number;
}

interface CategoryTotalRow {
  category_id: number;
  name: string;
  total: number;
}

// Fixed SQL text; every value is bound.
const SPENDING_BY_CATEGORY = `
  SELECT c.id AS category_id, c.name AS name, SUM(t.amount_minor) AS total
  FROM transactions t
  JOIN categories c ON c.id = t.category_id
  WHERE t.user_id = ?
    AND c.user_id = ?
    AND c.kind = 'expense'
    AND t.occurred_on >= ?
    AND t.occurred_on < ?
  GROUP BY c.id, c.name
  ORDER BY total DESC, c.name`;

/** Expense totals per category for `[from, to)` (`YYYY-MM-DD`), largest first, ties by name. */
export function spendingByCategory(db: Database.Database, userId: number, from: string, to: string): CategoryTotal[] {
  const rows = db.prepare(SPENDING_BY_CATEGORY).all(userId, userId, from, to) as CategoryTotalRow[];
  return rows.map((row) => ({ categoryId: row.category_id, name: row.name, amountMinor: row.total }));
}
