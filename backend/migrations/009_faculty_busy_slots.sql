-- ==========================================================
-- YenSync Migration 009: Faculty External Commitments
-- Stores faculty busy slots from other departments / years
-- (e.g. 1st year / Basic Science department classes)
-- without requiring a full timetable configuration.
-- ==========================================================

CREATE TABLE IF NOT EXISTS faculty_busy_slot (
    id SERIAL PRIMARY KEY,
    faculty_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
    timeslot_id INTEGER NOT NULL REFERENCES timeslot(id) ON DELETE CASCADE,
    academic_year VARCHAR(50) NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_faculty_busy_slot UNIQUE (faculty_id, timeslot_id, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_faculty_busy_slot_faculty ON faculty_busy_slot(faculty_id);
CREATE INDEX IF NOT EXISTS idx_faculty_busy_slot_year ON faculty_busy_slot(academic_year);

