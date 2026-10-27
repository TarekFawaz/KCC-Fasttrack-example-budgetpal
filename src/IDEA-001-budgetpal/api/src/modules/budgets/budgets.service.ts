import type Database from 'better-sqlite3';
import type { Problem } from '../../kernel/errors.js';
import { buildProblem } from '../../kernel/problem.js';
import * as repository from './budgets.repository.js';
import type { BudgetDto } from './budgets.schema.js';

/** Either the value, or the problem+json body the route must send. */
export type Outcome<T> = { ok: true; value: T } | { ok: false; problem: Problem };

/**
 * Sets the budget of one of the user's expense categories for `month`. An unknown category and
 * another user's category are the same 404 (nothing reveals that it exists); an income category
 * is a 400 naming the field. Nothing is written in either case (GR-002).
 */
export function set(
  db: Database.Database,
  userId: number,
  month: string,
  categoryId: number,
  amountMinor: number,
  instance: string,
): Outcome<{ budget: BudgetDto; created: boolean }> {
  const kind = repository.categoryKind(db, userId, categoryId);
  if (kind === undefined) {
    return { ok: false, problem: buildProblem(404, 'No category with this id.', { instance }) };
  }
  if (kind !== 'expense') {
    return {
      ok: false,
      problem: buildProblem(400, 'A budget can only be set for an expense category.', {
        instance,
        errors: [{ field: 'categoryId', message: 'Choose an expense category.' }],
      }),
    };
  }
  const { budget, created } = repository.upsert(db, userId, categoryId, month, amountMinor);
  return { ok: true, value: { budget, created } };
}

/** Removes the user's budget; a missing budget (or someone else's) is a 404. */
export function remove(
  db: Database.Database,
  userId: number,
  month: string,
  categoryId: number,
  instance: string,
): Outcome<null> {
  if (!repository.remove(db, userId, categoryId, month)) {
    return { ok: false, problem: buildProblem(404, 'No budget for this category and month.', { instance }) };
  }
  return { ok: true, value: null };
}
