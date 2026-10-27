-- SPEC-006 owns migrations 0060-0069. Forward-only; never edit after release.
-- Adds the CSV import duplicate key to SPEC-005's transactions table. Existing and manually entered
-- rows keep dedupe_key NULL, so they are never matched by an import. The key is a sha256 hex string (TEXT).
ALTER TABLE transactions ADD COLUMN dedupe_key TEXT;

-- One row per (user, key). Partial, so the NULL keys of manual rows do not collide. The key is per user,
-- so two users importing the same file each keep their own rows.
CREATE UNIQUE INDEX transactions_user_dedupe_key ON transactions (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
