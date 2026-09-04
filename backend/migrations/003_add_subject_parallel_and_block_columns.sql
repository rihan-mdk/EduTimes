-- ==========================================================
-- Migration 003: Add parallel activity and block session columns to subject table
-- ==========================================================

ALTER TABLE subject ADD COLUMN IF NOT EXISTS is_parallel_activity BOOLEAN DEFAULT FALSE;
ALTER TABLE subject ADD COLUMN IF NOT EXISTS block_session_hours INTEGER DEFAULT 0;
ALTER TABLE subject ADD COLUMN IF NOT EXISTS block_session_count INTEGER DEFAULT 0;
