import type Database from 'better-sqlite3';
import type { Problem } from '../../kernel/errors.js';
import { buildProblem } from '../../kernel/problem.js';
import type { Category, CreateCategory } from './categories.schema.js';
import * as repository from './categories.repository.js';
import { DuplicateNameError } from './categories.repository.js';

/** Either the value, or the problem+json body the route must send. */
export type Outcome<T> = { ok: true; value: T } | { ok: false; problem: Problem };

/** The caller's categories, ordered by name. Always scoped by `userId` (GR-002). */
export function list(db: Database.Database, userId: number): Category[] {
  return repository.list(db, userId);
}

/**
 * Creates a category for `userId`. A name the user already has (any letter case) is a 409 problem;
 * other users' names never collide.
 */
export function create(
  db: Database.Database,
  userId: number,
  input: CreateCategory,
  instance: string,
): Outcome<Category> {
  try {
    return { ok: true, value: repository.create(db, userId, input) };
  } catch (error) {
    if (error instanceof DuplicateNameError) {
      return {
        ok: false,
        problem: buildProblem(409, 'A category with this name already exists.', {
          instance,
          errors: [{ field: 'name', message: 'A category with this name already exists.' }],
        }),
      };
    }
    throw error;
  }
}
