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
 * 
 * @returns {Object} { success: boolean, schedule: Array<Object>, message: string, stats: Object }
 */
function generateTimetable({ semesters, subjects, timeslots, academicYear, existingEntries = [] }) {
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
    const blockHours = Number(subj.block_session_hours) || 0;
    const blockCount = Number(subj.block_session_count) || 0;
    const isParallel = Boolean(subj.is_parallel_activity);
    const isLab = Boolean(subj.is_lab);

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

  // Sort single-hour demands: parallel subjects together, then higher faculty load, then labs
  singleDemands.sort((a, b) => {
    if (b.is_parallel !== a.is_parallel) return b.is_parallel ? 1 : -1;
    const loadDiff = (facultyTotalHours[b.faculty_id] || 0) - (facultyTotalHours[a.faculty_id] || 0);
    if (loadDiff !== 0) return loadDiff;
    if (b.is_lab !== a.is_lab) return b.is_lab ? 1 : -1;
    return a.semester_id - b.semester_id;
  });

  // All block demands are placed FIRST, followed by single-hour demands
  const slotDemands = [...blockDemands, ...singleDemands];

  // Precompute candidate consecutive slot windows for block demands
  function getCandidateConsecutiveWindows(length) {
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
          windows.push(daySlots.slice(i, i + length));
        }
      }
    }
    return windows;
  }

  // Cache candidate block windows by block length
  const blockWindowsByLength = new Map();
  const uniqueBlockLengths = new Set(blockDemands.map(d => d.block_hours));
  uniqueBlockLengths.forEach(len => {
    blockWindowsByLength.set(len, getCandidateConsecutiveWindows(len));
  });

  // Current Schedule state
  const currentSchedule = [...existingEntries];

  // Tracking state structures:
  // facultyOccupied: Map<faculty_id, Set<timeslot_id>>
  // semesterOccupied: Map<semester_id, Map<timeslot_id, Array<subject_id>>>
  // subjectDayHours: Map<"semId_subId_day", count>
  const facultyOccupied = new Map();
  const semesterOccupied = new Map();
  const subjectDayHours = new Map();

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
    }
  }

  existingEntries.forEach(recordAssignment);

  let stepsExplored = 0;
  const MAX_STEPS = 500000; // Search limit

  /**
   * Recursive Backtracking Solver
   * @param {number} demandIndex - Index of current slot demand to fulfill
   */
  function backtrack(demandIndex) {
    if (demandIndex >= slotDemands.length) {
      return true; // All demands successfully scheduled!
    }

    stepsExplored++;
    if (stepsExplored > MAX_STEPS) {
      return false;
    }

    const demand = slotDemands[demandIndex];
    const candidateSubject = subjectsMap.get(demand.subject_id);

    // -------------------------------------------------------------
    // Branch 1: ATOMIC BLOCK DEMAND (Consecutive Periods)
    // -------------------------------------------------------------
    if (demand.type === 'BLOCK') {
      const length = demand.block_hours;
      const candidateWindows = blockWindowsByLength.get(length) || [];

      // Sort candidate windows dynamically: prefer days with fewer hours for this subject
      const sortedWindows = [...candidateWindows].sort((winA, winB) => {
        const dayA = winA[0].day;
        const dayB = winB[0].day;
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

          const isLabSession = Boolean(demand.is_lab || demand.block_hours > 1);
          const candidateEntry = {
            subject_id: demand.subject_id,
            semester_id: demand.semester_id,
            timeslot_id: ts.id,
            faculty_id: demand.faculty_id,
            academic_year: demand.academic_year,
            session_type: isLabSession ? 'lab' : 'theory'
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
        for (const entry of entriesToPlace) {
          currentSchedule.push(entry);
          recordAssignment(entry);
        }

        // Recurse to next demand
        if (backtrack(demandIndex + 1)) {
          return true;
        }

        // Backtrack step: Remove the entire block atomically
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
      const countA = subjectDayHours.get(`${demand.semester_id}_${demand.subject_id}_${tsA.day}`) || 0;
      const countB = subjectDayHours.get(`${demand.semester_id}_${demand.subject_id}_${tsB.day}`) || 0;
      return countA - countB;
    });

    for (const ts of candidateTimeslots) {
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

      // Max 1 hour per day for low-hour subjects, max 2 hours per day for heavy subjects (e.g. 7 hrs/week)
      const maxAllowedPerDay = weeklyHours > 6 ? 2 : (weeklyHours > 4 ? 2 : 1);
      if (!demand.is_lab && currentDayHours >= maxAllowedPerDay) {
        continue;
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
