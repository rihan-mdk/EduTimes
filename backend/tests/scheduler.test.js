const assert = require('assert');
const { generateTimetable } = require('../src/services/scheduler');
const { validateEntireSchedule } = require('../src/services/clashDetector');

console.log('🧪 Running Deterministic Backtracking Scheduler Tests...');

const mockSemesters = [
  { id: 1, number: 3, class_room: 'LH-301', academic_year: '2025-2026' },
  { id: 2, number: 5, class_room: 'LH-401', academic_year: '2025-2026' },
  { id: 3, number: 7, class_room: 'LH-501', academic_year: '2025-2026' }
];

// Timeslots: Monday to Friday, 5 periods each = 25 periods
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const mockTimeslots = [];
let tsId = 1;
for (const day of days) {
  for (let period = 1; period <= 5; period++) {
    mockTimeslots.push({
      id: tsId++,
      day,
      period_number: period,
      start_time: `${8 + period}:00:00`,
      end_time: `${9 + period}:00:00`
    });
  }
}

// 3 Semesters sharing 4 Faculty members with intensive load
const mockSubjects = [
  // Sem 1 (Total: 14 hours)
  { id: 1, subject_code: 'CS301', name: 'DSA', semester_id: 1, faculty_id: 10, weekly_hours: 4, is_lab: false },
  { id: 2, subject_code: 'CS302', name: 'Digital Logic', semester_id: 1, faculty_id: 20, weekly_hours: 4, is_lab: false },
  { id: 3, subject_code: 'CS303', name: 'Discrete Math', semester_id: 1, faculty_id: 30, weekly_hours: 3, is_lab: false },
  { id: 4, subject_code: 'CS304', name: 'OOP Java', semester_id: 1, faculty_id: 40, weekly_hours: 3, is_lab: false },

  // Sem 2 (Total: 14 hours, shares faculty 10, 20, 30)
  { id: 5, subject_code: 'CS501', name: 'DBMS', semester_id: 2, faculty_id: 10, weekly_hours: 4, is_lab: false },
  { id: 6, subject_code: 'CS502', name: 'OS', semester_id: 2, faculty_id: 20, weekly_hours: 4, is_lab: false },
  { id: 7, subject_code: 'CS503', name: 'TOC', semester_id: 2, faculty_id: 30, weekly_hours: 3, is_lab: false },
  { id: 8, subject_code: 'CS504', name: 'Networks', semester_id: 2, faculty_id: 40, weekly_hours: 3, is_lab: false },

  // Sem 3 (Total: 13 hours, shares faculty 10, 20, 30, 40)
  { id: 9, subject_code: 'CS701', name: 'Cloud', semester_id: 3, faculty_id: 20, weekly_hours: 4, is_lab: false },
  { id: 10, subject_code: 'CS702', name: 'AI/ML', semester_id: 3, faculty_id: 30, weekly_hours: 4, is_lab: false },
  { id: 11, subject_code: 'CS703', name: 'Security', semester_id: 3, faculty_id: 40, weekly_hours: 3, is_lab: false },
  { id: 12, subject_code: 'CS704', name: 'Distributed', semester_id: 3, faculty_id: 10, weekly_hours: 2, is_lab: false },
];

const totalDemandedHours = mockSubjects.reduce((acc, s) => acc + s.weekly_hours, 0); // 14 + 14 + 13 = 41 hours total

const result = generateTimetable({
  semesters: mockSemesters,
  subjects: mockSubjects,
  timeslots: mockTimeslots,
  academicYear: '2025-2026'
});

assert.strictEqual(result.success, true, 'Scheduler failed to generate a clash-free schedule');
assert.strictEqual(result.schedule.length, totalDemandedHours, `Expected ${totalDemandedHours} slots scheduled, got ${result.schedule.length}`);

// Verify that the clash detection engine finds 0 clashes across the entire generated multi-semester schedule
const clashes = validateEntireSchedule(result.schedule, mockSubjects);
assert.strictEqual(clashes.length, 0, `Schedule contains ${clashes.length} clashes!`);

console.log(`  ✅ Basic Test Generated ${result.schedule.length} timetable entries across 3 semesters in ${result.stats.durationMs}ms with 0 clashes!`);

// =========================================================================
// Real AI & ML Department Dataset Test (S3, S5, S7 with Blocks & Parallel)
// =========================================================================
console.log('\n🧪 Testing Full AI & ML Department Dataset (AY 2026-27)...');

const aimlSemesters = [
  { id: 1, number: 3, class_room: 'LLH-04', academic_year: '2026-27' },
  { id: 2, number: 5, class_room: 'LLH-02', academic_year: '2026-27' },
  { id: 3, number: 7, class_room: 'LLH-01', academic_year: '2026-27' }
];

const aimlTimeslots = [];
const daysList = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
let tId = 1;
for (const day of daysList) {
  for (let p = 1; p <= 7; p++) {
    aimlTimeslots.push({
      id: tId++,
      day,
      period_number: p,
      start_time: `0${8 + p}:00`,
      end_time: `0${9 + p}:00`
    });
  }
}

const aimlSubjects = [
  // ---- Semester 3 ----
  { id: 101, semester_id: 1, subject_code: "1BCS301", name: "Probability, Distributions and Statistics", faculty_id: 1, weekly_hours: 4, is_lab: false, is_parallel_activity: false, block_session_hours: 0, block_session_count: 0 },
  { id: 102, semester_id: 1, subject_code: "1BCS302", name: "Object Oriented Programming with Java", faculty_id: 2, weekly_hours: 7, is_lab: false, is_parallel_activity: false, block_session_hours: 2, block_session_count: 1 },
  { id: 103, semester_id: 1, subject_code: "1BCS303", name: "Digital Design & Computer Organization", faculty_id: 3, weekly_hours: 5, is_lab: false, is_parallel_activity: false, block_session_hours: 0, block_session_count: 0 },
  { id: 104, semester_id: 1, subject_code: "1BCS304", name: "Operating Systems", faculty_id: 4, weekly_hours: 4, is_lab: false, is_parallel_activity: false, block_session_hours: 0, block_session_count: 0 },
  { id: 105, semester_id: 1, subject_code: "1BCS305", name: "Data Structures and Applications", faculty_id: 5, weekly_hours: 4, is_lab: false, is_parallel_activity: false, block_session_hours: 0, block_session_count: 0 },
  { id: 106, semester_id: 1, subject_code: "1BCSL306", name: "Data Structures Laboratory", faculty_id: 5, weekly_hours: 2, is_lab: true, is_parallel_activity: false, block_session_hours: 2, block_session_count: 1 },
  { id: 107, semester_id: 1, subject_code: "1BCSLK307A", name: "Project Management with Git", faculty_id: 6, weekly_hours: 2, is_lab: true, is_parallel_activity: false, block_session_hours: 2, block_session_count: 1 },
  { id: 108, semester_id: 1, subject_code: "1BCP308", name: "Community Project (PBL)", faculty_id: 7, weekly_hours: 3, is_lab: false, is_parallel_activity: false, block_session_hours: 2, block_session_count: 1 },
  { id: 109, semester_id: 1, subject_code: "1BNS309", name: "National Service Scheme (NSS)", faculty_id: 8, weekly_hours: 2, is_lab: false, is_parallel_activity: true, block_session_hours: 0, block_session_count: 0 },
  { id: 110, semester_id: 1, subject_code: "1BPE309", name: "Physical Education (PE)", faculty_id: 9, weekly_hours: 2, is_lab: false, is_parallel_activity: true, block_session_hours: 0, block_session_count: 0 },
  { id: 111, semester_id: 1, subject_code: "1BMATDIP310", name: "Mathematics for Lateral Entry Students", faculty_id: 1, weekly_hours: 1, is_lab: false, is_parallel_activity: false, block_session_hours: 0, block_session_count: 0 },

  // ---- Semester 5 ----
  { id: 201, semester_id: 2, subject_code: "BCS501", name: "Software Engineering & Project Management", faculty_id: 6, weekly_hours: 4, is_lab: false, is_parallel_activity: false, block_session_hours: 0, block_session_count: 0 },
  { id: 202, semester_id: 2, subject_code: "BCS502", name: "Computer Networks", faculty_id: 3, weekly_hours: 7, is_lab: false, is_parallel_activity: false, block_session_hours: 2, block_session_count: 1 },
  { id: 203, semester_id: 2, subject_code: "BCS503", name: "Theory of Computation", faculty_id: 10, weekly_hours: 4, is_lab: false, is_parallel_activity: false, block_session_hours: 0, block_session_count: 0 },
  { id: 204, semester_id: 2, subject_code: "BAIL504", name: "Data Visualization Lab", faculty_id: 4, weekly_hours: 2, is_lab: true, is_parallel_activity: false, block_session_hours: 2, block_session_count: 1 },
  { id: 205, semester_id: 2, subject_code: "BAI515A", name: "Computer Vision", faculty_id: 7, weekly_hours: 4, is_lab: false, is_parallel_activity: false, block_session_hours: 0, block_session_count: 0 },
  { id: 206, semester_id: 2, subject_code: "BAI586", name: "Mini Project", faculty_id: 11, weekly_hours: 3, is_lab: false, is_parallel_activity: false, block_session_hours: 2, block_session_count: 1 },
  { id: 207, semester_id: 2, subject_code: "BRMK557", name: "Research Methodology and IPR", faculty_id: 4, weekly_hours: 4, is_lab: false, is_parallel_activity: false, block_session_hours: 0, block_session_count: 0 },
  { id: 208, semester_id: 2, subject_code: "BCS508", name: "Environmental Studies and E-waste Management", faculty_id: 12, weekly_hours: 1, is_lab: false, is_parallel_activity: false, block_session_hours: 0, block_session_count: 0 },
  { id: 209, semester_id: 2, subject_code: "BNSK559", name: "National Service Scheme (NSS)", faculty_id: 8, weekly_hours: 2, is_lab: false, is_parallel_activity: true, block_session_hours: 0, block_session_count: 0 },
  { id: 210, semester_id: 2, subject_code: "BPEK559", name: "Physical Education (PE)", faculty_id: 9, weekly_hours: 2, is_lab: false, is_parallel_activity: true, block_session_hours: 0, block_session_count: 0 },

  // ---- Semester 7 ----
  { id: 301, semester_id: 3, subject_code: "BAI701", name: "Deep Learning & Reinforcement Learning", faculty_id: 11, weekly_hours: 6, is_lab: false, is_parallel_activity: false, block_session_hours: 2, block_session_count: 1 },
  { id: 302, semester_id: 3, subject_code: "BAI702", name: "Machine Learning - II", faculty_id: 13, weekly_hours: 5, is_lab: false, is_parallel_activity: false, block_session_hours: 2, block_session_count: 1 },
  { id: 303, semester_id: 3, subject_code: "BAD703", name: "Data Security & Privacy", faculty_id: 6, weekly_hours: 5, is_lab: false, is_parallel_activity: false, block_session_hours: 0, block_session_count: 0 },
  { id: 304, semester_id: 3, subject_code: "BCS714D", name: "Big Data Analytics", faculty_id: 14, weekly_hours: 4, is_lab: false, is_parallel_activity: false, block_session_hours: 0, block_session_count: 0 },
  { id: 305, semester_id: 3, subject_code: "BTE755C", name: "Embedded System Applications", faculty_id: 15, weekly_hours: 4, is_lab: false, is_parallel_activity: false, block_session_hours: 0, block_session_count: 0 },
  { id: 306, semester_id: 3, subject_code: "BAI786", name: "Major Project Phase-II", faculty_id: 11, weekly_hours: 8, is_lab: false, is_parallel_activity: false, block_session_hours: 2, block_session_count: 4 },
];

const totalExpectedHours = aimlSubjects.reduce((sum, s) => sum + s.weekly_hours, 0);

const aimlResult = generateTimetable({
  semesters: aimlSemesters,
  subjects: aimlSubjects,
  timeslots: aimlTimeslots,
  academicYear: '2026-27'
});

assert.strictEqual(aimlResult.success, true, 'Scheduler failed on AIML dataset: ' + aimlResult.message);
assert.strictEqual(aimlResult.schedule.length, totalExpectedHours, `Expected ${totalExpectedHours} entries, got ${aimlResult.schedule.length}`);

// Check zero clashes
const aimlClashes = validateEntireSchedule(aimlResult.schedule, aimlSubjects);
assert.strictEqual(aimlClashes.length, 0, `AIML Schedule has ${aimlClashes.length} clashes!`);

// Verify continuous blocks for block subjects (e.g. 1BCS302, BCS502, BAIL504, BAI786)
const timeslotsMap = new Map(aimlTimeslots.map(t => [t.id, t]));
const entriesBySubject = new Map();
aimlResult.schedule.forEach(e => {
  if (!entriesBySubject.has(e.subject_id)) entriesBySubject.set(e.subject_id, []);
  entriesBySubject.get(e.subject_id).push(e);
});

aimlSubjects.filter(s => s.block_session_count > 0).forEach(sub => {
  const entries = entriesBySubject.get(sub.id) || [];
  assert.strictEqual(entries.length, sub.weekly_hours, `Subject ${sub.subject_code} total hours mismatch`);

  // Group entries by day
  const dayGroups = new Map();
  entries.forEach(e => {
    const ts = timeslotsMap.get(e.timeslot_id);
    if (!dayGroups.has(ts.day)) dayGroups.set(ts.day, []);
    dayGroups.get(ts.day).push(ts.period_number);
  });

  // Find continuous blocks of length sub.block_session_hours
  let foundBlocks = 0;
  for (const [day, periods] of dayGroups.entries()) {
    periods.sort((a, b) => a - b);
    for (let i = 0; i <= periods.length - sub.block_session_hours; i++) {
      let isConsecutive = true;
      for (let k = 1; k < sub.block_session_hours; k++) {
        if (periods[i + k] !== periods[i] + k) {
          isConsecutive = false;
          break;
        }
      }
      if (isConsecutive) {
        foundBlocks++;
        i += sub.block_session_hours - 1; // move past this block
      }
    }
  }

  assert.ok(foundBlocks >= sub.block_session_count, `Subject ${sub.subject_code} expected at least ${sub.block_session_count} blocks of ${sub.block_session_hours} hours, found ${foundBlocks}`);
  console.log(`  ✅ Subject ${sub.subject_code} (${sub.name}): ${foundBlocks} block(s) of ${sub.block_session_hours}h verified.`);
});

console.log(`\n🎉 Full AIML Dataset: Successfully scheduled ${aimlResult.schedule.length} slots in ${aimlResult.stats.durationMs}ms with 0 clashes!`);

// =========================================================================
// Lab Placement Window Tests (BUG FIX Verification)
// =========================================================================
console.log('\n🧪 Testing Lab Placement Constraints (No Labs in Period 1 & 2)...');

// 1. Regression Test: Assert that no subject with is_lab = true appears in Period 1 or Period 2 on any day
const labSubjectIds = new Set(aimlSubjects.filter(s => s.is_lab).map(s => s.id));
let labCount = 0;
for (const entry of aimlResult.schedule) {
  if (labSubjectIds.has(entry.subject_id)) {
    labCount++;
    const ts = timeslotsMap.get(entry.timeslot_id);
    assert.ok(
      ts.period_number !== 1 && ts.period_number !== 2,
      `Violation: Lab subject ${entry.subject_id} was scheduled in ${ts.day} Period ${ts.period_number}! Labs must NEVER be placed in Period 1 or 2.`
    );
    // Assert it is strictly in allowed windows: Period 3, 4, 5, 6, or 7
    assert.ok(
      ts.period_number >= 3 && ts.period_number <= 7,
      `Lab subject ${entry.subject_id} placed in unexpected period: ${ts.period_number}`
    );
  }
}
assert.ok(labCount > 0, 'Expected at least one lab to be scheduled and verified');
console.log(`  ✅ Regression Test Passed: All ${labCount} lab periods placed strictly in allowed windows (Periods 3-7), 0 in Periods 1-2.`);

// Verify non-lab block subjects CAN still be placed in Period 1-2
const nonLabBlockIds = new Set(aimlSubjects.filter(s => !s.is_lab && s.block_session_count > 0).map(s => s.id));
const nonLabBlockInP1P2 = aimlResult.schedule.some(e => {
  if (!nonLabBlockIds.has(e.subject_id)) return false;
  const ts = timeslotsMap.get(e.timeslot_id);
  return ts.period_number === 1 || ts.period_number === 2;
});
console.log(`  ✅ Non-lab block subjects can still utilize Period 1-2: ${nonLabBlockInP1P2}`);

// 2. Edge-case Test: Pre-fill Period 3-4 and both afternoon windows for a semester.
// Confirm solver reports an unschedulable state for that lab rather than placing it in Period 1-2.
console.log('🧪 Testing Lab Edge Case: Allowed windows full -> solver fails rather than placing in Period 1-2...');

const edgeSemester = [{ id: 99, number: 1, class_room: 'L-101', academic_year: '2026-27' }];
// 1 day with 7 periods
const singleDayTimeslots = [
  { id: 1001, day: 'Monday', period_number: 1, start_time: '09:00', end_time: '09:55' },
  { id: 1002, day: 'Monday', period_number: 2, start_time: '09:55', end_time: '10:50' },
  { id: 1003, day: 'Monday', period_number: 3, start_time: '11:10', end_time: '12:05' },
  { id: 1004, day: 'Monday', period_number: 4, start_time: '12:05', end_time: '13:00' },
  { id: 1005, day: 'Monday', period_number: 5, start_time: '13:50', end_time: '14:40' },
  { id: 1006, day: 'Monday', period_number: 6, start_time: '14:40', end_time: '15:30' },
  { id: 1007, day: 'Monday', period_number: 7, start_time: '15:30', end_time: '16:15' },
];

// Pre-fill Periods 3, 4, 5, 6, 7 so ONLY Period 1 & 2 are open
const prefilledEntries = [
  { subject_id: 991, semester_id: 99, timeslot_id: 1003, faculty_id: 91, academic_year: '2026-27' },
  { subject_id: 991, semester_id: 99, timeslot_id: 1004, faculty_id: 91, academic_year: '2026-27' },
  { subject_id: 992, semester_id: 99, timeslot_id: 1005, faculty_id: 92, academic_year: '2026-27' },
  { subject_id: 992, semester_id: 99, timeslot_id: 1006, faculty_id: 92, academic_year: '2026-27' },
  { subject_id: 993, semester_id: 99, timeslot_id: 1007, faculty_id: 93, academic_year: '2026-27' },
];

const labSubjectToTest = [
  {
    id: 999,
    semester_id: 99,
    subject_code: 'LAB999',
    name: 'Test Lab',
    faculty_id: 99,
    weekly_hours: 2,
    is_lab: true,
    block_session_hours: 2,
    block_session_count: 1
  }
];

const edgeResult = generateTimetable({
  semesters: edgeSemester,
  subjects: labSubjectToTest,
  timeslots: singleDayTimeslots,
  academicYear: '2026-27',
  existingEntries: prefilledEntries
});

assert.strictEqual(
  edgeResult.success,
  false,
  'Expected scheduler to fail when lab allowed windows are full, but it succeeded (potentially placed in Period 1-2)!'
);
console.log('  ✅ Edge-Case Test Passed: Solver correctly reported unschedulable state and refused to place lab in Period 1-2.');

// Also confirm that if the subject is NOT a lab, it CAN be placed in Period 1-2
const nonLabSubjectToTest = [
  {
    id: 998,
    semester_id: 99,
    subject_code: 'BLOCK998',
    name: 'Test Non-Lab Block',
    faculty_id: 99,
    weekly_hours: 2,
    is_lab: false,
    block_session_hours: 2,
    block_session_count: 1
  }
];

const nonLabEdgeResult = generateTimetable({
  semesters: edgeSemester,
  subjects: nonLabSubjectToTest,
  timeslots: singleDayTimeslots,
  academicYear: '2026-27',
  existingEntries: prefilledEntries
});

assert.strictEqual(
  nonLabEdgeResult.success,
  true,
  'Non-lab block subject should be able to utilize Period 1-2 when other windows are full!'
);
// 1 block of 2 hours + 5 prefilled entries = 7 total entries
assert.strictEqual(nonLabEdgeResult.schedule.length, 2 + prefilledEntries.length);
console.log('  ✅ Edge-Case Test Passed: Non-lab block subject successfully placed in Period 1-2 as expected.');

console.log('\n🎉 All Scheduler Tests Passed!\n');

