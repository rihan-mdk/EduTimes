-- 012_subject_allotment_system.sql
-- Subject Allotment & Course Preference System Schema

-- 1. Subject Allotment Session (Per Department, Academic Year, and Semester Type)
CREATE TABLE IF NOT EXISTS subject_allotment_session (
    id SERIAL PRIMARY KEY,
    department_id INTEGER NOT NULL REFERENCES department(id) ON DELETE CASCADE,
    academic_year VARCHAR(50) NOT NULL,
    semester_type VARCHAR(10) NOT NULL CHECK (semester_type IN ('ODD', 'EVEN')),
    title VARCHAR(255) NOT NULL DEFAULT 'Subject Allotment / Course Preferences',
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'in_review', 'allotted', 'synced')),
    instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_session_dept_year_type UNIQUE (department_id, academic_year, semester_type)
);

-- 2. Allotment Course Catalog for Session
CREATE TABLE IF NOT EXISTS allotment_course (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES subject_allotment_session(id) ON DELETE CASCADE,
    semester_id INTEGER REFERENCES semester(id) ON DELETE SET NULL,
    semester_name VARCHAR(50) NOT NULL,
    course_name VARCHAR(255) NOT NULL,
    course_code VARCHAR(50) NOT NULL,
    lecture_hours INTEGER NOT NULL DEFAULT 0,
    tutorial_hours INTEGER NOT NULL DEFAULT 0,
    practical_hours INTEGER NOT NULL DEFAULT 0,
    credits INTEGER NOT NULL DEFAULT 0,
    is_lab BOOLEAN NOT NULL DEFAULT FALSE,
    is_allotted BOOLEAN NOT NULL DEFAULT FALSE,
    allotted_faculty_id INTEGER REFERENCES faculty(id) ON DELETE SET NULL,
    allotted_faculty_name VARCHAR(255),
    allotted_lab_faculty_id INTEGER REFERENCES faculty(id) ON DELETE SET NULL,
    allotted_lab_faculty_name VARCHAR(255),
    remarks TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Faculty Course Preferences (Choice 1 and Choice 2)
CREATE TABLE IF NOT EXISTS faculty_course_preference (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES allotment_course(id) ON DELETE CASCADE,
    faculty_id INTEGER NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
    preference_level INTEGER NOT NULL CHECK (preference_level IN (1, 2)),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_faculty_course_choice UNIQUE (course_id, faculty_id, preference_level)
);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_allotment_session_dept ON subject_allotment_session(department_id);
CREATE INDEX IF NOT EXISTS idx_allotment_course_session ON allotment_course(session_id);
CREATE INDEX IF NOT EXISTS idx_faculty_pref_course ON faculty_course_preference(course_id);
CREATE INDEX IF NOT EXISTS idx_faculty_pref_faculty ON faculty_course_preference(faculty_id);

-- Seed default active session for Department 1 (AIML) if exists
DO $$
DECLARE
    dept_rec RECORD;
    v_session_id INTEGER;
    sem3_id INTEGER;
    sem5_id INTEGER;
    sem7_id INTEGER;
BEGIN
    SELECT id, code, name INTO dept_rec FROM department ORDER BY id LIMIT 1;
    IF FOUND THEN
        -- Find existing semester IDs for this department if any
        SELECT id INTO sem3_id FROM semester WHERE department_id = dept_rec.id AND number = 3 LIMIT 1;
        SELECT id INTO sem5_id FROM semester WHERE department_id = dept_rec.id AND number = 5 LIMIT 1;
        SELECT id INTO sem7_id FROM semester WHERE department_id = dept_rec.id AND number = 7 LIMIT 1;

        INSERT INTO subject_allotment_session (department_id, academic_year, semester_type, title, status, instructions)
        VALUES (
            dept_rec.id, 
            '2026-27', 
            'ODD', 
            'Subject Allotment / Course Preferences', 
            'open', 
            'Please select your 1st and 2nd choices for Theory & Lab courses. Allotment will be finalized on merit and departmental requirements.'
        )
        ON CONFLICT (department_id, academic_year, semester_type) DO NOTHING
        RETURNING id INTO v_session_id;

        IF v_session_id IS NULL THEN
            SELECT id INTO v_session_id FROM subject_allotment_session 
            WHERE department_id = dept_rec.id AND academic_year = '2026-27' AND semester_type = 'ODD';
        END IF;

        IF v_session_id IS NOT NULL THEN
            -- Check if courses already exist for this session
            IF NOT EXISTS (SELECT 1 FROM allotment_course WHERE session_id = v_session_id) THEN
                -- III Semester Courses
                INSERT INTO allotment_course (session_id, semester_id, semester_name, course_name, course_code, lecture_hours, tutorial_hours, practical_hours, credits, is_lab, display_order)
                VALUES
                    (v_session_id, sem3_id, 'III Semester', 'Object Oriented Programming with Java', '1BCS302', 3, 0, 2, 4, false, 1),
                    (v_session_id, sem3_id, 'III Semester', 'Digital Design & Computer Organisation', '1BC303', 3, 0, 0, 3, false, 2),
                    (v_session_id, sem3_id, 'III Semester', 'Operating Systems', '1BC304', 3, 0, 0, 3, false, 3),
                    (v_session_id, sem3_id, 'III Semester', 'Data Structures and Applications', '1BC305', 3, 0, 0, 3, false, 4),
                    (v_session_id, sem3_id, 'III Semester', 'Data Structures Laboratory', '1BCSL306', 0, 0, 2, 1, true, 5),
                    (v_session_id, sem3_id, 'III Semester', 'Project Management with Git', '1BCSLK307A', 0, 0, 2, 1, false, 6),
                    (v_session_id, sem3_id, 'III Semester', 'Community Project (PBL)', '1BCP308', 0, 0, 2, 1, false, 7),
                    (v_session_id, sem3_id, 'III Semester', 'National Service Scheme (NSS)', '1BNS309', 0, 0, 2, 0, false, 8),
                    (v_session_id, sem3_id, 'III Semester', 'Physical Education (PE)', '1BPE309', 0, 0, 2, 0, false, 9);

                -- V Semester Courses
                INSERT INTO allotment_course (session_id, semester_id, semester_name, course_name, course_code, lecture_hours, tutorial_hours, practical_hours, credits, is_lab, display_order)
                VALUES
                    (v_session_id, sem5_id, 'V Semester', 'Software Engineering & Project Management', 'BCS501', 3, 0, 0, 3, false, 10),
                    (v_session_id, sem5_id, 'V Semester', 'Computer Networks', 'BCS502', 3, 0, 2, 4, false, 11),
                    (v_session_id, sem5_id, 'V Semester', 'Theory of Computation', 'BCS503', 3, 0, 0, 3, false, 12),
                    (v_session_id, sem5_id, 'V Semester', 'Data Visualization Lab', 'BAIL504', 0, 0, 2, 1, true, 13),
                    (v_session_id, sem5_id, 'V Semester', 'Computer Vision', 'BAI515A', 3, 0, 0, 3, false, 14),
                    (v_session_id, sem5_id, 'V Semester', 'Mini Project', 'BAI586', 0, 0, 2, 1, false, 15),
                    (v_session_id, sem5_id, 'V Semester', 'Research Methodology and IPR', 'BRMK557', 2, 0, 0, 2, false, 16),
                    (v_session_id, sem5_id, 'V Semester', 'Environmental Studies and E-waste Management', 'BCS508', 1, 0, 0, 1, false, 17),
                    (v_session_id, sem5_id, 'V Semester', 'National Service Scheme (NSS)', 'BNSK559', 0, 0, 2, 0, false, 18),
                    (v_session_id, sem5_id, 'V Semester', 'Physical Education (PE)', 'BPEK559', 0, 0, 2, 0, false, 19);

                -- VII Semester Courses
                INSERT INTO allotment_course (session_id, semester_id, semester_name, course_name, course_code, lecture_hours, tutorial_hours, practical_hours, credits, is_lab, display_order)
                VALUES
                    (v_session_id, sem7_id, 'VII Semester', 'Deep Learning & Reinforcement Learning', 'BAI701', 3, 0, 2, 4, false, 20),
                    (v_session_id, sem7_id, 'VII Semester', 'Machine Learning - II', 'BAI702', 3, 0, 2, 4, false, 21),
                    (v_session_id, sem7_id, 'VII Semester', 'Cloud Computing', 'BAI713', 3, 0, 0, 3, false, 22),
                    (v_session_id, sem7_id, 'VII Semester', 'Major Project Phase-II', 'BAI786', 0, 0, 8, 4, false, 23);
            END IF;
        END IF;
    END IF;
END $$;
