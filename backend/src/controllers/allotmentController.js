const db = require('../config/db');
const { sanitizeText, sanitizeCode } = require('../utils/sanitize');

/**
 * Subject Allotment & Course Preferences Controller
 */

// 1. Get all allotment sessions for a department
async function getSessions(req, res) {
  try {
    const departmentId = req.query.department_id || req.user.department_id;
    if (!departmentId) {
      return res.status(400).json({ error: 'Department ID is required' });
    }

    const query = `
      SELECT s.*, d.name as department_name, d.code as department_code,
             COUNT(c.id)::int as total_courses,
             COUNT(CASE WHEN c.is_allotted THEN 1 END)::int as allotted_courses
      FROM subject_allotment_session s
      JOIN department d ON s.department_id = d.id
      LEFT JOIN allotment_course c ON s.id = c.session_id
      WHERE s.department_id = $1
      GROUP BY s.id, d.name, d.code
      ORDER BY s.created_at DESC
    `;
    const result = await db.query(query, [departmentId]);
    res.json(result.rows);
  } catch (err) {
    console.error('[Allotment] getSessions error:', err);
    res.status(500).json({ error: err.message });
  }
}

// 2. Create a new allotment session (Admin only)
async function createSession(req, res) {
  try {
    const departmentId = req.body.department_id || req.user.department_id;
    const { academic_year, semester_type, title, instructions, copy_from_existing } = req.body;

    if (!academic_year || !semester_type) {
      return res.status(400).json({ error: 'Academic year and semester type (ODD/EVEN) are required.' });
    }

    const cleanYear = sanitizeText(academic_year, 50);
    const cleanType = semester_type.toUpperCase() === 'EVEN' ? 'EVEN' : 'ODD';
    const cleanTitle = sanitizeText(title || `Subject Allotment (${cleanYear} ${cleanType} SEM)`, 255);
    const cleanInstructions = instructions ? sanitizeText(instructions, 2000) : 'Please submit your Choice 1 and Choice 2 preferences.';

    // Check duplicate
    const checkRes = await db.query(
      `SELECT id FROM subject_allotment_session WHERE department_id = $1 AND academic_year = $2 AND semester_type = $3`,
      [departmentId, cleanYear, cleanType]
    );
    if (checkRes.rows.length > 0) {
      return res.status(409).json({ error: `An allotment session for ${cleanYear} (${cleanType}) already exists.` });
    }

    const insertRes = await db.query(
      `INSERT INTO subject_allotment_session (department_id, academic_year, semester_type, title, status, instructions)
       VALUES ($1, $2, $3, $4, 'draft', $5)
       RETURNING *`,
      [departmentId, cleanYear, cleanType, cleanTitle, cleanInstructions]
    );
    const session = insertRes.rows[0];

    // Optional: copy existing subjects if requested
    if (copy_from_existing) {
      const semFilter = cleanType === 'ODD' ? [1, 3, 5, 7] : [2, 4, 6, 8];
      const subjectsRes = await db.query(`
        SELECT sub.*, sem.number as semester_number
        FROM subject sub
        JOIN semester sem ON sub.semester_id = sem.id
        WHERE sem.department_id = $1 AND sem.number = ANY($2::int[])
        ORDER BY sem.number ASC, sub.id ASC
      `, [departmentId, semFilter]);

      let order = 1;
      for (const sub of subjectsRes.rows) {
        const semName = `${romanize(sub.semester_number)} Semester`;
        const p_hours = sub.is_lab ? 2 : 0;
        const l_hours = Math.max(0, sub.weekly_hours - p_hours);
        const credits = sub.is_lab ? 1 : Math.max(1, l_hours);

        await db.query(`
          INSERT INTO allotment_course (
            session_id, semester_id, semester_name, course_name, course_code,
            lecture_hours, tutorial_hours, practical_hours, credits, is_lab, display_order
          ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, $9, $10)
        `, [session.id, sub.semester_id, semName, sub.name, sub.subject_code, l_hours, p_hours, credits, sub.is_lab, order++]);
      }
    }

    res.status(201).json(session);
  } catch (err) {
    console.error('[Allotment] createSession error:', err);
    res.status(500).json({ error: err.message });
  }
}

// 3. Get session details with all courses and preference applicant aggregations
async function getSessionDetails(req, res) {
  try {
    const { id } = req.params;
    const sessionRes = await db.query(`
      SELECT s.*, d.name as department_name, d.code as department_code
      FROM subject_allotment_session s
      JOIN department d ON s.department_id = d.id
      WHERE s.id = $1
    `, [id]);

    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Allotment session not found' });
    }
    const session = sessionRes.rows[0];

    // Get all courses with their preferences
    const coursesRes = await db.query(`
      SELECT c.*,
             COALESCE(
               json_agg(
                 json_build_object(
                   'faculty_id', f.id,
                   'faculty_name', f.name,
                   'faculty_code', f.faculty_code,
                   'preference_level', p.preference_level
                 )
               ) FILTER (WHERE f.id IS NOT NULL), '[]'
             ) as applicants
      FROM allotment_course c
      LEFT JOIN faculty_course_preference p ON c.id = p.course_id
      LEFT JOIN faculty f ON p.faculty_id = f.id
      WHERE c.session_id = $1
      GROUP BY c.id
      ORDER BY c.display_order ASC, c.id ASC
    `, [id]);

    // Format applicants into choice_1 and choice_2 lists
    const courses = coursesRes.rows.map(course => {
      const applicants = course.applicants || [];
      const choice_1 = applicants.filter(a => a.preference_level === 1);
      const choice_2 = applicants.filter(a => a.preference_level === 2);
      return {
        ...course,
        choice_1,
        choice_2,
        choice_1_count: choice_1.length,
        choice_2_count: choice_2.length
      };
    });

    res.json({ session, courses });
  } catch (err) {
    console.error('[Allotment] getSessionDetails error:', err);
    res.status(500).json({ error: err.message });
  }
}

// 4. Update session status (draft, open, in_review, allotted, synced)
async function updateSessionStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, title, instructions } = req.body;

    const validStatuses = ['draft', 'open', 'in_review', 'allotted', 'synced'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const updates = [];
    const params = [id];

    if (status) {
      params.push(status);
      updates.push(`status = $${params.length}`);
    }
    if (title !== undefined) {
      params.push(sanitizeText(title, 255));
      updates.push(`title = $${params.length}`);
    }
    if (instructions !== undefined) {
      params.push(sanitizeText(instructions, 2000));
      updates.push(`instructions = $${params.length}`);
    }
    updates.push(`updated_at = NOW()`);

    const result = await db.query(
      `UPDATE subject_allotment_session SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Allotment] updateSessionStatus error:', err);
    res.status(500).json({ error: err.message });
  }
}

// 5. Add Course to Session
async function addCourse(req, res) {
  try {
    const { session_id, semester_name, semester_id, course_name, course_code, lecture_hours, tutorial_hours, practical_hours, credits, is_lab } = req.body;

    if (!session_id || !course_name || !course_code || !semester_name) {
      return res.status(400).json({ error: 'Session ID, course name, course code, and semester are required.' });
    }

    const cleanCourseName = sanitizeText(course_name, 255);
    const cleanCourseCode = sanitizeCode(course_code, 50);
    const cleanSemName = sanitizeText(semester_name, 50);
    const L = parseInt(lecture_hours, 10) || 0;
    const T = parseInt(tutorial_hours, 10) || 0;
    const P = parseInt(practical_hours, 10) || 0;
    const C = parseInt(credits, 10) || (L + T + Math.floor(P / 2));
    const lab = Boolean(is_lab || P > 0 || cleanCourseCode.toUpperCase().includes('L'));

    // Get max display order
    const orderRes = await db.query(`SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM allotment_course WHERE session_id = $1`, [session_id]);
    const nextOrder = orderRes.rows[0].next_order;

    const result = await db.query(`
      INSERT INTO allotment_course (
        session_id, semester_id, semester_name, course_name, course_code,
        lecture_hours, tutorial_hours, practical_hours, credits, is_lab, display_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [session_id, semester_id || null, cleanSemName, cleanCourseName, cleanCourseCode, L, T, P, C, lab, nextOrder]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Allotment] addCourse error:', err);
    res.status(500).json({ error: err.message });
  }
}

// 6. Update Course
async function updateCourse(req, res) {
  try {
    const { id } = req.params;
    const { semester_name, course_name, course_code, lecture_hours, tutorial_hours, practical_hours, credits, is_lab, remarks } = req.body;

    const L = parseInt(lecture_hours, 10) || 0;
    const T = parseInt(tutorial_hours, 10) || 0;
    const P = parseInt(practical_hours, 10) || 0;
    const C = parseInt(credits, 10) || 0;

    const result = await db.query(`
      UPDATE allotment_course
      SET semester_name = COALESCE($2, semester_name),
          course_name = COALESCE($3, course_name),
          course_code = COALESCE($4, course_code),
          lecture_hours = $5,
          tutorial_hours = $6,
          practical_hours = $7,
          credits = $8,
          is_lab = COALESCE($9, is_lab),
          remarks = COALESCE($10, remarks)
      WHERE id = $1
      RETURNING *
    `, [id, semester_name, course_name, course_code, L, T, P, C, is_lab, remarks]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Allotment] updateCourse error:', err);
    res.status(500).json({ error: err.message });
  }
}

// 7. Delete Course
async function deleteCourse(req, res) {
  try {
    const { id } = req.params;
    const result = await db.query(`DELETE FROM allotment_course WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json({ message: 'Course deleted successfully' });
  } catch (err) {
    console.error('[Allotment] deleteCourse error:', err);
    res.status(500).json({ error: err.message });
  }
}

// 8. Allot / De-allot Faculty to Course (Admin)
async function allotFaculty(req, res) {
  try {
    const { course_id } = req.params;
    const { faculty_id, is_deallot, lab_faculty_id } = req.body;

    if (is_deallot) {
      const result = await db.query(`
        UPDATE allotment_course
        SET is_allotted = false,
            allotted_faculty_id = NULL,
            allotted_faculty_name = NULL,
            allotted_lab_faculty_id = NULL,
            allotted_lab_faculty_name = NULL
        WHERE id = $1
        RETURNING *
      `, [course_id]);
      return res.json(result.rows[0]);
    }

    let facultyName = null;
    if (faculty_id) {
      const facRes = await db.query(`SELECT name, faculty_code FROM faculty WHERE id = $1`, [faculty_id]);
      if (facRes.rows.length > 0) {
        facultyName = facRes.rows[0].name;
      }
    }

    let labFacultyName = null;
    if (lab_faculty_id) {
      const labRes = await db.query(`SELECT name, faculty_code FROM faculty WHERE id = $1`, [lab_faculty_id]);
      if (labRes.rows.length > 0) {
        labFacultyName = labRes.rows[0].name;
      }
    }

    const result = await db.query(`
      UPDATE allotment_course
      SET is_allotted = true,
          allotted_faculty_id = $2,
          allotted_faculty_name = $3,
          allotted_lab_faculty_id = $4,
          allotted_lab_faculty_name = $5
      WHERE id = $1
      RETURNING *
    `, [course_id, faculty_id || null, facultyName, lab_faculty_id || null, labFacultyName]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Allotment] allotFaculty error:', err);
    res.status(500).json({ error: err.message });
  }
}

// 9. Get Active Allotment Sheet for Faculty (with real-time allotment guard info)
async function getFacultySheet(req, res) {
  try {
    const facultyId = req.user.id;
    const departmentId = req.user.department_id;

    // Get active session ('open' or 'in_review')
    const sessionRes = await db.query(`
      SELECT s.*, d.name as department_name, d.code as department_code
      FROM subject_allotment_session s
      JOIN department d ON s.department_id = d.id
      WHERE s.department_id = $1 AND s.status IN ('open', 'in_review', 'allotted', 'synced')
      ORDER BY s.created_at DESC
      LIMIT 1
    `, [departmentId]);

    if (sessionRes.rows.length === 0) {
      return res.json({ session: null, courses: [], preferences: [] });
    }
    const session = sessionRes.rows[0];

    // Get courses
    const coursesRes = await db.query(`
      SELECT c.id, c.session_id, c.semester_id, c.semester_name, c.course_name, c.course_code,
             c.lecture_hours, c.tutorial_hours, c.practical_hours, c.credits, c.is_lab,
             c.is_allotted, c.allotted_faculty_id, c.allotted_faculty_name,
             c.allotted_lab_faculty_id, c.allotted_lab_faculty_name, c.display_order,
             CASE
               WHEN c.is_allotted AND c.allotted_faculty_id = $2 THEN true
               ELSE false
             END as is_allotted_to_me
      FROM allotment_course c
      WHERE c.session_id = $1
      ORDER BY c.display_order ASC, c.id ASC
    `, [session.id, facultyId]);

    // Get faculty's own submitted preferences
    const prefRes = await db.query(`
      SELECT course_id, preference_level
      FROM faculty_course_preference
      WHERE faculty_id = $1 AND course_id IN (SELECT id FROM allotment_course WHERE session_id = $2)
    `, [facultyId, session.id]);

    res.json({
      session,
      courses: coursesRes.rows,
      preferences: prefRes.rows
    });
  } catch (err) {
    console.error('[Allotment] getFacultySheet error:', err);
    res.status(500).json({ error: err.message });
  }
}

// 10. Submit Faculty Course Preferences (Choice 1 and Choice 2) with Real-Time Guard
async function submitPreferences(req, res) {
  try {
    const facultyId = req.user.id;
    const { session_id, choices } = req.body;

    if (!session_id || !Array.isArray(choices)) {
      return res.status(400).json({ error: 'Session ID and choices array are required.' });
    }

    // Verify session is currently 'open'
    const sessionRes = await db.query(`SELECT status FROM subject_allotment_session WHERE id = $1`, [session_id]);
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (sessionRes.rows[0].status !== 'open') {
      return res.status(403).json({ error: `Preference submissions are currently closed (Status: ${sessionRes.rows[0].status}).` });
    }

    // Real-Time Guard: Check if any chosen subject is ALREADY allotted to someone else!
    for (const choice of choices) {
      if (!choice.course_id) continue;
      const checkRes = await db.query(`
        SELECT course_name, course_code, is_allotted, allotted_faculty_id, allotted_faculty_name
        FROM allotment_course
        WHERE id = $1 AND session_id = $2
      `, [choice.course_id, session_id]);

      if (checkRes.rows.length > 0) {
        const course = checkRes.rows[0];
        if (course.is_allotted && course.allotted_faculty_id !== facultyId) {
          const facultyName = course.allotted_faculty_name || 'another faculty member';
          return res.status(409).json({
            error: `Course "${course.course_name} (${course.course_code})" has already been allotted to ${facultyName}. Please choose another subject.`
          });
        }
      }
    }

    // Remove existing preferences for this faculty in this session
    await db.query(`
      DELETE FROM faculty_course_preference
      WHERE faculty_id = $1 AND course_id IN (
        SELECT id FROM allotment_course WHERE session_id = $2
      )
    `, [facultyId, session_id]);

    // Insert new preferences
    for (const choice of choices) {
      if (!choice.course_id || !choice.preference_level) continue;
      await db.query(`
        INSERT INTO faculty_course_preference (course_id, faculty_id, preference_level)
        VALUES ($1, $2, $3)
        ON CONFLICT (course_id, faculty_id, preference_level) DO NOTHING
      `, [choice.course_id, facultyId, choice.preference_level]);
    }

    res.json({ message: 'Course preferences submitted successfully!' });
  } catch (err) {
    console.error('[Allotment] submitPreferences error:', err);
    res.status(500).json({ error: err.message });
  }
}

// 11. Sync Allotted Courses to Master Data (subject table)
async function syncToMasterData(req, res) {
  try {
    const { id } = req.params; // session_id
    const departmentId = req.user.department_id;

    // Verify session
    const sessionRes = await db.query(`
      SELECT s.*, d.name as department_name, d.code as department_code
      FROM subject_allotment_session s
      JOIN department d ON s.department_id = d.id
      WHERE s.id = $1
    `, [id]);

    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const session = sessionRes.rows[0];

    // Get allotted courses for this session
    const allottedRes = await db.query(`
      SELECT * FROM allotment_course
      WHERE session_id = $1 AND is_allotted = true
      ORDER BY display_order ASC, id ASC
    `, [id]);

    if (allottedRes.rows.length === 0) {
      return res.status(400).json({ error: 'No allotted courses found in this session to sync.' });
    }

    // Find or create semester IDs for this department
    const existingSemesters = await db.query(`
      SELECT id, number, class_room, academic_year FROM semester WHERE department_id = $1
    `, [departmentId]);
    const semMap = {};
    existingSemesters.rows.forEach(sem => {
      semMap[sem.number] = sem.id;
    });

    let syncedCount = 0;
    const syncedSubjects = [];

    for (const course of allottedRes.rows) {
      // Determine semester number from semester_name (e.g. "III Semester" -> 3)
      const semNum = parseRomanSemester(course.semester_name);
      let targetSemesterId = course.semester_id || semMap[semNum];

      if (!targetSemesterId) {
        // Create semester entry if not exists
        const createSem = await db.query(`
          INSERT INTO semester (number, department_id, class_room, academic_year)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `, [semNum || 3, departmentId, `LH-0${semNum || 3}`, session.academic_year]);
        targetSemesterId = createSem.rows[0].id;
        semMap[semNum] = targetSemesterId;
      }

      const weeklyHours = (course.lecture_hours + course.tutorial_hours + course.practical_hours) || (course.credits > 0 ? course.credits : 3);
      const isLab = Boolean(course.is_lab || course.practical_hours > 0 || course.course_code.toUpperCase().includes('L'));
      const blockHours = (course.practical_hours > 0 || isLab) ? 2 : 0;
      const blockCount = blockHours > 0 ? 1 : 0;

      // Upsert into subject table
      const upsertRes = await db.query(`
        INSERT INTO subject (
          subject_code, name, semester_id, faculty_id, weekly_hours,
          is_lab, block_session_hours, block_session_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (semester_id, subject_code)
        DO UPDATE SET
          name = EXCLUDED.name,
          faculty_id = EXCLUDED.faculty_id,
          weekly_hours = EXCLUDED.weekly_hours,
          is_lab = EXCLUDED.is_lab,
          block_session_hours = EXCLUDED.block_session_hours,
          block_session_count = EXCLUDED.block_session_count
        RETURNING *
      `, [course.course_code, course.course_name, targetSemesterId, course.allotted_faculty_id, weeklyHours, isLab, blockHours, blockCount]);

      syncedCount++;
      syncedSubjects.push({
        code: course.course_code,
        name: course.course_name,
        faculty: course.allotted_faculty_name,
        semester: course.semester_name
      });
    }

    // Update session status to 'synced'
    await db.query(`UPDATE subject_allotment_session SET status = 'synced', updated_at = NOW() WHERE id = $1`, [id]);

    res.json({
      message: `Successfully synced ${syncedCount} allotted subjects to Master Data!`,
      synced_count: syncedCount,
      subjects: syncedSubjects
    });
  } catch (err) {
    console.error('[Allotment] syncToMasterData error:', err);
    res.status(500).json({ error: err.message });
  }
}

// Helper: Roman Numeral to Integer
function parseRomanSemester(name) {
  if (!name) return 3;
  const upper = name.toUpperCase();
  if (upper.includes('VIII') || upper.includes('8')) return 8;
  if (upper.includes('VII') || upper.includes('7')) return 7;
  if (upper.includes('VI') || upper.includes('6')) return 6;
  if (upper.includes('IV') || upper.includes('4')) return 4;
  if (upper.includes('V') || upper.includes('5')) return 5;
  if (upper.includes('III') || upper.includes('3')) return 3;
  if (upper.includes('II') || upper.includes('2')) return 2;
  if (upper.includes('I') || upper.includes('1')) return 1;
  return 3;
}

// Helper: Integer to Roman Numeral
function romanize(num) {
  const lookup = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
  let roman = '';
  for (const i in lookup) {
    while (num >= lookup[i]) {
      roman += i;
      num -= lookup[i];
    }
  }
  return roman;
}

module.exports = {
  getSessions,
  createSession,
  getSessionDetails,
  updateSessionStatus,
  addCourse,
  updateCourse,
  deleteCourse,
  allotFaculty,
  getFacultySheet,
  submitPreferences,
  syncToMasterData
};
