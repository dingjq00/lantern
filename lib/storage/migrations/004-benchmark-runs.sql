-- 实验追踪：benchmark 运行记录
CREATE TABLE IF NOT EXISTS benchmark_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id        TEXT NOT NULL UNIQUE,
  timestamp     TEXT NOT NULL,
  config        TEXT NOT NULL,    -- JSON: model, prompt version, settings
  summary       TEXT NOT NULL,    -- JSON: recall, precision, perfect, per-level stats
  results       TEXT NOT NULL,    -- JSON: full per-question results with traces
  notes         TEXT,             -- 手动备注
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_benchmark_runs_time
  ON benchmark_runs (timestamp DESC);
