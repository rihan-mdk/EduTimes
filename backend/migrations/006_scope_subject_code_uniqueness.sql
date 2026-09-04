-- ==========================================================
-- Migration 006: Scope Subject Code Uniqueness per Semester
-- Allows different departments / semesters to share subject codes (e.g. 1BCS31, 21MAT31, NSS, PE)
-- ==========================================================

-- 1. Drop the global unique constraint on subject_code if present
ALTER TABLE subject DROP CONSTRAINT IF EXISTS subject_subject_code_key;

-- 2. Add composite unique constraint per semester
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_subject_semester_code'
    ) THEN
        ALTER TABLE subject ADD CONSTRAINT uq_subject_semester_code UNIQUE (semester_id, subject_code);
    END IF;
END $$;
