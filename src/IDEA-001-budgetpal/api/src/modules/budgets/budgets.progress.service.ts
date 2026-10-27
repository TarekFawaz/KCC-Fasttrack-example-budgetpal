import type Database from 'better-sqlite3';
import * as repository from './budgets.repository.js';
import { budgetStatus, type BudgetStatus } from './budgets.status.js';

export interface ProgressItem {
  categoryId: number;
  categoryName: string;
  budgetMinor: number;
  spentMinor: number;
  /** Display only, rounded down. The status never reads it (it is decided on integers). */
  percent: number;
  status: BudgetStatus;
}

export interface UnbudgetedItem {
  categoryId: number;
  categoryName: string;
  spentMinor: number;
}

export interface MonthProgress {
  month: string;
  items: ProgressItem[];
  unbudgeted: UnbudgetedItem[];
}

/** `floor(spent * 100 / budget)` in BigInt, so a large sum cannot lose precision. Display only. */
export function displayPercent(spentMinor: number, budgetMinor: number): number {
  if (budgetMinor <= 0) return 0;
  return Number((BigInt(spentMinor) * 100n) / BigInt(budgetMinor));
}

/**
 * The user's budgets for `month` with spent (summed in SQL), percent and status, plus the expense
 * categories that have spending in the month but no budget. Everything is scoped to `userId`.
 */
export function progress(db: Database.Database, userId: number, month: string): MonthProgress {
  const items = repository.listWithSpent(db, userId, month).map(
    (row): ProgressItem => ({
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      budgetMinor: row.budgetMinor,
      spentMinor: row.spentMinor,
      percent: displayPercent(row.spentMinor, row.budgetMinor),
      status: budgetStatus(row.spentMinor, row.budgetMinor),
    }),
  );
  const unbudgeted = repository.listUnbudgeted(db, userId, month).map(
    (row): UnbudgetedItem => ({
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      spentMinor: row.spentMinor,
    }),
  );
  return { month, items, unbudgeted };
}
