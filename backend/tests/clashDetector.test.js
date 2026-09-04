const assert = require('assert');
const { detectClash, validateEntireSchedule } = require('../src/services/clashDetector');

console.log('🧪 Running Clash Detector Tests...');

const mockSubjects = [
  { id: 1, subject_code: 'CS301', name: 'Data Structures', semester_id: 1, faculty_id: 10, faculty_name: 'Prof. Sharma' },
  { id: 2, subject_code: 'CS302', name: 'Digital Logic', semester_id: 1, faculty_id: 20, faculty_name: 'Prof. Verma' },
  { id: 3, subject_code: 'CS501', name: 'DBMS', semester_id: 2, faculty_id: 10, faculty_name: 'Prof. Sharma' }, // same faculty as CS301
  { id: 4, subject_code: 'CS502', name: 'OS', semester_id: 2, faculty_id: 30, faculty_name: 'Dr. Rao' },
];

const mockExistingEntries = [
  { id: 101, subject_id: 1, semester_id: 1, timeslot_id: 1, academic_year: '2025-2026' }, // Sem 1, Slot 1, Faculty 10
  { id: 102, subject_id: 2, semester_id: 1, timeslot_id: 2, academic_year: '2025-2026' }, // Sem 1, Slot 2, Faculty 20
];

// Test 1: Valid Placement (No clash)
{
  const candidate = { subject_id: 4, semester_id: 2, timeslot_id: 1, academic_year: '2025-2026' }; // Dr. Rao, Sem 2, Slot 1
  const result = detectClash(candidate, mockExistingEntries, mockSubjects);
  assert.strictEqual(result.isValid, true, 'Test 1 Failed: Valid entry should not trigger clash');
  assert.strictEqual(result.clashType, null);
  console.log('  ✅ Test 1 Passed: Valid non-clashing placement approved.');
}

// Test 2: Semester Clash (Same semester, same timeslot)
{
  const candidate = { subject_id: 2, semester_id: 1, timeslot_id: 1, academic_year: '2025-2026' }; // Sem 1, Slot 1
  const result = detectClash(candidate, mockExistingEntries, mockSubjects);
  assert.strictEqual(result.isValid, false, 'Test 2 Failed: Should detect semester clash');
  assert.strictEqual(result.clashType, 'SEMESTER_CLASH');
  console.log('  ✅ Test 2 Passed: Correctly detected semester clash (same semester, same timeslot).');
}

// Test 3: Faculty Clash (Same faculty, different semester, same timeslot)
{
  const candidate = { subject_id: 3, semester_id: 2, timeslot_id: 1, academic_year: '2025-2026' }; // Prof Sharma, Sem 2, Slot 1
  const result = detectClash(candidate, mockExistingEntries, mockSubjects);
  assert.strictEqual(result.isValid, false, 'Test 3 Failed: Should detect faculty clash');
  assert.strictEqual(result.clashType, 'FACULTY_CLASH');
  console.log('  ✅ Test 3 Passed: Correctly detected faculty clash (same faculty in two semesters simultaneously).');
}

// Test 5: Parallel Activities (e.g. NSS and PE with different faculty) in same semester & timeslot -> ALLOWED
{
  const parallelSubjects = [
    ...mockSubjects,
    { id: 5, subject_code: '1BNS309', name: 'NSS', semester_id: 1, faculty_id: 50, is_parallel_activity: true, faculty_name: 'Prof. Srinivas' },
    { id: 6, subject_code: '1BPE309', name: 'PE', semester_id: 1, faculty_id: 60, is_parallel_activity: true, faculty_name: 'Prof. Lokesh' },
  ];
  const entriesWithNSS = [
    ...mockExistingEntries,
    { id: 103, subject_id: 5, semester_id: 1, timeslot_id: 5, academic_year: '2025-2026' }
  ];
  const candidatePE = { subject_id: 6, semester_id: 1, timeslot_id: 5, academic_year: '2025-2026' };
  const result = detectClash(candidatePE, entriesWithNSS, parallelSubjects);
  assert.strictEqual(result.isValid, true, 'Test 5 Failed: Parallel activities with different faculty should not clash');
  console.log('  ✅ Test 5 Passed: Parallel activities (NSS & PE) sharing same semester timeslot approved.');
}

// Test 6: Parallel Activity with Non-Parallel Activity -> SEMESTER_CLASH
{
  const parallelSubjects = [
    ...mockSubjects,
    { id: 5, subject_code: '1BNS309', name: 'NSS', semester_id: 1, faculty_id: 50, is_parallel_activity: true },
  ];
  const entriesWithNSS = [
    ...mockExistingEntries,
    { id: 103, subject_id: 5, semester_id: 1, timeslot_id: 5, academic_year: '2025-2026' }
  ];
  const candidateNormal = { subject_id: 1, semester_id: 1, timeslot_id: 5, academic_year: '2025-2026' }; // non-parallel
  const result = detectClash(candidateNormal, entriesWithNSS, parallelSubjects);
  assert.strictEqual(result.isValid, false, 'Test 6 Failed: Non-parallel subject cannot share slot with parallel activity');
  assert.strictEqual(result.clashType, 'SEMESTER_CLASH');
  console.log('  ✅ Test 6 Passed: Non-parallel subject conflicting with parallel activity rejected.');
}

// Test 8: Manual edit of an existing parallel occupant (NSS/PE coexisting slot)
{
  const testSubjects = [
    ...mockSubjects,
    { id: 5, subject_code: '1BNS309', name: 'NSS', semester_id: 1, faculty_id: 50, is_parallel_activity: true, faculty_name: 'Prof. Srinivas' },
    { id: 6, subject_code: '1BPE309', name: 'PE', semester_id: 1, faculty_id: 60, is_parallel_activity: true, faculty_name: 'Prof. Lokesh' },
    { id: 7, subject_code: '1BYOG309', name: 'Yoga / Sports', semester_id: 1, faculty_id: 70, is_parallel_activity: true, faculty_name: 'Dr. Yoga' },
    { id: 8, subject_code: '1BPE_CLASH', name: 'PE Variant', semester_id: 1, faculty_id: 60, is_parallel_activity: true, faculty_name: 'Prof. Lokesh' } // same faculty as PE
  ];

  // Slot 5 has BOTH NSS (id: 103) and PE (id: 104)
  const coexistingEntries = [
    ...mockExistingEntries,
    { id: 103, subject_id: 5, semester_id: 1, timeslot_id: 5, academic_year: '2025-2026' }, // NSS
    { id: 104, subject_id: 6, semester_id: 1, timeslot_id: 5, academic_year: '2025-2026' }  // PE
  ];

  // 8.1: Edit NSS (id 103) -> Yoga (parallel, different faculty) -> MUST SUCCEED
  const editToYoga = { id: 103, subject_id: 7, semester_id: 1, timeslot_id: 5, academic_year: '2025-2026' };
  const resYoga = detectClash(editToYoga, coexistingEntries, testSubjects);
  assert.strictEqual(resYoga.isValid, true, 'Test 8.1 Failed: Changing NSS to another parallel subject should succeed');
  console.log('  ✅ Test 8.1 Passed: Manual edit of NSS to another parallel subject (Yoga) succeeds without false clash.');

  // 8.2: Edit NSS (id 103) -> non-parallel subject (Sub 1: Data Structures) -> MUST FAIL (SEMESTER_CLASH with PE)
  const editToNonParallel = { id: 103, subject_id: 1, semester_id: 1, timeslot_id: 5, academic_year: '2025-2026' };
  const resNonParallel = detectClash(editToNonParallel, coexistingEntries, testSubjects);
  assert.strictEqual(resNonParallel.isValid, false, 'Test 8.2 Failed: Changing NSS to non-parallel should clash with PE');
  assert.strictEqual(resNonParallel.clashType, 'SEMESTER_CLASH');
  console.log('  ✅ Test 8.2 Passed: Manual edit of NSS to non-parallel subject correctly rejected (SEMESTER_CLASH with PE).');

  // 8.3: Edit NSS (id 103) -> parallel subject with SAME faculty as PE -> MUST FAIL (FACULTY_CLASH)
  const editToFacultyClash = { id: 103, subject_id: 8, semester_id: 1, timeslot_id: 5, academic_year: '2025-2026' };
  const resFacultyClash = detectClash(editToFacultyClash, coexistingEntries, testSubjects);
  assert.strictEqual(resFacultyClash.isValid, false, 'Test 8.3 Failed: Changing NSS to subject sharing PE faculty should clash');
  assert.strictEqual(resFacultyClash.clashType, 'FACULTY_CLASH');
  console.log('  ✅ Test 8.3 Passed: Manual edit with genuine faculty collision correctly rejected (FACULTY_CLASH).');

  // 8.4: Edit PE (id 104) -> Yoga (parallel, different faculty) -> MUST SUCCEED
  const editPEToYoga = { id: 104, subject_id: 7, semester_id: 1, timeslot_id: 5, academic_year: '2025-2026' };
  const resPEYoga = detectClash(editPEToYoga, coexistingEntries, testSubjects);
  assert.strictEqual(resPEYoga.isValid, true, 'Test 8.4 Failed: Changing PE to another parallel subject should succeed');
  console.log('  ✅ Test 8.4 Passed: Manual edit of PE to another parallel subject succeeds.');

  // 8.5: Replace ALL occupants (NSS & PE) with 1 normal class (Sub 1: Data Structures) using exclude_entry_ids
  const replaceAllOccupants = {
    id: 103,
    subject_id: 1,
    semester_id: 1,
    timeslot_id: 5,
    academic_year: '2025-2026',
    exclude_entry_ids: [103, 104],
    exclude_same_slot: true
  };
  const resReplaceAll = detectClash(replaceAllOccupants, coexistingEntries, testSubjects);
  assert.strictEqual(resReplaceAll.isValid, true, 'Test 8.5 Failed: Replacing all slot occupants with a single class should succeed');
  console.log('  ✅ Test 8.5 Passed: Replace all occupants with 1 class succeeds without clash.');
}

// Test 9: Generic Activities (Library, Placement, Mentoring) skip faculty clashes
{
  const genericSubjects = [
    ...mockSubjects,
    { id: 9, subject_code: 'LIB', name: 'Library Hour', semester_id: 1, faculty_id: 10, is_generic_activity: true },
    { id: 10, subject_code: 'PLACE', name: 'Placement Training', semester_id: 2, faculty_id: 10, is_generic_activity: true }
  ];
  // Sub 1 (CS301 taught by Faculty 10) is already scheduled at Timeslot 1 in Sem 1
  // Now schedule Library (Sub 9, faculty 10, generic) at Timeslot 1 in Sem 2
  const candidateGeneric = { subject_id: 9, semester_id: 2, timeslot_id: 1, academic_year: '2025-2026' };
  const resGeneric = detectClash(candidateGeneric, mockExistingEntries, genericSubjects);
  assert.strictEqual(resGeneric.isValid, true, 'Test 9 Failed: Generic activity should not trigger faculty clash');
  console.log('  ✅ Test 9 Passed: Generic activity (Library) skips faculty clash as expected.');
}

// Test 10: Accurate Semester Number in Error Messages (Semester 5 instead of primary key ID 2)
{
  const semestersMap = new Map([
    [1, { id: 1, number: 3, academic_year: '2025-2026' }],
    [2, { id: 2, number: 5, academic_year: '2025-2026' }],
    [3, { id: 3, number: 7, academic_year: '2025-2026' }],
  ]);

  // Existing entry in Semester ID 2 (which is Semester 5!) taught by Faculty 10
  const existingEntriesWithSem5 = [
    { id: 201, subject_id: 3, semester_id: 2, timeslot_id: 1, academic_year: '2025-2026', semester_number: 5 } // DBMS, Sem 5, Faculty 10
  ];

  // Try to schedule CS301 (Faculty 10) in Semester ID 1 (Semester 3) at Timeslot 1
  const candidate = { subject_id: 1, semester_id: 1, timeslot_id: 1, academic_year: '2025-2026', semester_number: 3 };
  const res = detectClash(candidate, existingEntriesWithSem5, mockSubjects, null, semestersMap);

  assert.strictEqual(res.isValid, false, 'Test 10 Failed: Faculty clash should be detected');
  assert.strictEqual(res.clashType, 'FACULTY_CLASH');
  assert.ok(
    res.error.includes('(Semester 5)'),
    `Test 10 Failed: Error message should contain "(Semester 5)", but got: "${res.error}"`
  );
  assert.ok(
    !res.error.includes('(Semester #2)'),
    `Test 10 Failed: Error message should NOT contain raw primary key "(Semester #2)", got: "${res.error}"`
  );
  console.log('  ✅ Test 10 Passed: Error message accurately displays "Semester 5" instead of database ID "Semester #2".');
}

console.log('🎉 All Clash Detector Tests Passed!\n');
