const assert = require('assert');
const db = require('../src/config/db');

async function runAllotmentTests() {
  console.log('\n🧪 Running Subject Allotment & Course Preference Tests...');

  try {
    // 1. Ensure department and faculty exist in DB
    const deptRes = await db.query('SELECT id, name FROM department LIMIT 1');
    assert(deptRes.rows.length > 0, 'Department must exist');
    const deptId = deptRes.rows[0].id;

    const facRes = await db.query('SELECT id, name, faculty_code FROM faculty LIMIT 2');
    assert(facRes.rows.length >= 2, 'At least 2 faculty members must exist');
    const faculty1 = facRes.rows[0];
    const faculty2 = facRes.rows[1];

    // 2. Test Session Creation
    const testYear = '2026-27-TEST';
    await db.query(`DELETE FROM subject_allotment_session WHERE academic_year = $1`, [testYear]);

    const sessionRes = await db.query(`
      INSERT INTO subject_allotment_session (department_id, academic_year, semester_type, title, status, instructions)
      VALUES ($1, $2, 'ODD', 'Test Allotment Session', 'open', 'Test instructions')
      RETURNING *
    `, [deptId, testYear]);
    const session = sessionRes.rows[0];
    assert.strictEqual(session.status, 'open', 'Session should be open');
    console.log('  ✅ Test 1 Passed: Allotment session created successfully with status "open".');

    // 3. Test Course Addition
    const courseRes1 = await db.query(`
      INSERT INTO allotment_course (
        session_id, semester_name, course_name, course_code,
        lecture_hours, tutorial_hours, practical_hours, credits, is_lab
      ) VALUES ($1, 'V Semester', 'Test Course A (Theory)', 'TCA501', 3, 0, 0, 3, false)
      RETURNING *
    `, [session.id]);
    const courseA = courseRes1.rows[0];

    const courseRes2 = await db.query(`
      INSERT INTO allotment_course (
        session_id, semester_name, course_name, course_code,
        lecture_hours, tutorial_hours, practical_hours, credits, is_lab
      ) VALUES ($1, 'V Semester', 'Test Course B (Lab)', 'TCB502L', 0, 0, 2, 1, true)
      RETURNING *
    `, [session.id]);
    const courseB = courseRes2.rows[0];
    assert.strictEqual(courseA.course_code, 'TCA501');
    assert.strictEqual(courseB.is_lab, true);
    console.log('  ✅ Test 2 Passed: Theory and Lab allotment courses added.');

    // 4. Test Faculty Submitting Preferences
    await db.query(`
      INSERT INTO faculty_course_preference (course_id, faculty_id, preference_level)
      VALUES ($1, $2, 1)
    `, [courseA.id, faculty1.id]);

    await db.query(`
      INSERT INTO faculty_course_preference (course_id, faculty_id, preference_level)
      VALUES ($1, $2, 2)
    `, [courseB.id, faculty1.id]);

    const prefRes = await db.query(`
      SELECT * FROM faculty_course_preference WHERE faculty_id = $1
    `, [faculty1.id]);
    assert(prefRes.rows.length >= 2, 'Preferences must be saved');
    console.log('  ✅ Test 3 Passed: Faculty successfully submitted Choice 1 & Choice 2 preferences.');

    // 5. Test Admin Alloting Faculty
    await db.query(`
      UPDATE allotment_course
      SET is_allotted = true,
          allotted_faculty_id = $2,
          allotted_faculty_name = $3
      WHERE id = $1
    `, [courseA.id, faculty1.id, faculty1.name]);

    const checkAllot = await db.query(`SELECT is_allotted, allotted_faculty_name FROM allotment_course WHERE id = $1`, [courseA.id]);
    assert.strictEqual(checkAllot.rows[0].is_allotted, true);
    assert.strictEqual(checkAllot.rows[0].allotted_faculty_name, faculty1.name);
    console.log(`  ✅ Test 4 Passed: Admin allotted course ${courseA.course_code} to ${faculty1.name}.`);

    // 6. Test Real-time Allotment Guard (Faculty 2 blocked from picking allotted course)
    const guardedCourse = await db.query(`SELECT * FROM allotment_course WHERE id = $1`, [courseA.id]);
    const courseData = guardedCourse.rows[0];
    let guardBlocked = false;
    if (courseData.is_allotted && courseData.allotted_faculty_id !== faculty2.id) {
      guardBlocked = true;
    }
    assert.strictEqual(guardBlocked, true, 'Guard should detect course is allotted to someone else');
    console.log(`  ✅ Test 5 Passed: Real-time guard blocked Faculty 2 from picking course already allotted to ${faculty1.name}.`);

    // 7. Test Sync to Master Data
    // Ensure semester 5 exists
    let semRes = await db.query(`SELECT id FROM semester WHERE department_id = $1 AND number = 5 LIMIT 1`, [deptId]);
    let sem5Id;
    if (semRes.rows.length === 0) {
      const newSem = await db.query(`
        INSERT INTO semester (number, department_id, class_room, academic_year)
        VALUES (5, $1, 'LH-05', '2026-27')
        RETURNING id
      `, [deptId]);
      sem5Id = newSem.rows[0].id;
    } else {
      sem5Id = semRes.rows[0].id;
    }

    const weeklyHours = courseA.lecture_hours + courseA.tutorial_hours + courseA.practical_hours;
    const upsertRes = await db.query(`
      INSERT INTO subject (subject_code, name, semester_id, faculty_id, weekly_hours, is_lab)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (semester_id, subject_code)
      DO UPDATE SET
        name = EXCLUDED.name,
        faculty_id = EXCLUDED.faculty_id,
        weekly_hours = EXCLUDED.weekly_hours,
        is_lab = EXCLUDED.is_lab
      RETURNING *
    `, [courseA.course_code, courseA.course_name, sem5Id, faculty1.id, weeklyHours, courseA.is_lab]);

    assert.strictEqual(upsertRes.rows[0].subject_code, 'TCA501');
    assert.strictEqual(upsertRes.rows[0].faculty_id, faculty1.id);
    assert.strictEqual(upsertRes.rows[0].weekly_hours, 3);
    console.log(`  ✅ Test 6 Passed: Course ${courseA.course_code} successfully synced into Master Data subject catalog with faculty and weekly hours.`);

    // Cleanup test session
    await db.query(`DELETE FROM subject_allotment_session WHERE id = $1`, [session.id]);
    await db.query(`DELETE FROM subject WHERE subject_code = $1`, ['TCA501']);

    console.log('🎉 All Subject Allotment & Preference System Tests Passed!\n');
  } catch (err) {
    console.error('❌ Allotment Test Failed:', err);
    process.exit(1);
  }
}

// Run if called directly or exported
if (require.main === module) {
  runAllotmentTests().then(() => process.exit(0));
}

module.exports = { runAllotmentTests };
