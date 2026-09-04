const { generateTimetable } = require('../src/services/scheduler');
const fs = require('fs');
const path = require('path');
const { newDb } = require('pg-mem');

const mem = newDb();
const m1 = fs.readFileSync(path.join(__dirname, '../migrations/001_initial_schema.sql'), 'utf8');
const m2 = fs.readFileSync(path.join(__dirname, '../migrations/002_seed_data.sql'), 'utf8');

mem.public.none(m1);
mem.public.none(m2);

const semesters = mem.public.many("SELECT * FROM semester WHERE academic_year = '2026-27'");
const subjects = mem.public.many("SELECT sub.*, sem.academic_year FROM subject sub JOIN semester sem ON sub.semester_id = sem.id WHERE sem.academic_year = '2026-27'");
const timeslots = mem.public.many("SELECT * FROM timeslot ORDER BY id ASC");

const result = generateTimetable({
  semesters,
  subjects,
  timeslots,
  academicYear: '2026-27'
});

console.log('Result:', result.success, 'Generated count:', result.schedule.length);

if (!result.success) {
  console.error('Failed:', result.message);
  process.exit(1);
}

const rowsSql = result.schedule.map(e => 
  `    (${e.subject_id}, ${e.semester_id}, ${e.timeslot_id}, '${e.academic_year}')`
).join(',\n');

const insertBlock = `\n-- 6. Insert Pre-generated Clash-Free Timetable Entries for AY 2026-27\nINSERT INTO timetable_entry (subject_id, semester_id, timeslot_id, academic_year)\nVALUES\n${rowsSql};\n`;

fs.writeFileSync(path.join(__dirname, 'timetable_inserts.sql'), insertBlock);
console.log('Successfully wrote timetable_inserts.sql with', result.schedule.length, 'entries.');
