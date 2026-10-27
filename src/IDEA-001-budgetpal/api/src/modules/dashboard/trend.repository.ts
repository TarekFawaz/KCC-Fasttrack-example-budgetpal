import type Database from 'better-sqlite3';

/**
 * All SQL for the trend aggregate lives here (GR-003). Statements are parameterised, filtered by
 * `user_id` on both tables (GR-002), count expense-kind categories only (D-15), and use a
 * half-open date range so the `(user_id, occurred_on)` index serves the scan.
 */

export interface MonthTotal {
  month: string;
  totalMinor: number;
}

interface MonthTotalRow {
  month: string;
  total: number;
}

// Fixed SQL text; every value is bound.
const MONTHLY_TOTALS = `
  SELECT substr(t.occurred_on, 1, 7) AS month, SUM(t.amount_minor) AS total
  FROM transactions t
  JOIN categories c ON c.id = t.category_id
  WHERE t.user_id = ?
    AND c.user_id = ?
    AND c.kind = 'expense'
    AND t.occurred_on >= ?
    AND t.occurred_on < ?
  GROUP BY month
  ORDER BY month`;

/** Expense totals per calendar month for `[from, to)` (`YYYY-MM-DD`); months without expenses are absent. */
export function monthlyTotals(db: Database.Database, userId: number, from: string, to: string): MonthTotal[] {
  const rows = db.prepare(MONTHLY_TOTALS).all(userId, userId, from, to) as MonthTotalRow[];
  return rows.map((row) => ({ month: row.month, totalMinor: row.total }));
}
