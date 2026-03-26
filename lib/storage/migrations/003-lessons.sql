-- P1: 自学习 Lesson 表 — 从错误中学习
CREATE TABLE IF NOT EXISTS nl_lessons (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  intent_hash   TEXT NOT NULL,
  tenant_id     TEXT NOT NULL DEFAULT 'default',
  query         TEXT NOT NULL,
  selected_tools TEXT NOT NULL,   -- JSON array
  quality       TEXT NOT NULL,    -- good/partial/bad
  error_reason  TEXT,
  better_path   TEXT,             -- JSON array
  lesson        TEXT NOT NULL,    -- 一句话教训
  source        TEXT NOT NULL,    -- self_eval/user_feedback
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lessons_intent
  ON nl_lessons (tenant_id, intent_hash, created_at DESC);
