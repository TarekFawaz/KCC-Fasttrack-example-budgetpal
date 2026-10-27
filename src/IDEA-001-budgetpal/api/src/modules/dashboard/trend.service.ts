import type Database from 'better-sqlite3';
import { DEFAULT_TREND_MONTHS, monthRange } from './schemas.js';
import * as repository from './trend.repository.js';
import type { MonthTotal } from './trend.repository.js';

export interface TrendSummary {
  currency: string;
  points: MonthTotal[];
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** The `YYYY-MM` of `now` (UTC, like every stored timestamp, D-13). */
export function currentMonth(now: Date = new Date()): string {
  return `${String(now.getUTCFullYear()).padStart(4, '0')}-${pad(now.getUTCMonth() + 1)}`;
}

/** The `months` consecutive months ending at `end` (`YYYY-MM`), oldest first; crosses year boundaries. */
export function monthWindow(months: number, end: string): string[] {
  const endYear = Number(end.slice(0, 4));
  const endIndex = endYear * 12 + (Number(end.slice(5, 7)) - 1);
  const window: string[] = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const index = endIndex - offset;
    window.push(`${String(Math.floor(index / 12)).padStart(4, '0')}-${pad((index % 12) + 1)}`);
  }
  return window;
}

/** One point per window month, taking totals from `rows` and zero-filling months with no expenses. */
export function fillWindow(window: string[], rows: MonthTotal[]): MonthTotal[] {
  const totals = new Map(rows.map((row) => [row.month, row.totalMinor]));
  return window.map((month) => ({ month, totalMinor: totals.get(month) ?? 0 }));
}

export interface TrendOptions {
  months?: number;
  end?: string;
  /** Injected clock, so the default end month is testable. */
  now?: Date;
}

/** Monthly expense totals of `userId` for the window ending at `end` (default: the current month). */
export function trendForUser(db: Database.Database, userId: number, currency: string, options: TrendOptions = {}): TrendSummary {
  const months = options.months ?? DEFAULT_TREND_MONTHS;
  const end = options.end ?? currentMonth(options.now);
  const window = monthWindow(months, end);
  const first = window[0] as string;
  const from = monthRange(first).from;
  const to = monthRange(end).to;
  return { currency, points: fillWindow(window, repository.monthlyTotals(db, userId, from, to)) };
}
