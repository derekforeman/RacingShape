/** Canonical schema (roadmap §8). Idempotent; safe to run on every boot. */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS racers (
  github_login TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url   TEXT NOT NULL,
  first_seen   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  racer_login TEXT NOT NULL,
  type        TEXT NOT NULL,
  points      INTEGER NOT NULL,
  occurred_at TEXT NOT NULL,
  race_date   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_racedate ON events(race_date);
CREATE INDEX IF NOT EXISTS idx_events_racer    ON events(racer_login);

CREATE TABLE IF NOT EXISTS race_snapshots (
  race_date   TEXT NOT NULL,
  racer_login TEXT NOT NULL,
  score       INTEGER NOT NULL,
  captured_at TEXT NOT NULL,
  PRIMARY KEY (race_date, racer_login, captured_at)
);
CREATE INDEX IF NOT EXISTS idx_snap_racedate ON race_snapshots(race_date);

CREATE TABLE IF NOT EXISTS daily_stats (
  race_date     TEXT PRIMARY KEY,
  commits       INTEGER NOT NULL DEFAULT 0,
  prs_opened    INTEGER NOT NULL DEFAULT 0,
  prs_merged    INTEGER NOT NULL DEFAULT 0,
  issues_closed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reactions (
  id                 TEXT PRIMARY KEY,
  race_date          TEXT NOT NULL,
  target_racer_login TEXT NOT NULL,
  kind               TEXT NOT NULL,
  reactor            TEXT NOT NULL,
  created_at         TEXT NOT NULL,
  source             TEXT NOT NULL DEFAULT 'boost'
);
CREATE INDEX IF NOT EXISTS idx_reactions_racedate ON reactions(race_date);

CREATE TABLE IF NOT EXISTS http_cache (
  url           TEXT PRIMARY KEY,
  etag          TEXT,
  last_modified TEXT,
  body          TEXT,
  fetched_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS poll_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS viewer_peaks (
  race_date  TEXT PRIMARY KEY,
  peak_count INTEGER NOT NULL,
  peak_at    TEXT NOT NULL
);
`;
