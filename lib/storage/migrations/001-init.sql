-- Insight68 Platform 存储层初始化
-- P0: SQLite + WAL 模式

PRAGMA journal_mode = WAL;

-- 会话层：记录每次查询的完整上下文
CREATE TABLE IF NOT EXISTS nl_memory_sessions (
  session_id   TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  tenant_id    TEXT NOT NULL DEFAULT 'default',
  query        TEXT NOT NULL,
  intent_hash  TEXT NOT NULL,
  tool_chain   TEXT NOT NULL DEFAULT '[]',  -- JSON array
  result_summary TEXT,
  routing_decision TEXT DEFAULT '{}',       -- JSON object
  feedback     TEXT,
  created_at   TEXT NOT NULL,               -- ISO 8601
  expires_at   TEXT NOT NULL,
  PRIMARY KEY (tenant_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_intent
  ON nl_memory_sessions (tenant_id, intent_hash, created_at DESC);

-- 经验层：意图→最优工具链的聚合结论
CREATE TABLE IF NOT EXISTS nl_memory_verdicts (
  intent_hash   TEXT NOT NULL,
  tenant_id     TEXT NOT NULL DEFAULT 'default',
  tool_chain    TEXT NOT NULL DEFAULT '[]',
  avg_score     REAL NOT NULL DEFAULT 0,
  sample_count  INTEGER NOT NULL DEFAULT 0,
  confidence    TEXT NOT NULL DEFAULT 'low',
  bonus_points  INTEGER NOT NULL DEFAULT 0,
  last_updated  TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  PRIMARY KEY (tenant_id, intent_hash)
);

-- 持久层：用户偏好
CREATE TABLE IF NOT EXISTS nl_memory_preferences (
  user_id     TEXT NOT NULL,
  tenant_id   TEXT NOT NULL DEFAULT 'default',
  preferences TEXT NOT NULL DEFAULT '{}',  -- JSON object
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (tenant_id, user_id)
);

-- 用户表
CREATE TABLE IF NOT EXISTS nl_users (
  user_id          TEXT NOT NULL,
  tenant_id        TEXT NOT NULL DEFAULT 'default',
  auth_type        TEXT NOT NULL DEFAULT 'api_key',
  allowed_systems  TEXT NOT NULL DEFAULT '["eam"]',
  allowed_tools    TEXT NOT NULL DEFAULT '["*"]',
  role             TEXT NOT NULL DEFAULT 'viewer',
  PRIMARY KEY (tenant_id, user_id)
);
