-- SPEC-003 owns migrations 0030-0039. Forward-only; never edit after release.
-- Timestamps are UTC ISO 8601 text (D-13).
-- Other tables reference categories(id) with ON DELETE RESTRICT, so a category in use cannot be removed.
CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
  created_at TEXT NOT NULL
);

-- Names are unique per user, ignoring ASCII letter case.
CREATE UNIQUE INDEX categories_user_name ON categories (user_id, name COLLATE NOCASE);
