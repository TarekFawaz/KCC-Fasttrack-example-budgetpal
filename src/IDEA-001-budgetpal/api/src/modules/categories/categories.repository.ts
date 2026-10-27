import type Database from 'better-sqlite3';
import type { Category, CreateCategory, UpdateCategory } from './categories.schema.js';

/** All SQL for the categories module lives here (GR-003): parameterised statements only. */

export class DuplicateNameError extends Error {
  constructor(options?: ErrorOptions) {
    super('A category with this name already exists.', options);
    this.name = 'DuplicateNameError';
  }
}

export class CategoryInUseError extends Error {
  constructor(options?: ErrorOptions) {
    super('The category is in use and cannot be deleted.', options);
    this.name = 'CategoryInUseError';
  }
}

interface CategoryRow {
  id: number;
  name: string;
  kind: 'expense' | 'income';
  created_at: string;
}

const COLUMNS = 'id, name, kind, created_at';

const toCategory = (row: CategoryRow): Category => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  createdAt: row.created_at,
});

const hasCode = (error: unknown, ...codes: string[]): boolean =>
  typeof error === 'object' &&
  error !== null &&
  codes.includes(String((error as { code?: unknown }).code));

// SQLite reports a violated ON DELETE RESTRICT as SQLITE_CONSTRAINT_TRIGGER, a plain
// foreign-key violation as SQLITE_CONSTRAINT_FOREIGNKEY; both mean "still referenced".
const FK_CODES = ['SQLITE_CONSTRAINT_FOREIGNKEY', 'SQLITE_CONSTRAINT_TRIGGER'];

/** The caller's categories, ordered by name (case-insensitive). */
export function list(db: Database.Database, userId: number): Category[] {
  const rows = db
    .prepare(`SELECT ${COLUMNS} FROM categories WHERE user_id = ? ORDER BY name COLLATE NOCASE, id`)
    .all(userId) as CategoryRow[];
  return rows.map(toCategory);
}

/** `undefined` when the id does not exist or belongs to another user. */
export function findById(db: Database.Database, userId: number, id: number): Category | undefined {
  const row = db
    .prepare(`SELECT ${COLUMNS} FROM categories WHERE id = ? AND user_id = ?`)
    .get(id, userId) as CategoryRow | undefined;
  return row ? toCategory(row) : undefined;
}

/** Throws `DuplicateNameError` when the user already has the name (any letter case). */
export function create(
  db: Database.Database,
  userId: number,
  input: CreateCategory,
  now: Date = new Date(),
): Category {
  try {
    const createdAt = now.toISOString();
    const result = db
      .prepare('INSERT INTO categories (user_id, name, kind, created_at) VALUES (?, ?, ?, ?)')
      .run(userId, input.name, input.kind, createdAt);
    return { id: Number(result.lastInsertRowid), name: input.name, kind: input.kind, createdAt };
  } catch (error) {
    if (hasCode(error, 'SQLITE_CONSTRAINT_UNIQUE')) throw new DuplicateNameError({ cause: error });
    throw error;
  }
}

/**
 * Changes the given fields. `undefined` when the id is missing or another user's.
 * Throws `DuplicateNameError` when the new name collides with another category of the user.
 */
export function update(
  db: Database.Database,
  userId: number,
  id: number,
  changes: UpdateCategory,
): Category | undefined {
  try {
    const result = db
      .prepare(
        'UPDATE categories SET name = COALESCE(?, name), kind = COALESCE(?, kind) WHERE id = ? AND user_id = ?',
      )
      .run(changes.name ?? null, changes.kind ?? null, id, userId);
    if (result.changes === 0) return undefined;
  } catch (error) {
    if (hasCode(error, 'SQLITE_CONSTRAINT_UNIQUE')) throw new DuplicateNameError({ cause: error });
    throw error;
  }
  return findById(db, userId, id);
}

/**
 * Returns true when a row was removed, false when the id is missing or another user's.
 * Throws `CategoryInUseError` when another row references the category (`ON DELETE RESTRICT`).
 */
export function remove(db: Database.Database, userId: number, id: number): boolean {
  try {
    return db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  } catch (error) {
    if (hasCode(error, ...FK_CODES)) throw new CategoryInUseError({ cause: error });
    throw error;
  }
}
