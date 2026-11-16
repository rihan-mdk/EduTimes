-- ==========================================================
-- YenSync Migration 011: Performance & Scalability Indexes
-- Accelerates cross-department timetable lookups,
-- semester filtering, and case-insensitive authentication.
-- ==========================================================

-- 1. Index academic_year directly on timetable_entry (accelerates fetchContextData and clash detection)
CREATE INDEX IF NOT EXISTS idx_timetable_academic_year ON timetable_entry(academic_year);

-- 2. Composite index on semester (department_id, academic_year) for department timetable generation
CREATE INDEX IF NOT EXISTS idx_semester_dept_year ON semester(department_id, academic_year);

-- 3. Functional lower-case index on faculty_code (accelerates case-insensitive login & profile validation)
CREATE INDEX IF NOT EXISTS idx_faculty_lower_code ON faculty(LOWER(faculty_code));

-- 4. Covered index on subject for joined semester & faculty lookups
CREATE INDEX IF NOT EXISTS idx_subject_semester_faculty ON subject(semester_id, faculty_id);
