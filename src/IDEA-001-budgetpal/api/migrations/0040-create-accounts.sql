-- SPEC-004 owns migrations 0040-0049. Forward-only; never edit after release.
-- Money is integer minor units (GR-007). Timestamps are INTEGER epoch milliseconds (UTC).
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'credit_card', 'cash', 'other')),
  opening_balance_minor INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- One name per user, ignoring case. The index also serves the per-user list query.
CREATE UNIQUE INDEX accounts_user_id_name ON accounts(user_id, name COLLATE NOCASE);
