import type Database from 'better-sqlite3';
import type { Problem } from '../../kernel/errors.js';
import { buildProblem } from '../../kernel/problem.js';
import type { Account, CreateAccountInput } from './accounts.schemas.js';
import * as repository from './accounts.repository.js';
import { DuplicateName } from './accounts.repository.js';

/** Use-case outcome: a value, or the problem+json body the route must send. */
export type ServiceResult<T> = { ok: true; value: T } | { ok: false; problem: Problem };

/** Lists the user's accounts, ordered by name. */
export function listAccounts(db: Database.Database, userId: number): Account[] {
  return repository.list(db, userId);
}

/**
 * Creates an account for the user. A name the user already has (ignoring case and surrounding spaces)
 * becomes a 409 problem; the repository wrote nothing in that case.
 */
export function createAccount(
  db: Database.Database,
  userId: number,
  input: CreateAccountInput,
  instance: string,
): ServiceResult<Account> {
  try {
    return { ok: true, value: repository.create(db, userId, input) };
  } catch (error) {
    if (error instanceof DuplicateName) {
      return {
        ok: false,
        problem: buildProblem(409, 'An account with this name already exists.', {
          instance,
          errors: [{ field: 'name', message: 'You already have an account with this name.' }],
        }),
      };
    }
    throw error;
  }
}
