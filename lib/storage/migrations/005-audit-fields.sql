-- audit 增强：为自学习铺路，记录完整回答、轮次、耗时
-- 注意：ALTER TABLE 不幂等，initialize() 会 catch 重复列错误
ALTER TABLE nl_memory_sessions ADD COLUMN answer TEXT;
ALTER TABLE nl_memory_sessions ADD COLUMN rounds INTEGER;
ALTER TABLE nl_memory_sessions ADD COLUMN latency_ms INTEGER;
