-- P1: Trace 持久化 — 每次查询的完整执行追踪
CREATE TABLE IF NOT EXISTS nl_traces (
  trace_id    TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL DEFAULT 'default',
  session_id  TEXT,
  query       TEXT NOT NULL,
  trace_json  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_traces_tenant_time
  ON nl_traces (tenant_id, created_at DESC);
