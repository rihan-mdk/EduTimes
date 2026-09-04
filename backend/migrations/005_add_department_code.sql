-- ==========================================================
-- Migration 005: Add code column to department table
-- ==========================================================

ALTER TABLE department ADD COLUMN IF NOT EXISTS code VARCHAR(50);

-- Backfill existing department with code 'AIML' if null
UPDATE department SET code = 'AIML' WHERE code IS NULL OR code = '';

-- Set default and add unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_department_code ON department(code);
