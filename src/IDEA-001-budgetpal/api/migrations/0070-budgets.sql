-- SPEC-007 owns migrations 0070-0079. Forward-only; never edit after release.
-- Money is integer minor units (GR-007). Timestamps are UTC ISO 8601 text (D-13).
-- A budget is a limit, not a record: it goes with its user or its category (ON DELETE CASCADE).
-- `month` is 'YYYY-MM' text; the CHECK enforces the shape and a month number 01-12.
CREATE TABLE budgets (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (
    month GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]' AND substr(month, 6, 2) BETWEEN '01' AND '12'
  ),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- One budget per user, category and month; also the upsert conflict target.
CREATE UNIQUE INDEX budgets_user_category_month ON budgets (user_id, category_id, month);
