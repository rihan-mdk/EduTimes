-- ============================================================
-- Migration 004: Generic Activities + Session Type
-- ============================================================

-- 1. Mark subjects that are non-academic activities (Library, Mentoring, etc.)
--    Generic activities skip faculty double-booking checks so multiple semesters
--    can share the same period simultaneously.
ALTER TABLE subject ADD COLUMN IF NOT EXISTS is_generic_activity BOOLEAN NOT NULL DEFAULT false;

-- 2. Distinguish how each individual timetable slot is used:
--      theory   – regular 1-hour lecture (default)
--      lab      – 1-hour practical/lab period
--      block    – consecutive multi-hour lab/project session (block_session_hours > 0)
--      activity – non-academic activity (Library, Mentoring, Placement, NSS/PE, etc.)
ALTER TABLE timetable_entry ADD COLUMN IF NOT EXISTS session_type VARCHAR(20) NOT NULL DEFAULT 'theory'
  CHECK (session_type IN ('theory', 'lab', 'block', 'activity'));
