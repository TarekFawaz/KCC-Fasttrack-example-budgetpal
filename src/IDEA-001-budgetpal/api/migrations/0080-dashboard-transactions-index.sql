-- SPEC-008 owns migrations 0080-0089. Forward-only; never edit after release.
-- Serves the dashboard's per-user, per-month expense aggregates. Idempotent by name.
CREATE INDEX IF NOT EXISTS idx_transactions_dashboard ON transactions (user_id, occurred_on);
