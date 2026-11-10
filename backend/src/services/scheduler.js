/**
 * Deterministic Backtracking / CSP Scheduler for YenSync
 * 
 * Generates timetable entries across ALL semesters simultaneously.
 * 
 * Guarantees:
 * - Deterministic, explainable constraint satisfaction
 * - Zero clashes for faculty across different semesters
 * - Zero clashes for semester timeslots (with parallel activity support)
 * - Continuous block sessions (block_session_hours * block_session_count) placed
 *   as atomic consecutive units first, before single-hour demands
 * - Parallel activities (e.g. NSS/PE) can share the same semester timeslot
 * - Fulfills required `weekly_hours` per subject
 * - Even distribution across available days where possible
 */

const { detectClash } = require('./clashDetector');

const DAY_ORDER = {
  'Monday': 1,
  'Tuesday': 2,
  'Wednesday': 3,
  'Thursday': 4,
  'Friday': 5,
  'Saturday': 6,
  'MON': 1,
  'TUE': 2,
  'WED': 3,
  'THU': 4,
  'FRI': 5,
  'SAT': 6
};

/**
 * Solves and generates timetable entries across ALL semesters using backtracking.
 * 
 * @param {Object} options
 * @param {Array<Object>} options.semesters - All semesters to schedule
 * @param {Array<Object>} options.subjects - All subjects with weekly_hours, faculty_id, semester_id, block configs
 * @param {Array<Object>} options.timeslots - All available timeslots (day, period_number, id)
 * @param {string} options.academicYear - Academic year string (e.g., '2026-27')
 * @param {Array<Object>} [options.existingEntries] - Optional pre-existing locked entries
 * @param {Array<Object>} [options.facultyBusySlots] - Optional external faculty busy commitments (e.g. Sem 1 classes)
 * 
 * @returns {Object} { success: boolean, schedule: Array<Object>, message: string, stats: Object }
 */
function generateTimetable({ semesters, subjects, timeslots, academicYear, existingEntries = [], facultyBusySlots = [] }) {
  const startTime = Date.now();

  // Create lookup maps
  const subjectsMap = new Map();
  subjects.forEach(s => subjectsMap.set(s.id, s));

  const timeslotsMap = new Map();
  timeslots.forEach(t => timeslotsMap.set(t.id, t));

  const semestersMap = new Map();
  if (Array.isArray(semesters)) {
    semesters.forEach(s => semestersMap.set(s.id, s));
  }

  // Sort timeslots chronologically: Days first, then period numbers
  const sortedTimeslots = [...timeslots].sort((a, b) => {
    const dayDiff = (DAY_ORDER[a.day] || 99) - (DAY_ORDER[b.day] || 99);
    if (dayDiff !== 0) return dayDiff;
    return a.period_number - b.period_number;
  });

  // Group sorted timeslots by day
  const timeslotsByDay = new Map();
  sortedTimeslots.forEach(ts => {
    if (!timeslotsByDay.has(ts.day)) {
      timeslotsByDay.set(ts.day, []);
    }
    timeslotsByDay.get(ts.day).push(ts);
  });

  // Pre-calculate faculty teaching load across all subjects to use in MRV heuristic
  const facultyTotalHours = {};
  subjects.forEach(s => {
    const hours = Number(s.weekly_hours) || 0;
    facultyTotalHours[s.faculty_id] = (facultyTotalHours[s.faculty_id] || 0) + hours;
  });

  // Generate atomic demands:
  // 1. Block demands: block_session_count blocks of length block_session_hours
  // 2. Single-hour demands: remaining hours (weekly_hours - block_session_hours * block_session_count)
  const blockDemands = [];
  const singleDemands = [];

  subjects.forEach(subj => {
    const weeklyHours = Number(subj.weekly_hours) || 0;
    let blockHours = Number(subj.block_session_hours) || 0;
    let blockCount = Number(subj.block_session_count) || 0;
    const isParallel = Boolean(subj.is_parallel_activity);
    const isLab = Boolean(subj.is_lab);

    // Ensure lab sessions strictly default to continuous 2-hour blocks if not configured
    if (isLab && (blockHours === 0 || blockCount === 0)) {
      blockHours = Math.min(2, weeklyHours);
      blockCount = Math.floor(weeklyHours / blockHours);
    }

    let scheduledBlockHours = 0;
    if (blockCount > 0 && blockHours > 0) {
      for (let c = 0; c < blockCount; c++) {
        blockDemands.push({
          type: 'BLOCK',
          id: `${subj.id}_block_${c}`,
          subject_id: subj.id,
          semester_id: subj.semester_id,
          faculty_id: subj.faculty_id,
          is_lab: isLab,
          is_parallel: isParallel,
          block_hours: blockHours,
          academic_year: academicYear
        });
      }
      scheduledBlockHours = blockCount * blockHours;
    }

    const remainingSingleHours = Math.max(0, weeklyHours - scheduledBlockHours);
    for (let i = 0; i < remainingSingleHours; i++) {
      singleDemands.push({
        type: 'SINGLE',
        id: `${subj.id}_single_${i}`,
        subject_id: subj.id,
        semester_id: subj.semester_id,
        faculty_id: subj.faculty_id,
        is_lab: isLab,
        is_parallel: isParallel,
        block_hours: 1,
        academic_year: academicYear
      });
    }
  });

  // Sort block demands: longer blocks first, then highest faculty load, then labs
  blockDemands.sort((a, b) => {
    if (b.block_hours !== a.block_hours) return b.block_hours - a.block_hours;
    const loadDiff = (facultyTotalHours[b.faculty_id] || 0) - (facultyTotalHours[a.faculty_id] || 0);
    if (loadDiff !== 0) return loadDiff;
    if (b.is_lab !== a.is_lab) return b.is_lab ? 1 : -1;
    return a.semester_id - b.semester_id;
  });

  // Sort single-hour demands: parallel subjects together, then highest weekly hours, then faculty load, then labs
  singleDemands.sort((a, b) => {
    if (b.is_parallel !== a.is_parallel) return b.is_parallel ? 1 : -1;
    const subA = subjectsMap.get(a.subject_id);
    const subB = subjectsMap.get(b.subject_id);
    const hoursA = Number(subA?.weekly_hours) || 0;
    const hoursB = Number(subB?.weekly_hours) || 0;
    if (hoursB !== hoursA) return hoursB - hoursA;
    const loadDiff = (facultyTotalHours[b.faculty_id] || 0) - (facultyTotalHours[a.faculty_id] || 0);
    if (loadDiff !== 0) return loadDiff;
    if (b.is_lab !== a.is_lab) return b.is_lab ? 1 : -1;
    return a.semester_id - b.semester_id;
  });

  // All block demands are placed FIRST, followed by single-hour demands
  const slotDemands = [...blockDemands, ...singleDemands];

  // Precompute candidate consecutive slot windows for block demands
  function getCandidateConsecutiveWindows(length, isLab = false) {
    const windows = [];
    for (const [day, daySlots] of timeslotsByDay.entries()) {
      for (let i = 0; i <= daySlots.length - length; i++) {
        let isConsecutive = true;
        for (let k = 1; k < length; k++) {
          if (daySlots[i + k].period_number !== daySlots[i].period_number + k) {
            isConsecutive = false;
            break;
          }
        }
        if (isConsecutive) {
          const win = daySlots.slice(i, i + length);
          if (isLab) {
            // Lab placement-window constraint:
            // Valid windows are strictly:
            // - Period 3 & 4 (late morning, before lunch, start period 3)
            // - Period 5 & 6, or Period 6 & 7 (afternoon, after lunch, start period 5 or 6)
            // Period 1-2 is excluded from candidate positions considered for labs specifically.
            const startPeriod = win[0].period_number;
            if (length === 2) {
              if (startPeriod === 3 || startPeriod === 5 || startPeriod === 6) {
                windows.push(win);
              }
            } else if (startPeriod >= 3) {
              // Ensure any longer block does not start in Period 1-2 and does not cross lunch break (P4-P5)
              const endPeriod = win[win.length - 1].period_number;
              if (!(startPeriod <= 4 && endPeriod >= 5)) {
                windows.push(win);
              }
            }
          } else {
            windows.push(win);
          }
        }
      }
    }
    return windows;
  }

  // Cache candidate block windows by block length (separately for normal blocks and lab blocks)
  const blockWindowsByLength = new Map();
  const labBlockWindowsByLength = new Map();
  const uniqueBlockLengths = new Set(blockDemands.map(d => d.block_hours));
  uniqueBlockLengths.forEach(len => {
    blockWindowsByLength.set(len, getCandidateConsecutiveWindows(len, false));
    labBlockWindowsByLength.set(len, getCandidateConsecutiveWindows(len, true));
  });

  // Current Schedule state
  const currentSchedule = [...existingEntries];

  // Calculate available days and max department labs allowed per day
  const availableDays = Array.from(timeslotsByDay.keys());
  const numDays = availableDays.length || 6;
  const totalLabDemands = blockDemands.filter(d => d.is_lab).length + singleDemands.filter(d => d.is_lab).length;
  // If department has <= 6 labs across the week, strictly allow at most 1 lab per day across the department!
  const maxDeptLabsPerDay = Math.max(1, Math.ceil(totalLabDemands / numDays));

  // Pre-calculate block count per semester to evenly distribute 2-hour blocks across the week
  const semBlockCounts = new Map();
  blockDemands.forEach(d => {
    semBlockCounts.set(d.semester_id, (semBlockCounts.get(d.semester_id) || 0) + 1);
  });

  // Tracking state structures:
  // facultyOccupied: Map<faculty_id, Set<timeslot_id>>
  // semesterOccupied: Map<semester_id, Map<timeslot_id, Array<subject_id>>>
  // subjectDayHours: Map<"semId_subId_day", count>
  // semesterDayLabs: Map<"semId_day", count> (tracks lab hours scheduled per semester per day)
  // departmentDayLabs: Map<"day", count> (tracks total lab hours scheduled across the entire department per day)
  // semesterDayBlocks: Map<"semId_day", count> (tracks total multi-hour blocks per semester per day)
  const facultyOccupied = new Map();
  const semesterOccupied = new Map();
  const subjectDayHours = new Map();
  const semesterDayLabs = new Map();
  const departmentDayLabs = new Map();
  const semesterDayBlocks = new Map();

  function recordAssignment(entry) {
    const sub = subjectsMap.get(entry.subject_id);
    const facultyId = entry.faculty_id || (sub ? sub.faculty_id : null);

    if (facultyId) {
      if (!facultyOccupied.has(facultyId)) facultyOccupied.set(facultyId, new Set());
      facultyOccupied.get(facultyId).add(entry.timeslot_id);
    }

    if (!semesterOccupied.has(entry.semester_id)) semesterOccupied.set(entry.semester_id, new Map());
    const semSlots = semesterOccupied.get(entry.semester_id);
    if (!semSlots.has(entry.timeslot_id)) semSlots.set(entry.timeslot_id, []);
    semSlots.get(entry.timeslot_id).push(entry.subject_id);

    const ts = timeslotsMap.get(entry.timeslot_id);
    if (ts) {
      const key = `${entry.semester_id}_${entry.subject_id}_${ts.day}`;
      subjectDayHours.set(key, (subjectDayHours.get(key) || 0) + 1);

      if (sub && sub.is_lab) {
        const labKey = `${entry.semester_id}_${ts.day}`;
        semesterDayLabs.set(labKey, (semesterDayLabs.get(labKey) || 0) + 1);
        departmentDayLabs.set(ts.day, (departmentDayLabs.get(ts.day) || 0) + 1);
      }
    }
  }

  function removeAssignment(entry) {
    const sub = subjectsMap.get(entry.subject_id);
    const facultyId = entry.faculty_id || (sub ? sub.faculty_id : null);

    if (facultyId && facultyOccupied.has(facultyId)) {
      facultyOccupied.get(facultyId).delete(entry.timeslot_id);
    }

    if (semesterOccupied.has(entry.semester_id)) {
      const semSlots = semesterOccupied.get(entry.semester_id);
      if (semSlots.has(entry.timeslot_id)) {
        const subs = semSlots.get(entry.timeslot_id);
        const idx = subs.indexOf(entry.subject_id);
        if (idx !== -1) subs.splice(idx, 1);
        if (subs.length === 0) semSlots.delete(entry.timeslot_id);
      }
    }

    const ts = timeslotsMap.get(entry.timeslot_id);
    if (ts) {
      const key = `${entry.semester_id}_${entry.subject_id}_${ts.day}`;
      const count = subjectDayHours.get(key) || 0;
      if (count <= 1) {
        subjectDayHours.delete(key);
      } else {
        subjectDayHours.set(key, count - 1);
      }

      if (sub && sub.is_lab) {
        const labKey = `${entry.semester_id}_${ts.day}`;
        const labCount = semesterDayLabs.get(labKey) || 0;
        if (labCount <= 1) {
          semesterDayLabs.delete(labKey);
        } else {
          semesterDayLabs.set(labKey, labCount - 1);
        }

        const deptLabCount = departmentDayLabs.get(ts.day) || 0;
        if (deptLabCount <= 1) {
          departmentDayLabs.delete(ts.day);
        } else {
          departmentDayLabs.set(ts.day, deptLabCount - 1);
        }
      }
    }
  }

  existingEntries.forEach(recordAssignment);

  // Pre-seed facultyOccupied with external commitments / faculty busy slots (e.g. 1st year Sem 1 classes)
  if (Array.isArray(facultyBusySlots)) {
    facultyBusySlots.forEach(slot => {
      if (slot && slot.faculty_id && slot.timeslot_id) {
        if (!facultyOccupied.has(slot.faculty_id)) facultyOccupied.set(slot.faculty_id, new Set());
        facultyOccupied.get(slot.faculty_id).add(slot.timeslot_id);
      }
    });
  }

  let stepsExplored = 0;
  const MAX_STEPS = 60000; // Search limit

  /**
   * Recursive Backtracking Solver
   * @param {number} demandIndex - Index of current slot demand to fulfill
   */
  function backtrack(demandIndex) {
    if (demandIndex >= slotDemands.length) {
      return true; // All demands successfully scheduled!
    }

    stepsExplored++;
    if (stepsExplored > MAX_STEPS || (stepsExplored % 1000 === 0 && Date.now() - startTime > 4500)) {
      return false;
    }

    const demand = slotDemands[demandIndex];
    const candidateSubject = subjectsMap.get(demand.subject_id);

    // -------------------------------------------------------------
    // Branch 1: ATOMIC BLOCK DEMAND (Consecutive Periods)
    // -------------------------------------------------------------
    if (demand.type === 'BLOCK') {
      const length = demand.block_hours;
      const candidateWindows = (demand.is_lab ? labBlockWindowsByLength : blockWindowsByLength).get(length) || [];

      // Sort candidate windows dynamically: prefer days with fewer department labs, fewer semester blocks, and fewer hours
      const sortedWindows = [...candidateWindows].sort((winA, winB) => {
        const dayA = winA[0].day;
        const dayB = winB[0].day;

        if (demand.is_lab) {
          const deptLabsA = departmentDayLabs.get(dayA) || 0;
          const deptLabsB = departmentDayLabs.get(dayB) || 0;
          if (deptLabsA !== deptLabsB) return deptLabsA - deptLabsB;
        }

        const blocksA = semesterDayBlocks.get(`${demand.semester_id}_${dayA}`) || 0;
        const blocksB = semesterDayBlocks.get(`${demand.semester_id}_${dayB}`) || 0;
        if (blocksA !== blocksB) return blocksA - blocksB;

        const countA = subjectDayHours.get(`${demand.semester_id}_${demand.subject_id}_${dayA}`) || 0;
        const countB = subjectDayHours.get(`${demand.semester_id}_${demand.subject_id}_${dayB}`) || 0;
        return countA - countB;
      });

      for (const window of sortedWindows) {
        const day = window[0].day;
        const dayKey = `${demand.semester_id}_${demand.subject_id}_${day}`;
        const currentHoursOnDay = subjectDayHours.get(dayKey) || 0;

        // Daily limit heuristic: for subjects with <= 6 hours, limit to 1 block per day (<= length hours)
        const weeklyHours = Number(candidateSubject?.weekly_hours) || 0;
        if (weeklyHours <= 6 && currentHoursOnDay > 0) {
          continue;
        }

        // Daily lab constraint: strictly at most 1 lab session in a day for any semester
        if (demand.is_lab) {
          const labKey = `${demand.semester_id}_${day}`;
          if ((semesterDayLabs.get(labKey) || 0) > 0) {
            continue;
          }

          // Department-wide lab constraint: strictly at most 1 lab per day across the whole department
          const currentDeptLabs = departmentDayLabs.get(day) || 0;
          if (currentDeptLabs >= maxDeptLabsPerDay) {
            continue;
          }
        }

        // Limit block sessions per semester per day (evenly distributes multi-hour blocks across days)
        const semTotalBlocks = semBlockCounts.get(demand.semester_id) || 1;
        const maxBlocksForThisSem = Math.max(1, Math.ceil(semTotalBlocks / numDays));
        const semBlockKey = `${demand.semester_id}_${day}`;
        if ((semesterDayBlocks.get(semBlockKey) || 0) >= maxBlocksForThisSem) {
          continue;
        }

        // Validate all slots in consecutive window
        let windowValid = true;
        const entriesToPlace = [];

        for (const ts of window) {
          // 1. Faculty busy check
          const facSlots = facultyOccupied.get(demand.faculty_id);
          if (facSlots && facSlots.has(ts.id)) {
            windowValid = false;
            break;
          }

          // 2. Semester busy check (with parallel activity support)
          const semSlots = semesterOccupied.get(demand.semester_id);
          const existingSubsInSlot = semSlots ? (semSlots.get(ts.id) || []) : [];
          if (existingSubsInSlot.length > 0) {
            if (!demand.is_parallel) {
              windowValid = false;
              break;
            }
            // For parallel candidate, all existing subjects in slot must also be parallel and different
            const canShare = existingSubsInSlot.every(subId => {
              const s = subjectsMap.get(subId);
              return s && s.is_parallel_activity && String(subId) !== String(demand.subject_id);
            }) && existingSubsInSlot.length < 2;

            if (!canShare) {
              windowValid = false;
              break;
            }
          }

          let blockSessionType = 'theory';
          if (candidateSubject?.is_generic_activity || candidateSubject?.is_parallel_activity) {
            blockSessionType = 'activity';
          } else if (demand.is_lab) {
            blockSessionType = 'lab';
          }

          const candidateEntry = {
            subject_id: demand.subject_id,
            semester_id: demand.semester_id,
            timeslot_id: ts.id,
            faculty_id: demand.faculty_id,
            academic_year: demand.academic_year,
            session_type: blockSessionType
          };

          // 3. Complete clash detection against currently scheduled entries
          const clashCheck = detectClash(candidateEntry, currentSchedule, subjectsMap, timeslotsMap, semestersMap);
          if (!clashCheck.isValid) {
            windowValid = false;
            break;
          }

          entriesToPlace.push(candidateEntry);
        }

        if (!windowValid) {
          continue;
        }

        // Forward step: Place the entire block atomically
        semesterDayBlocks.set(semBlockKey, (semesterDayBlocks.get(semBlockKey) || 0) + 1);
        for (const entry of entriesToPlace) {
          currentSchedule.push(entry);
          recordAssignment(entry);
        }

        // Recurse to next demand
        if (backtrack(demandIndex + 1)) {
          return true;
        }

        // Backtrack step: Remove the entire block atomically
        semesterDayBlocks.set(semBlockKey, Math.max(0, (semesterDayBlocks.get(semBlockKey) || 1) - 1));
        for (let k = 0; k < entriesToPlace.length; k++) {
          const removed = currentSchedule.pop();
          removeAssignment(removed);
        }
      }

      return false;
    }

    // -------------------------------------------------------------
    // Branch 2: SINGLE-HOUR DEMAND
    // -------------------------------------------------------------
    // Sort candidate timeslots dynamically: prefer days with fewer classes of this subject
    const candidateTimeslots = [...sortedTimeslots].sort((tsA, tsB) => {
      if (demand.is_lab) {
        const deptLabsA = departmentDayLabs.get(tsA.day) || 0;
        const deptLabsB = departmentDayLabs.get(tsB.day) || 0;
        if (deptLabsA !== deptLabsB) return deptLabsA - deptLabsB;
      }
      const countA = subjectDayHours.get(`${demand.semester_id}_${demand.subject_id}_${tsA.day}`) || 0;
      const countB = subjectDayHours.get(`${demand.semester_id}_${demand.subject_id}_${tsB.day}`) || 0;
      return countA - countB;
    });

    for (const ts of candidateTimeslots) {
      // Labs must never be placed in Period 1 or Period 2
      if (demand.is_lab && (ts.period_number === 1 || ts.period_number === 2)) {
        continue;
      }

      // 1. Faculty busy check
      const facSlots = facultyOccupied.get(demand.faculty_id);
      if (facSlots && facSlots.has(ts.id)) {
        continue;
      }

      // 2. Semester busy check (with parallel activity support)
      const semSlots = semesterOccupied.get(demand.semester_id);
      const existingSubsInSlot = semSlots ? (semSlots.get(ts.id) || []) : [];
      if (existingSubsInSlot.length > 0) {
        if (!demand.is_parallel) {
          continue;
        }
        const canShare = existingSubsInSlot.every(subId => {
          const s = subjectsMap.get(subId);
          return s && s.is_parallel_activity && String(subId) !== String(demand.subject_id);
        }) && existingSubsInSlot.length < 2;

        if (!canShare) {
          continue;
        }
      }

      // 3. Daily hour distribution heuristic
      const dayKey = `${demand.semester_id}_${demand.subject_id}_${ts.day}`;
      const currentDayHours = subjectDayHours.get(dayKey) || 0;
      const weeklyHours = Number(candidateSubject?.weekly_hours) || 0;

      // Dynamic max allowed hours per day (supports high-demand subjects up to 20h/week)
      const maxAllowedPerDay = Math.max(2, Math.ceil(weeklyHours / 5));
      if (!demand.is_lab && currentDayHours >= maxAllowedPerDay) {
        continue;
      }

      // Daily lab constraint: strictly at most 1 lab session in a day for any semester
      if (demand.is_lab) {
        const labKey = `${demand.semester_id}_${ts.day}`;
        if ((semesterDayLabs.get(labKey) || 0) > 0) {
          continue;
        }

        const deptLabs = departmentDayLabs.get(ts.day) || 0;
        if (deptLabs >= maxDeptLabsPerDay) {
          continue;
        }
      }

      let singleSessionType = 'theory';
      if (candidateSubject?.is_generic_activity || candidateSubject?.is_parallel_activity) {
        singleSessionType = 'activity';
      } else if (demand.is_lab) {
        singleSessionType = 'lab';
      }

      const candidateEntry = {
        subject_id: demand.subject_id,
        semester_id: demand.semester_id,
        timeslot_id: ts.id,
        faculty_id: demand.faculty_id,
        academic_year: demand.academic_year,
        session_type: singleSessionType
      };

      // 4. Pure clash detector check
      const clashResult = detectClash(candidateEntry, currentSchedule, subjectsMap, timeslotsMap, semestersMap);
      if (!clashResult.isValid) {
        continue;
      }

      // Forward step
      currentSchedule.push(candidateEntry);
      recordAssignment(candidateEntry);

      // Recurse to next demand
      if (backtrack(demandIndex + 1)) {
        return true;
      }

      // Backtrack step
      const removed = currentSchedule.pop();
      removeAssignment(removed);
    }

    return false;
  }

  const isSolved = backtrack(0);
  const durationMs = Date.now() - startTime;

  // Calculate total required slots across all demands
  const totalSlotsDemanded = slotDemands.reduce((sum, d) => sum + d.block_hours, 0);

  if (!isSolved) {
    return {
      success: false,
      schedule: [],
      message: `Could not generate a clash-free schedule with the current constraints (Total demands: ${totalSlotsDemanded} hours across ${semesters.length} semesters, Available slots: ${timeslots.length}).`,
      stats: {
        totalDemands: totalSlotsDemanded,
        totalTimeslots: timeslots.length,
        stepsExplored,
        durationMs
      }
    };
  }

  return {
    success: true,
    schedule: currentSchedule,
    message: `Timetable successfully generated for ${semesters.length} semester(s) with 0 clashes!`,
    stats: {
      totalEntries: currentSchedule.length,
      totalDemands: totalSlotsDemanded,
      stepsExplored,
      durationMs
    }
  };
}

module.exports = {
  generateTimetable
};
