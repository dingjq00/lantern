-- audit 增强：为自学习铺路，记录完整回答、轮次、耗时
ALTER TABLE nl_memory_sessions ADD COLUMN answer TEXT;
ALTER TABLE nl_memory_sessions ADD COLUMN rounds INTEGER;
ALTER TABLE nl_memory_sessions ADD COLUMN latency_ms INTEGER;
