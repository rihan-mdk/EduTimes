-- 0. Clean any duplicate or pre-existing data
DELETE FROM timetable_entry;
DELETE FROM subject;
DELETE FROM timeslot;
DELETE FROM semester;
DELETE FROM faculty;
DELETE FROM department;

-- 1. Insert Department
INSERT INTO department (name) 
VALUES ('Artificial Intelligence and Machine Learning');

-- 2. Insert Initial Faculty (F01 to F15)
-- Default password: 'Welcome@123' -> Hash: $2a$10$PVPFar9SHF2bkYcwrNYBpuD/LBUt4keQzhrgRQai1//TnlrXmj5gu
INSERT INTO faculty (faculty_code, name, password_hash, role, department_id)
VALUES 
    ('F01', 'Mrs. Anjana Pai K', '$2a$10$PVPFar9SHF2bkYcwrNYBpuD/LBUt4keQzhrgRQai1//TnlrXmj5gu', 'admin', 1),
    ('F02', 'Mrs. Greeshma T.R', '$2a$10$PVPFar9SHF2bkYcwrNYBpuD/LBUt4keQzhrgRQai1//TnlrXmj5gu', 'faculty', 1),
    ('F03', 'Mrs. Ramya A', '$2a$10$PVPFar9SHF2bkYcwrNYBpuD/LBUt4keQzhrgRQai1//TnlrXmj5gu', 'faculty', 1),
    ('F04', 'Mr. Prasanna Kumar', '$2a$10$PVPFar9SHF2bkYcwrNYBpuD/LBUt4keQzhrgRQai1//TnlrXmj5gu', 'faculty', 1),
    ('F05', 'Mrs. M.P Nisha', '$2a$10$PVPFar9SHF2bkYcwrNYBpuD/LBUt4keQzhrgRQai1//TnlrXmj5gu', 'faculty', 1),
    ('F06', 'Mrs. Safmina P.K', '$2a$10$PVPFar9SHF2bkYcwrNYBpuD/LBUt4keQzhrgRQai1//TnlrXmj5gu', 'faculty', 1),
    ('F07', 'Mr. Ede Naveen', '$2a$10$PVPFar9SHF2bkYcwrNYBpuD/LBUt4keQzhrgRQai1//TnlrXmj5gu', 'faculty', 1),
    ('F08', 'Prof. Srinivas', '$2a$10$PVPFar9SHF2bkYcwrNYBpuD/LBUt4keQzhrgRQai1//TnlrXmj5gu', 'faculty', 1),
    ('F09', 'Prof. Lokesh', '$2a$10$PVPFar9SHF2bkYcwrNYBpuD/LBUt4keQzhrgRQai1//TnlrXmj5gu', 'faculty', 1),
    ('F10', 'Mr. Uttam Bhise', '$2a$10$PVPFar9SHF2bkYcwrNYBpuD/LBUt4keQzhrgRQai1//TnlrXmj5gu', 'faculty', 1),
    ('F11', 'Mr. Augustine Felix Joshy', '$2a$10$PVPFar9SHF2bkYcwrNYBpuD/LBUt4keQzhrgRQai1//TnlrXmj5gu', 'faculty', 1),
    ('F12', 'Ms. Soundarya S. Shetty', '$2a$10$PVPFar9SHF2bkYcwrNYBpuD/LBUt4keQzhrgRQai1//TnlrXmj5gu', 'faculty', 1),
    ('F13', 'Mr. Shuvam Das', '$2a$10$PVPFar9SHF2bkYcwrNYBpuD/LBUt4keQzhrgRQai1//TnlrXmj5gu', 'faculty', 1),
    ('F14', 'Dr. Pooja K Revankar', '$2a$10$PVPFar9SHF2bkYcwrNYBpuD/LBUt4keQzhrgRQai1//TnlrXmj5gu', 'faculty', 1),
    ('F15', 'Dr. Ganesh K', '$2a$10$PVPFar9SHF2bkYcwrNYBpuD/LBUt4keQzhrgRQai1//TnlrXmj5gu', 'faculty', 1);

-- 3. Insert Semesters (S3, S5, S7)
INSERT INTO semester (number, department_id, class_room, academic_year)
VALUES
    (3, 1, 'LLH-04', '2026-27'),
    (5, 1, 'LLH-02', '2026-27'),
    (7, 1, 'LLH-01', '2026-27');

-- 4. Insert Timeslots (Monday to Saturday, 7 periods per day)
INSERT INTO timeslot (day, period_number, start_time, end_time)
VALUES
    -- Monday
    ('Monday', 1, '09:00:00', '09:55:00'),
    ('Monday', 2, '09:55:00', '10:50:00'),
    ('Monday', 3, '11:10:00', '12:05:00'),
    ('Monday', 4, '12:05:00', '13:00:00'),
    ('Monday', 5, '13:50:00', '14:40:00'),
    ('Monday', 6, '14:40:00', '15:30:00'),
    ('Monday', 7, '15:30:00', '16:15:00'),
    -- Tuesday
    ('Tuesday', 1, '09:00:00', '09:55:00'),
    ('Tuesday', 2, '09:55:00', '10:50:00'),
    ('Tuesday', 3, '11:10:00', '12:05:00'),
    ('Tuesday', 4, '12:05:00', '13:00:00'),
    ('Tuesday', 5, '13:50:00', '14:40:00'),
    ('Tuesday', 6, '14:40:00', '15:30:00'),
    ('Tuesday', 7, '15:30:00', '16:15:00'),
    -- Wednesday
    ('Wednesday', 1, '09:00:00', '09:55:00'),
    ('Wednesday', 2, '09:55:00', '10:50:00'),
    ('Wednesday', 3, '11:10:00', '12:05:00'),
    ('Wednesday', 4, '12:05:00', '13:00:00'),
    ('Wednesday', 5, '13:50:00', '14:40:00'),
    ('Wednesday', 6, '14:40:00', '15:30:00'),
    ('Wednesday', 7, '15:30:00', '16:15:00'),
    -- Thursday
    ('Thursday', 1, '09:00:00', '09:55:00'),
    ('Thursday', 2, '09:55:00', '10:50:00'),
    ('Thursday', 3, '11:10:00', '12:05:00'),
    ('Thursday', 4, '12:05:00', '13:00:00'),
    ('Thursday', 5, '13:50:00', '14:40:00'),
    ('Thursday', 6, '14:40:00', '15:30:00'),
    ('Thursday', 7, '15:30:00', '16:15:00'),
    -- Friday
    ('Friday', 1, '09:00:00', '09:55:00'),
    ('Friday', 2, '09:55:00', '10:50:00'),
    ('Friday', 3, '11:10:00', '12:05:00'),
    ('Friday', 4, '12:05:00', '13:00:00'),
    ('Friday', 5, '13:50:00', '14:40:00'),
    ('Friday', 6, '14:40:00', '15:30:00'),
    ('Friday', 7, '15:30:00', '16:15:00'),
    -- Saturday
    ('Saturday', 1, '09:00:00', '09:55:00'),
    ('Saturday', 2, '09:55:00', '10:50:00'),
    ('Saturday', 3, '11:10:00', '12:05:00'),
    ('Saturday', 4, '12:05:00', '13:00:00'),
    ('Saturday', 5, '13:50:00', '14:40:00'),
    ('Saturday', 6, '14:40:00', '15:30:00'),
    ('Saturday', 7, '15:30:00', '16:15:00');

-- 5. Insert AIML Subjects with Block & Parallel Columns
-- S3: Semester 1, S5: Semester 2, S7: Semester 3
-- F01=1, F02=2, F03=3, F04=4, F05=5, F06=6, F07=7, F08=8, F09=9, F10=10, F11=11, F12=12, F13=13, F14=14, F15=15
INSERT INTO subject (subject_code, name, semester_id, faculty_id, weekly_hours, is_lab, is_parallel_activity, block_session_hours, block_session_count)
VALUES
    -- ---- Semester 3 ----
    ('1BCS301', 'Probability, Distributions and Statistics', 1, 1, 4, FALSE, FALSE, 0, 0),
    ('1BCS302', 'Object Oriented Programming with Java', 1, 2, 7, FALSE, FALSE, 2, 1),
    ('1BCS303', 'Digital Design & Computer Organization', 1, 3, 5, FALSE, FALSE, 0, 0),
    ('1BCS304', 'Operating Systems', 1, 4, 4, FALSE, FALSE, 0, 0),
    ('1BCS305', 'Data Structures and Applications', 1, 5, 4, FALSE, FALSE, 0, 0),
    ('1BCSL306', 'Data Structures Laboratory', 1, 5, 2, TRUE, FALSE, 2, 1),
    ('1BCSLK307A', 'Project Management with Git', 1, 6, 2, TRUE, FALSE, 2, 1),
    ('1BCP308', 'Community Project (PBL)', 1, 7, 3, FALSE, FALSE, 2, 1),
    ('1BNS309', 'National Service Scheme (NSS)', 1, 8, 2, FALSE, TRUE, 0, 0),
    ('1BPE309', 'Physical Education (PE)', 1, 9, 2, FALSE, TRUE, 0, 0),
    ('1BMATDIP310', 'Mathematics for Lateral Entry Students', 1, 1, 1, FALSE, FALSE, 0, 0),

    -- ---- Semester 5 ----
    ('BCS501', 'Software Engineering & Project Management', 2, 6, 4, FALSE, FALSE, 0, 0),
    ('BCS502', 'Computer Networks', 2, 3, 7, FALSE, FALSE, 2, 1),
    ('BCS503', 'Theory of Computation', 2, 10, 4, FALSE, FALSE, 0, 0),
    ('BAIL504', 'Data Visualization Lab', 2, 4, 2, TRUE, FALSE, 2, 1),
    ('BAI515A', 'Computer Vision', 2, 7, 4, FALSE, FALSE, 0, 0),
    ('BAI586', 'Mini Project', 2, 11, 3, FALSE, FALSE, 2, 1),
    ('BRMK557', 'Research Methodology and IPR', 2, 4, 4, FALSE, FALSE, 0, 0),
    ('BCS508', 'Environmental Studies and E-waste Management', 2, 12, 1, FALSE, FALSE, 0, 0),
    ('BNSK559', 'National Service Scheme (NSS)', 2, 8, 2, FALSE, TRUE, 0, 0),
    ('BPEK559', 'Physical Education (PE)', 2, 9, 2, FALSE, TRUE, 0, 0),

    -- ---- Semester 7 ----
    ('BAI701', 'Deep Learning & Reinforcement Learning', 3, 11, 6, FALSE, FALSE, 2, 1),
    ('BAI702', 'Machine Learning - II', 3, 13, 5, FALSE, FALSE, 2, 1),
    ('BAD703', 'Data Security & Privacy', 3, 6, 5, FALSE, FALSE, 0, 0),
    ('BCS714D', 'Big Data Analytics', 3, 14, 4, FALSE, FALSE, 0, 0),
    ('BTE755C', 'Embedded System Applications', 3, 15, 4, FALSE, FALSE, 0, 0),
    ('BAI786', 'Major Project Phase-II', 3, 11, 8, FALSE, FALSE, 2, 4);

-- 6. Insert Pre-generated Clash-Free Timetable Entries for AY 2026-27 (Semesters 3, 5, 7)
INSERT INTO timetable_entry (subject_id, semester_id, timeslot_id, academic_year)
VALUES
    (17, 2, 1, '2026-27'),
    (17, 2, 2, '2026-27'),
    (22, 3, 3, '2026-27'),
    (22, 3, 4, '2026-27'),
    (27, 3, 5, '2026-27'),
    (27, 3, 6, '2026-27'),
    (27, 3, 8, '2026-27'),
    (27, 3, 9, '2026-27'),
    (27, 3, 15, '2026-27'),
    (27, 3, 16, '2026-27'),
    (27, 3, 22, '2026-27'),
    (27, 3, 23, '2026-27'),
    (13, 2, 3, '2026-27'),
    (13, 2, 4, '2026-27'),
    (7, 1, 1, '2026-27'),
    (7, 1, 2, '2026-27'),
    (15, 2, 5, '2026-27'),
    (15, 2, 6, '2026-27'),
    (8, 1, 3, '2026-27'),
    (8, 1, 4, '2026-27'),
    (2, 1, 5, '2026-27'),
    (2, 1, 6, '2026-27'),
    (6, 1, 8, '2026-27'),
    (6, 1, 9, '2026-27'),
    (23, 3, 1, '2026-27'),
    (23, 3, 2, '2026-27'),
    (9, 1, 7, '2026-27'),
    (9, 1, 10, '2026-27'),
    (10, 1, 7, '2026-27'),
    (10, 1, 10, '2026-27'),
    (21, 2, 8, '2026-27'),
    (21, 2, 15, '2026-27'),
    (20, 2, 8, '2026-27'),
    (20, 2, 15, '2026-27'),
    (17, 2, 10, '2026-27'),
    (22, 3, 11, '2026-27'),
    (22, 3, 17, '2026-27'),
    (22, 3, 24, '2026-27'),
    (22, 3, 31, '2026-27'),
    (13, 2, 11, '2026-27'),
    (13, 2, 17, '2026-27'),
    (13, 2, 24, '2026-27'),
    (13, 2, 31, '2026-27'),
    (13, 2, 36, '2026-27'),
    (24, 3, 7, '2026-27'),
    (24, 3, 10, '2026-27'),
    (24, 3, 18, '2026-27'),
    (24, 3, 25, '2026-27'),
    (24, 3, 32, '2026-27'),
    (3, 1, 8, '2026-27'),
    (3, 1, 15, '2026-27'),
    (3, 1, 22, '2026-27'),
    (3, 1, 29, '2026-27'),
    (3, 1, 36, '2026-27'),
    (2, 1, 11, '2026-27'),
    (2, 1, 16, '2026-27'),
    (2, 1, 23, '2026-27'),
    (2, 1, 30, '2026-27'),
    (2, 1, 37, '2026-27'),
    (23, 3, 12, '2026-27'),
    (23, 3, 19, '2026-27'),
    (23, 3, 26, '2026-27'),
    (18, 2, 12, '2026-27'),
    (18, 2, 18, '2026-27'),
    (18, 2, 22, '2026-27'),
    (18, 2, 29, '2026-27'),
    (12, 2, 13, '2026-27'),
    (12, 2, 19, '2026-27'),
    (12, 2, 23, '2026-27'),
    (12, 2, 30, '2026-27'),
    (4, 1, 12, '2026-27'),
    (4, 1, 17, '2026-27'),
    (4, 1, 24, '2026-27'),
    (4, 1, 31, '2026-27'),
    (1, 1, 13, '2026-27'),
    (1, 1, 18, '2026-27'),
    (1, 1, 25, '2026-27'),
    (1, 1, 32, '2026-27'),
    (5, 1, 14, '2026-27'),
    (5, 1, 19, '2026-27'),
    (5, 1, 26, '2026-27'),
    (5, 1, 33, '2026-27'),
    (14, 2, 14, '2026-27'),
    (14, 2, 25, '2026-27'),
    (14, 2, 32, '2026-27'),
    (14, 2, 37, '2026-27'),
    (16, 2, 16, '2026-27'),
    (16, 2, 26, '2026-27'),
    (16, 2, 33, '2026-27'),
    (16, 2, 38, '2026-27'),
    (25, 3, 13, '2026-27'),
    (25, 3, 20, '2026-27'),
    (25, 3, 27, '2026-27'),
    (25, 3, 33, '2026-27'),
    (26, 3, 14, '2026-27'),
    (26, 3, 21, '2026-27'),
    (26, 3, 28, '2026-27'),
    (26, 3, 34, '2026-27'),
    (8, 1, 20, '2026-27'),
    (11, 1, 21, '2026-27'),
    (19, 2, 27, '2026-27');
