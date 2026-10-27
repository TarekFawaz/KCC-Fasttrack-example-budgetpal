import type Database from 'better-sqlite3';
import { monthRange } from './schemas.js';
import * as repository from './spending.repository.js';
import type { CategoryTotal } from './spending.repository.js';

export interface SpendingSummary {
  month: string;
  currency: string;
  totalMinor: number;
  categories: CategoryTotal[];
}

/** Assembles the response from category rows: the total is their sum, in integer minor units. */
export function summarize(month: string, currency: string, categories: CategoryTotal[]): SpendingSummary {
  const totalMinor = categories.reduce((sum, row) => sum + row.amountMinor, 0);
  return { month, currency, totalMinor, categories };
}

/** Expense spending of `userId` in `month` (`YYYY-MM`), by category, largest first. */
export function spendingForMonth(db: Database.Database, userId: number, month: string, currency: string): SpendingSummary {
  const { from, to } = monthRange(month);
  return summarize(month, currency, repository.spendingByCategory(db, userId, from, to));
}
