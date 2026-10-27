import type Database from 'better-sqlite3';

/** All SQL for the auth module lives here (GR-003): parameterised statements only. */

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: number;
}

export interface SessionRow {
  id_hash: string;
  user_id: number;
  created_at: number;
  last_seen_at: number;
  expires_at: number;
}

export interface SessionWithUser extends SessionRow {
  email: string;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}

/** Inserts a user. Returns `null` when the email (case-insensitive) is already taken. */
export function insertUser(
  db: Database.Database,
  input: { email: string; passwordHash: string; now: number },
): { id: number; email: string } | null {
  try {
    const result = db
      .prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)')
      .run(input.email, input.passwordHash, input.now);
    return { id: Number(result.lastInsertRowid), email: input.email };
  } catch (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }
}

export function findUserByEmail(db: Database.Database, email: string): UserRow | undefined {
  return db
    .prepare('SELECT id, email, password_hash, created_at FROM users WHERE email = ?')
    .get(email) as UserRow | undefined;
}

export function findUserById(db: Database.Database, id: number): Pick<UserRow, 'id' | 'email'> | undefined {
  return db.prepare('SELECT id, email FROM users WHERE id = ?').get(id) as
    | Pick<UserRow, 'id' | 'email'>
    | undefined;
}

export function insertSession(db: Database.Database, row: SessionRow): void {
  db.prepare(
    'INSERT INTO sessions (id_hash, user_id, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?)',
  ).run(row.id_hash, row.user_id, row.created_at, row.last_seen_at, row.expires_at);
}

export function findSessionWithUser(db: Database.Database, idHash: string): SessionWithUser | undefined {
  return db
    .prepare(
      `SELECT s.id_hash, s.user_id, s.created_at, s.last_seen_at, s.expires_at, u.email
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.id_hash = ?`,
    )
    .get(idHash) as SessionWithUser | undefined;
}

export function touchSession(db: Database.Database, idHash: string, now: number): void {
  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id_hash = ?').run(now, idHash);
}

/** Returns true when a row was removed. */
export function deleteSessionByHash(db: Database.Database, idHash: string): boolean {
  return db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(idHash).changes > 0;
}
