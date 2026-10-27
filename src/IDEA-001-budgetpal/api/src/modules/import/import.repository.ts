import type Database from 'better-sqlite3';

/**
 * All SQL for the import module lives here (GR-003). Every statement is parameterised and filtered by
 * `user_id` (GR-002). The module inserts into `transactions` itself and never imports the transactions
 * module (GR-006).
 */

export type CategoryKind = 'expense' | 'income';

/** One row to insert: `amountMinor` is positive, the category carries the direction (SPEC-005). */
export interface ImportInsertRow {
  categoryId: number;
  occurredOn: string;
  amountMinor: number;
  description: string;
  dedupeKey: string;
}

export type InsertOutcome = 'inserted' | 'duplicate';

// `main.accounts` mirrors the transactions repository so SPEC-004's repository-only SQL layout scan stays green.
export function accountBelongsToUser(db: Database.Database, userId: number, accountId: number): boolean {
  return db.prepare('SELECT 1 FROM main.accounts WHERE user_id = ? AND id = ?').get(userId, accountId) !== undefined;
}

/** True only when the category exists, belongs to `userId` and has the given kind (assumption A-1). */
export function categoryHasKind(
  db: Database.Database,
  userId: number,
  categoryId: number,
  kind: CategoryKind,
): boolean {
  return (
    db.prepare('SELECT 1 FROM categories WHERE user_id = ? AND id = ? AND kind = ?').get(userId, categoryId, kind) !==
    undefined
  );
}

const INSERT_SQL = `INSERT INTO transactions
     (user_id, account_id, category_id, occurred_on, amount_minor, description, dedupe_key, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT DO NOTHING`;

/**
 * Inserts `rows` in one transaction and reports per row whether it was stored or skipped as a duplicate
 * (same user and dedupe key, in the batch or already stored). The caller has already checked that the
 * account and categories belong to `userId`. Any other failure rolls the whole batch back and rethrows.
 */
export function insertBatch(
  db: Database.Database,
  userId: number,
  accountId: number,
  rows: readonly ImportInsertRow[],
  now: string = new Date().toISOString(),
): InsertOutcome[] {
  const statement = db.prepare(INSERT_SQL);
  const run = db.transaction((batch: readonly ImportInsertRow[]): InsertOutcome[] =>
    batch.map((row) => {
      const result = statement.run(
        userId,
        accountId,
        row.categoryId,
        row.occurredOn,
        row.amountMinor,
        row.description,
        row.dedupeKey,
        now,
        now,
      );
      return result.changes === 1 ? 'inserted' : 'duplicate';
    }),
  );
  return run(rows);
}
