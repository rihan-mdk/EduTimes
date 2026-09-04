-- ==========================================================
-- YenSync Initial Database Schema Migration
-- ==========================================================

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS department (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50)
);

-- 2. Faculty Table
CREATE TABLE IF NOT EXISTS faculty (
    id SERIAL PRIMARY KEY,
    faculty_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'faculty' CHECK (role IN ('admin', 'faculty')),
    department_id INTEGER NOT NULL REFERENCES department(id) ON DELETE CASCADE
);

-- 3. Semester Table
CREATE TABLE IF NOT EXISTS semester (
    id SERIAL PRIMARY KEY,
    number INTEGER NOT NULL CHECK (number > 0),
    department_id INTEGER NOT NULL REFERENCES department(id) ON DELETE CASCADE,
    class_room VARCHAR(100) NOT NULL,
    academic_year VARCHAR(50) NOT NULL
);

-- 4. Subject Table
CREATE TABLE IF NOT EXISTS subject (
    id SERIAL PRIMARY KEY,
    subject_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    semester_id INTEGER NOT NULL REFERENCES semester(id) ON DELETE CASCADE,
    faculty_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE RESTRICT,
    weekly_hours INTEGER NOT NULL CHECK (weekly_hours > 0),
    is_lab BOOLEAN NOT NULL DEFAULT FALSE,
    is_parallel_activity BOOLEAN NOT NULL DEFAULT FALSE,
    is_generic_activity BOOLEAN NOT NULL DEFAULT FALSE,
    block_session_hours INTEGER NOT NULL DEFAULT 0,
    block_session_count INTEGER NOT NULL DEFAULT 0
);

-- 5. Timeslot Table
CREATE TABLE IF NOT EXISTS timeslot (
    id SERIAL PRIMARY KEY,
    day VARCHAR(20) NOT NULL CHECK (day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')),
    period_number INTEGER NOT NULL CHECK (period_number > 0),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    UNIQUE (day, period_number)
);

-- 6. Timetable Entry Table
CREATE TABLE IF NOT EXISTS timetable_entry (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER NOT NULL REFERENCES subject(id) ON DELETE CASCADE,
    semester_id INTEGER NOT NULL REFERENCES semester(id) ON DELETE CASCADE,
    timeslot_id INTEGER NOT NULL REFERENCES timeslot(id) ON DELETE CASCADE,
    academic_year VARCHAR(50) NOT NULL,
    session_type VARCHAR(20) NOT NULL DEFAULT 'theory'
        CHECK (session_type IN ('theory', 'lab', 'block', 'activity')),
    CONSTRAINT uq_semester_timeslot_subject_year UNIQUE (semester_id, timeslot_id, subject_id, academic_year)
);

-- 7. Academic Calendar Table
CREATE TABLE IF NOT EXISTS academic_calendar (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'working' CHECK (type IN ('holiday', 'working')),
    remarks TEXT
);

-- Indexes for performance & query speed
CREATE INDEX IF NOT EXISTS idx_faculty_department ON faculty(department_id);
CREATE INDEX IF NOT EXISTS idx_semester_department ON semester(department_id);
CREATE INDEX IF NOT EXISTS idx_subject_semester ON subject(semester_id);
CREATE INDEX IF NOT EXISTS idx_subject_faculty ON subject(faculty_id);
CREATE INDEX IF NOT EXISTS idx_timetable_semester_year ON timetable_entry(semester_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_timetable_timeslot ON timetable_entry(timeslot_id);
CREATE INDEX IF NOT EXISTS idx_timetable_subject ON timetable_entry(subject_id);
