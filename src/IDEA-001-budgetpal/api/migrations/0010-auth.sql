-- SPEC-002 owns migrations 0010-0019. Forward-only; never edit after release.
-- Timestamps are INTEGER epoch milliseconds (UTC).
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- id_hash is the SHA-256 (hex) of the 256-bit cookie value; the raw value is never stored.
CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX sessions_user_id ON sessions(user_id);
