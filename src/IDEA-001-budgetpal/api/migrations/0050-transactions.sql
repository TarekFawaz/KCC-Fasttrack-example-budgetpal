-- SPEC-005 owns migrations 0050-0059. Forward-only; never edit after release.
-- Money is integer minor units (GR-007). Dates are YYYY-MM-DD text, timestamps UTC ISO 8601 text (D-13).
-- The foreign keys are RESTRICT, so an account or category in use cannot be deleted.
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  occurred_on TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  description TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Serves the per-user month list, newest first.
CREATE INDEX transactions_user_occurred_on ON transactions (user_id, occurred_on);
