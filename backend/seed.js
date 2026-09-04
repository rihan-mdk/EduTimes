/**
 * Seed script for Smart Timetable Scheduler (YenSync)
 * Department: Artificial Intelligence and Machine Learning (AY 2026-27)
 * Semesters seeded: III (S3), V (S5), VII (S7)
 *
 * Usage: node seed.js
 */

const bcrypt = require("bcryptjs");
const db = require("./src/config/db");

const DEFAULT_PASSWORD = "Welcome@123";

// ---------- 1. FACULTY (deduplicated, corrected names) ----------
const faculty = [
  { code: "F01", name: "Mrs. Anjana Pai K", role: "admin" }, // F01 has admin role for initial admin access
  { code: "F02", name: "Mrs. Greeshma T.R", role: "faculty" },
  { code: "F03", name: "Mrs. Ramya A", role: "faculty" },
  { code: "F04", name: "Mr. Prasanna Kumar", role: "faculty" },
  { code: "F05", name: "Mrs. M.P Nisha", role: "faculty" },
  { code: "F06", name: "Mrs. Safmina P.K", role: "faculty" },
  { code: "F07", name: "Mr. Ede Naveen", role: "faculty" },
  { code: "F08", name: "Prof. Srinivas", role: "faculty" },
  { code: "F09", name: "Prof. Lokesh", role: "faculty" },
  { code: "F10", name: "Mr. Uttam Bhise", role: "faculty" },
  { code: "F11", name: "Mr. Augustine Felix Joshy", role: "faculty" },
  { code: "F12", name: "Ms. Soundarya S. Shetty", role: "faculty" },
  { code: "F13", name: "Mr. Shuvam Das", role: "faculty" },
  { code: "F14", name: "Dr. Pooja K Revankar", role: "faculty" },
  { code: "F15", name: "Dr. Ganesh K", role: "faculty" },
];

// ---------- 2. SEMESTERS ----------
const semesters = [
  { number: 3, class_room: "LLH-04", academic_year: "2026-27" },
  { number: 5, class_room: "LLH-02", academic_year: "2026-27" },
  { number: 7, class_room: "LLH-01", academic_year: "2026-27" },
];

// ---------- 3. TIMESLOTS (7 periods/day, Mon-Sat) ----------
const periodTimes = [
  ["09:00:00", "09:55:00"],
  ["09:55:00", "10:50:00"],
  ["11:10:00", "12:05:00"],
  ["12:05:00", "13:00:00"],
  ["13:50:00", "14:40:00"],
  ["14:40:00", "15:30:00"],
  ["15:30:00", "16:15:00"],
];

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ---------- 4. SUBJECTS ----------
// [semester_number, code, name, faculty_code, weekly_hours, is_lab, is_parallel,
//  block_session_hours, block_session_count]
const subjects = [
  // ---- Semester 3 ----
  [3, "1BCS301", "Probability, Distributions and Statistics", "F01", 4, false, false, 0, 0],
  [3, "1BCS302", "Object Oriented Programming with Java", "F02", 7, false, false, 2, 1],
  [3, "1BCS303", "Digital Design & Computer Organization", "F03", 5, false, false, 0, 0],
  [3, "1BCS304", "Operating Systems", "F04", 4, false, false, 0, 0],
  [3, "1BCS305", "Data Structures and Applications", "F05", 4, false, false, 0, 0],
  [3, "1BCSL306", "Data Structures Laboratory", "F05", 2, true, false, 2, 1],
  [3, "1BCSLK307A", "Project Management with Git", "F06", 2, true, false, 2, 1],
  [3, "1BCP308", "Community Project (PBL)", "F07", 3, false, false, 2, 1],
  [3, "1BNS309", "National Service Scheme (NSS)", "F08", 2, false, true, 0, 0],
  [3, "1BPE309", "Physical Education (PE)", "F09", 2, false, true, 0, 0],
  [3, "1BMATDIP310", "Mathematics for Lateral Entry Students", "F01", 1, false, false, 0, 0],

  // ---- Semester 5 ----
  [5, "BCS501", "Software Engineering & Project Management", "F06", 4, false, false, 0, 0],
  [5, "BCS502", "Computer Networks", "F03", 7, false, false, 2, 1],
  [5, "BCS503", "Theory of Computation", "F10", 4, false, false, 0, 0],
  [5, "BAIL504", "Data Visualization Lab", "F04", 2, true, false, 2, 1],
  [5, "BAI515A", "Computer Vision", "F07", 4, false, false, 0, 0],
  [5, "BAI586", "Mini Project", "F11", 3, false, false, 2, 1],
  [5, "BRMK557", "Research Methodology and IPR", "F04", 4, false, false, 0, 0],
  [5, "BCS508", "Environmental Studies and E-waste Management", "F12", 1, false, false, 0, 0],
  [5, "BNSK559", "National Service Scheme (NSS)", "F08", 2, false, true, 0, 0],
  [5, "BPEK559", "Physical Education (PE)", "F09", 2, false, true, 0, 0],

  // ---- Semester 7 ----
  [7, "BAI701", "Deep Learning & Reinforcement Learning", "F11", 6, false, false, 2, 1],
  [7, "BAI702", "Machine Learning - II", "F13", 5, false, false, 2, 1],
  [7, "BAD703", "Data Security & Privacy", "F06", 5, false, false, 0, 0],
  [7, "BCS714D", "Big Data Analytics", "F14", 4, false, false, 0, 0],
  [7, "BTE755C", "Embedded System Applications", "F15", 4, false, false, 0, 0],
  [7, "BAI786", "Major Project Phase-II", "F11", 8, false, false, 2, 4],
];

async function seed() {
  const client = await db.pool.connect();
  console.log("Connected. Seeding department, faculty, semesters, timeslots, subjects...");

  try {
    await client.query("BEGIN");

    // 1. Department
    let deptRes = await client.query(
      `SELECT id FROM department WHERE name = $1`,
      ["Artificial Intelligence and Machine Learning"]
    );
    let deptId;
    if (deptRes.rows.length === 0) {
      deptRes = await client.query(
        `INSERT INTO department (name) VALUES ($1) RETURNING id`,
        ["Artificial Intelligence and Machine Learning"]
      );
      deptId = deptRes.rows[0].id;
    } else {
      deptId = deptRes.rows[0].id;
    }

    // 2. Faculty
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const facultyMap = {};

    for (const f of faculty) {
      const existing = await client.query(`SELECT id FROM faculty WHERE faculty_code = $1`, [f.code]);
      if (existing.rows.length === 0) {
        const ins = await client.query(
          `INSERT INTO faculty (faculty_code, name, password_hash, role, department_id)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [f.code, f.name, passwordHash, f.role, deptId]
        );
        facultyMap[f.code] = ins.rows[0].id;
      } else {
        await client.query(
          `UPDATE faculty SET name = $1, department_id = $2, role = $3 WHERE faculty_code = $4`,
          [f.name, deptId, f.role, f.code]
        );
        facultyMap[f.code] = existing.rows[0].id;
      }
    }

    // 3. Semesters
    const semesterIds = {};
    for (const s of semesters) {
      const existing = await client.query(
        `SELECT id FROM semester WHERE number = $1 AND academic_year = $2 AND department_id = $3`,
        [s.number, s.academic_year, deptId]
      );
      if (existing.rows.length === 0) {
        const res = await client.query(
          `INSERT INTO semester (number, department_id, class_room, academic_year)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [s.number, deptId, s.class_room, s.academic_year]
        );
        semesterIds[s.number] = res.rows[0].id;
      } else {
        await client.query(
          `UPDATE semester SET class_room = $1 WHERE id = $2`,
          [s.class_room, existing.rows[0].id]
        );
        semesterIds[s.number] = existing.rows[0].id;
      }
    }

    // 4. Timeslots
    for (const day of days) {
      for (let i = 0; i < periodTimes.length; i++) {
        const [start, end] = periodTimes[i];
        const existing = await client.query(
          `SELECT id FROM timeslot WHERE day = $1 AND period_number = $2`,
          [day, i + 1]
        );
        if (existing.rows.length === 0) {
          await client.query(
            `INSERT INTO timeslot (day, period_number, start_time, end_time)
             VALUES ($1, $2, $3, $4)`,
            [day, i + 1, start, end]
          );
        }
      }
    }

    // 5. Subjects
    for (const [semNum, code, name, facCode, hours, isLab, isParallel, blockHours, blockCount] of subjects) {
      const facultyId = facultyMap[facCode];
      if (!facultyId) {
        console.warn(`Faculty ${facCode} not found for subject ${code} - skipping`);
        continue;
      }

      const existing = await client.query(`SELECT id FROM subject WHERE subject_code = $1`, [code]);
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO subject (subject_code, name, semester_id, faculty_id, weekly_hours, is_lab,
                                 is_parallel_activity, block_session_hours, block_session_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [code, name, semesterIds[semNum], facultyId, hours, isLab, isParallel, blockHours, blockCount]
        );
      } else {
        await client.query(
          `UPDATE subject SET
             name = $1, semester_id = $2, faculty_id = $3,
             weekly_hours = $4, is_lab = $5,
             is_parallel_activity = $6,
             block_session_hours = $7,
             block_session_count = $8
           WHERE subject_code = $9`,
          [name, semesterIds[semNum], facultyId, hours, isLab, isParallel, blockHours, blockCount, code]
        );
      }
    }

    // 6. Pre-generate & Populate Complete Clash-Free Schedule for AY 2026-27
    const { generateTimetable } = require("./src/services/scheduler");
    const [allSemRes, allSubRes, allTsRes] = await Promise.all([
      client.query("SELECT * FROM semester WHERE academic_year = $1 ORDER BY number ASC", ["2026-27"]),
      client.query(`
        SELECT sub.*, sem.academic_year
        FROM subject sub
        JOIN semester sem ON sub.semester_id = sem.id
        WHERE sem.academic_year = $1
      `, ["2026-27"]),
      client.query("SELECT * FROM timeslot ORDER BY id ASC")
    ]);

    const solution = generateTimetable({
      semesters: allSemRes.rows,
      subjects: allSubRes.rows,
      timeslots: allTsRes.rows,
      academicYear: "2026-27",
      existingEntries: []
    });

    if (solution.success) {
      await client.query("DELETE FROM timetable_entry WHERE academic_year = $1", ["2026-27"]);
      for (const entry of solution.schedule) {
        await client.query(
          `INSERT INTO timetable_entry (subject_id, semester_id, timeslot_id, academic_year)
           VALUES ($1, $2, $3, $4)`,
          [entry.subject_id, entry.semester_id, entry.timeslot_id, entry.academic_year]
        );
      }
      console.log(`✅ Pre-populated ${solution.schedule.length} timetable entries with 0 clashes for AY 2026-27.`);
    }

    await client.query("COMMIT");
    console.log("✅ Seed completed successfully.");
    console.log(`Seeded: 1 department, ${faculty.length} faculty, ${semesters.length} semesters, ${subjects.length} subjects, ${days.length * periodTimes.length} timeslots.`);
    console.log(`Default password for all faculty accounts: ${DEFAULT_PASSWORD}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seed failed, rolled back:", err);
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
