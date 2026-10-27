import type Database from 'better-sqlite3';
import type { Problem } from '../../kernel/errors.js';
import { buildProblem, type FieldError } from '../../kernel/problem.js';
import * as repository from './transactions.repository.js';
import type { CreateTransactionInput, PatchTransactionInput, Transaction } from './transactions.schemas.js';

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

const notFound = (instance: string): Problem => buildProblem(404, 'No transaction with this id.', { instance });

/**
 * Applies a patch to one of the user's transactions. An id that is unknown or belongs to another user is the same
 * 404 (nothing reveals that it exists). A changed account or category must be one of the user's, else 400 naming
 * the field; nothing is written in either case (GR-002).
 */
export function update(
  db: Database.Database,
  userId: number,
  id: number,
  patch: PatchTransactionInput,
  instance: string,
): Outcome<Transaction> {
  if (!repository.findById(db, userId, id)) return { ok: false, problem: notFound(instance) };
  const errors: FieldError[] = [];
  if (patch.accountId !== undefined && !repository.ownsAccount(db, userId, patch.accountId)) {
    errors.push({ field: 'accountId', message: 'Choose one of your accounts.' });
  }
  if (patch.categoryId !== undefined && !repository.ownsCategory(db, userId, patch.categoryId)) {
    errors.push({ field: 'categoryId', message: 'Choose one of your categories.' });
  }
  if (errors.length > 0) {
    return {
      ok: false,
      problem: buildProblem(400, 'The account or category does not exist.', { instance, errors }),
    };
  }
  const updated = repository.update(db, userId, id, patch);
  return updated ? { ok: true, value: updated } : { ok: false, problem: notFound(instance) };
}

/** Deletes one of the user's transactions; unknown and foreign ids are the same 404. */
export function remove(db: Database.Database, userId: number, id: number, instance: string): Outcome<null> {
  return repository.remove(db, userId, id) ? { ok: true, value: null } : { ok: false, problem: notFound(instance) };
}
