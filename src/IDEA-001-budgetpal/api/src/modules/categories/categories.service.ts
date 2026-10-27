import type Database from 'better-sqlite3';
import type { Problem } from '../../kernel/errors.js';
import { buildProblem } from '../../kernel/problem.js';
import type { Category, CreateCategory, UpdateCategory } from './categories.schema.js';
import * as repository from './categories.repository.js';
import { CategoryInUseError, DuplicateNameError } from './categories.repository.js';

const duplicateProblem = (instance: string): Problem =>
  buildProblem(409, 'A category with this name already exists.', {
    instance,
    errors: [{ field: 'name', message: 'A category with this name already exists.' }],
  });

const notFoundProblem = (instance: string): Problem =>
  buildProblem(404, 'No category with this id.', { instance });

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
    if (error instanceof DuplicateNameError) return { ok: false, problem: duplicateProblem(instance) };
    throw error;
  }
}

/**
 * Changes the name and/or kind of one of `userId`'s categories. Another category with the same name
 * (any letter case) is a 409; an unknown id or another user's id is a 404 (GR-002). Renaming a
 * category to its own current name succeeds because the unique index ignores the row itself.
 */
export function update(
  db: Database.Database,
  userId: number,
  id: number,
  changes: UpdateCategory,
  instance: string,
): Outcome<Category> {
  try {
    const updated = repository.update(db, userId, id, changes);
    if (!updated) return { ok: false, problem: notFoundProblem(instance) };
    return { ok: true, value: updated };
  } catch (error) {
    if (error instanceof DuplicateNameError) return { ok: false, problem: duplicateProblem(instance) };
    throw error;
  }
}

/** Deletes one of `userId`'s categories. Still referenced by another row -> 409 "in use"; unknown or foreign id -> 404. */
export function remove(db: Database.Database, userId: number, id: number, instance: string): Outcome<null> {
  try {
    if (!repository.remove(db, userId, id)) return { ok: false, problem: notFoundProblem(instance) };
    return { ok: true, value: null };
  } catch (error) {
    if (error instanceof CategoryInUseError) {
      return {
        ok: false,
        problem: buildProblem(409, 'This category is in use and cannot be deleted.', { instance }),
      };
    }
    throw error;
  }
}
