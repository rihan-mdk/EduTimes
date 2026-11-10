-- ==========================================================
-- YenSync Migration 010: Enable Row Level Security (RLS)
-- Secures all tables against direct public PostgREST API access
-- while allowing the Express backend (postgres superuser)
-- full read/write access.
-- ==========================================================

ALTER TABLE IF EXISTS academic_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS department ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS faculty_busy_slot ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS semester ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subject ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS timeslot ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS timetable_entry ENABLE ROW LEVEL SECURITY;
