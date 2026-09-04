const db = require('../src/config/db');

async function test() {
  const q = await db.query(`
    SELECT 
      te.id,
      te.subject_id,
      te.semester_id,
      te.timeslot_id,
      te.academic_year,
      sub.subject_code,
      sub.name as subject_name,
      sub.is_lab,
      sub.weekly_hours,
      f.id as faculty_id,
      f.name as faculty_name,
      f.faculty_code,
      sem.number as semester_number,
      sem.class_room,
      ts.day,
      ts.period_number,
      ts.start_time,
      ts.end_time
    FROM timetable_entry te
    JOIN subject sub ON te.subject_id = sub.id
    JOIN faculty f ON sub.faculty_id = f.id
    JOIN semester sem ON te.semester_id = sem.id
    JOIN timeslot ts ON te.timeslot_id = ts.id
    WHERE sub.faculty_id = 6
  `);
  console.log('Query returned rows for Faculty 6 (Mrs. Safmina P.K):', q.rows.length);
  console.log('Classes:', q.rows.map(r => `${r.subject_code} (S${r.semester_number}) - ${r.day} Period ${r.period_number}`));
}

test();
