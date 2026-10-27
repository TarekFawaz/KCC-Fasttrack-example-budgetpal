-- SPEC-001 owns migrations 0001-0009. Forward-only; never edit after release.
CREATE TABLE app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
