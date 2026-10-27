import type Database from 'better-sqlite3';
import type { Problem } from '../../kernel/errors.js';
import { buildProblem, type FieldError } from '../../kernel/problem.js';
import * as repository from './transactions.repository.js';
import type { CreateTransactionInput, Transaction } from './transactions.schemas.js';

/** Either the value, or the problem+json body the route must send. */
export type Outcome<T> = { ok: true; value: T } | { ok: false; problem: Problem };

/**
 * Records a transaction for `userId`. The account and the category must both belong to `userId`; an
 * id that is foreign or unknown is a 400 naming the field, and nothing is written (GR-002). The two
 * cases are not told apart, so the response does not reveal that another user owns the id.
 */
export function create(
  db: Database.Database,
  userId: number,
  input: CreateTransactionInput,
  instance: string,
): Outcome<Transaction> {
  const errors: FieldError[] = [];
  if (!repository.ownsAccount(db, userId, input.accountId)) {
    errors.push({ field: 'accountId', message: 'Choose one of your accounts.' });
  }
  if (!repository.ownsCategory(db, userId, input.categoryId)) {
    errors.push({ field: 'categoryId', message: 'Choose one of your categories.' });
  }
  if (errors.length > 0) {
    return {
      ok: false,
      problem: buildProblem(400, 'The account or category does not exist.', { instance, errors }),
    };
  }
  return { ok: true, value: repository.insert(db, userId, input) };
}
