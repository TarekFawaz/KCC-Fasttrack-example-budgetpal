import type Database from 'better-sqlite3';
import type { Problem } from '../../kernel/errors.js';
import { buildProblem } from '../../kernel/problem.js';
import type { Account, CreateAccountInput, UpdateAccountInput } from './accounts.schemas.js';
import * as repository from './accounts.repository.js';
import { DuplicateName, InUse } from './accounts.repository.js';

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

const notFound = (instance: string): Problem =>
  buildProblem(404, 'No account with this id.', { instance });

const duplicateName = (instance: string): Problem =>
  buildProblem(409, 'An account with this name already exists.', {
    instance,
    errors: [{ field: 'name', message: 'You already have an account with this name.' }],
  });

/** One of the user's accounts; an id that is unknown or belongs to another user is the same 404. */
export function getAccount(
  db: Database.Database,
  userId: number,
  id: number,
  instance: string,
): ServiceResult<Account> {
  const account = repository.findById(db, userId, id);
  return account ? { ok: true, value: account } : { ok: false, problem: notFound(instance) };
}

/** Replaces the editable fields. 404 for a missing or foreign id, 409 for a name the user already has. */
export function updateAccount(
  db: Database.Database,
  userId: number,
  id: number,
  input: UpdateAccountInput,
  instance: string,
): ServiceResult<Account> {
  try {
    const account = repository.update(db, userId, id, input);
    return account ? { ok: true, value: account } : { ok: false, problem: notFound(instance) };
  } catch (error) {
    if (error instanceof DuplicateName) return { ok: false, problem: duplicateName(instance) };
    throw error;
  }
}

/**
 * Deletes the account. A foreign key that still points at it (a transaction) is a 409 that names the
 * rule, and the row stays.
 */
export function deleteAccount(
  db: Database.Database,
  userId: number,
  id: number,
  instance: string,
): ServiceResult<null> {
  try {
    return repository.remove(db, userId, id) ? { ok: true, value: null } : { ok: false, problem: notFound(instance) };
  } catch (error) {
    if (error instanceof InUse) {
      return {
        ok: false,
        problem: buildProblem(409, 'An account that transactions refer to cannot be deleted. Delete or move those transactions first.', {
          instance,
        }),
      };
    }
    throw error;
  }
}
