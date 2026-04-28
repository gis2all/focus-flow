export const sqliteSchema = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timer_sessions (
  id TEXT PRIMARY KEY,
  phase TEXT NOT NULL,
  task_id TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_ms INTEGER NOT NULL,
  actual_duration_ms INTEGER,
  completed INTEGER NOT NULL DEFAULT 0,
  completion_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_timer_sessions_started_at ON timer_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_timer_sessions_active ON timer_sessions(ended_at, completed);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timer_runtime (
  slot TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_events_created_at ON app_events(created_at);
`
