/**
 * Clash Detection Engine for YenSync
 * 
 * Standalone, testable validation module that strictly checks constraints:
 * 1. Faculty Conflict: No faculty can teach more than one subject in the same timeslot (across any semester).
 *    Exception: Generic activities (is_generic_activity=true) skip this check — they can run simultaneously
 *    across multiple semesters (e.g. Library hour, Placement Training).
 * 2. Semester Conflict: No semester can have more than one subject scheduled in the same timeslot.
 *    Exception: Parallel activities (is_parallel_activity=true) where students split into groups (NSS/PE).
 * 3. Academic Year Match: Validates entries belong to the correct academic cycle.
 */

/**
 * Validates whether a candidate timetable entry clashes with existing timetable entries.
 * 
 * @param {Object} candidate - The entry to add/update
 * @param {number|string} candidate.id - (Optional) Current entry ID if updating (to ignore self)
 * @param {number|string} candidate.subject_id - Subject ID
 * @param {number|string} candidate.semester_id - Semester ID
 * @param {number|string} candidate.timeslot_id - Timeslot ID
 * @param {string} candidate.academic_year - Academic Year (e.g., '2025-2026')
 * @param {number|string[]} [candidate.exclude_entry_ids] - Entry IDs to skip in clash check (e.g. slot being replaced)
 * @param {boolean} [candidate.exclude_same_slot] - If true, skip ALL same-slot/same-semester entries
 * @param {number|string} [candidate.faculty_id] - Faculty ID assigned to the subject (if pre-resolved)
 * 
 * @param {Array<Object>} existingEntries - List of existing timetable entries in the system
 * @param {Map<number|string, Object>|Array<Object>} subjectsMap - Map or list of subjects keyed by subject id
 * @param {Map<number|string, Object>|Array<Object>} [timeslotsMap] - Map or list of timeslots keyed by timeslot id
 * 
 * @returns {Object} { isValid: boolean, error: string|null, clashType: string|null, conflictingEntry: Object|null }
 */
function detectClash(candidate, existingEntries, subjectsMap, timeslotsMap = null, semestersMap = null) {
  if (!candidate) {
    return { isValid: false, error: 'Candidate timetable entry is required.', clashType: 'INVALID_PAYLOAD', conflictingEntry: null };
  }

  const { id: candidateId, exclude_entry_ids, exclude_same_slot, subject_id, semester_id, timeslot_id, academic_year } = candidate;

  if (!subject_id || !semester_id || !timeslot_id) {
    return {
      isValid: false,
      error: 'subject_id, semester_id, and timeslot_id are required fields.',
      clashType: 'MISSING_FIELDS',
      conflictingEntry: null
    };
  }

  // Build the set of entry IDs to exclude from clash checks
  // Always excludes self (candidateId); also excludes any explicitly listed IDs
  const excludeIds = new Set(
    Array.isArray(exclude_entry_ids)
      ? exclude_entry_ids.map(String)
      : (candidateId ? [String(candidateId)] : [])
  );
  // Also exclude self if candidateId was not in exclude_entry_ids
  if (candidateId) excludeIds.add(String(candidateId));

  // Normalize subjects lookup
  const getSubject = (subId) => {
    if (subjectsMap instanceof Map) return subjectsMap.get(Number(subId)) || subjectsMap.get(String(subId));
    if (Array.isArray(subjectsMap)) return subjectsMap.find(s => String(s.id) === String(subId));
    if (typeof subjectsMap === 'object' && subjectsMap !== null) return subjectsMap[subId];
    return null;
  };

  // Helper to resolve human-readable academic semester label (e.g. "Semester 5" rather than "Semester #2")
  const getSemesterLabel = (semId, sub = null, entry = null) => {
    if (entry && entry.semester_number != null) {
      return `Semester ${entry.semester_number}`;
    }
    if (candidate && String(semId) === String(semester_id) && candidate.semester_number != null) {
      return `Semester ${candidate.semester_number}`;
    }
    if (sub && sub.semester_number != null) {
      return `Semester ${sub.semester_number}`;
    }
    if (semestersMap) {
      let semObj = null;
      if (semestersMap instanceof Map) {
        semObj = semestersMap.get(Number(semId)) || semestersMap.get(String(semId));
      } else if (Array.isArray(semestersMap)) {
        semObj = semestersMap.find(s => String(s.id) === String(semId));
      } else if (typeof semestersMap === 'object' && semestersMap !== null) {
        semObj = semestersMap[semId];
      }
      if (semObj) {
        const num = semObj.number != null ? semObj.number : (semObj.name || semObj.id);
        return `Semester ${num}`;
      }
    }
    return `Semester ${semId}`;
  };

  const candidateSubject = getSubject(subject_id);
  const candidateFacultyId = candidate.faculty_id || (candidateSubject ? candidateSubject.faculty_id : null);

  // Generic activities (Library, Mentoring, Placement, etc.) do not trigger
  // faculty clash — they can run simultaneously across semesters.
  const candidateIsGeneric = Boolean(candidateSubject && candidateSubject.is_generic_activity);

  for (const entry of existingEntries) {
    // Skip entries that are explicitly excluded (self, or entries being replaced)
    if (excludeIds.has(String(entry.id))) {
      continue;
    }

    // Skip ALL same-slot/same-semester occupants when replace_slot=true
    if (exclude_same_slot && String(entry.timeslot_id) === String(timeslot_id) && String(entry.semester_id) === String(semester_id)) {
      continue;
    }

    // Filter to the same academic year if specified
    if (academic_year && entry.academic_year && entry.academic_year !== academic_year) {
      continue;
    }

    // Check 1: Same Timeslot Conflict
    if (String(entry.timeslot_id) === String(timeslot_id)) {
      // Rule 1.1: Semester Double-Booking
      // No other entry can have the same semester_id + same timeslot
      // Exception: Parallel activities (e.g. NSS/PE) where students split into groups
      if (String(entry.semester_id) === String(semester_id)) {
        const existingSubject = getSubject(entry.subject_id);
        const isBothParallel = Boolean(
          candidateSubject && candidateSubject.is_parallel_activity &&
          existingSubject && existingSubject.is_parallel_activity &&
          String(entry.subject_id) !== String(candidate.subject_id)
        );

        if (!isBothParallel) {
          const subName = existingSubject ? `${existingSubject.name} (${existingSubject.subject_code})` : `Subject #${entry.subject_id}`;
          const semLabel = getSemesterLabel(semester_id, candidateSubject, entry);
          return {
            isValid: false,
            clashType: 'SEMESTER_CLASH',
            error: `${semLabel} already has a class scheduled at this timeslot: ${subName}.`,
            conflictingEntry: entry
          };
        }
      }

      // Rule 1.2: Faculty Double-Booking
      // No other entry can have the same faculty (via subject) + same timeslot
      // Exception: Generic activities skip this check entirely
      if (candidateFacultyId && !candidateIsGeneric) {
        const entrySubject = getSubject(entry.subject_id);
        const entryIsGeneric = Boolean(entrySubject && entrySubject.is_generic_activity);
        const entryFacultyId = entry.faculty_id || (entrySubject ? entrySubject.faculty_id : null);

        // Only check faculty clash if neither side is a generic activity
        if (!entryIsGeneric && entryFacultyId && String(entryFacultyId) === String(candidateFacultyId)) {
          const facultyName = (candidateSubject && candidateSubject.faculty_name) ||
                             (entrySubject && entrySubject.faculty_name) ||
                             `Faculty ID #${candidateFacultyId}`;
          const currentSubName = candidateSubject ? candidateSubject.name : `Subject #${subject_id}`;
          const existingSubName = entrySubject ? entrySubject.name : `Subject #${entry.subject_id}`;
          const entrySemLabel = getSemesterLabel(entry.semester_id, entrySubject, entry);

          return {
            isValid: false,
            clashType: 'FACULTY_CLASH',
            error: `Faculty conflict: ${facultyName} is already assigned to teach "${existingSubName}" (${entrySemLabel}) at this timeslot. Cannot schedule "${currentSubName}".`,
            conflictingEntry: entry
          };
        }
      }
    }
  }

  return {
    isValid: true,
    error: null,
    clashType: null,
    conflictingEntry: null
  };
}

/**
 * Validates a batch or full schedule for all internal clashes.
 * 
 * @param {Array<Object>} entries 
 * @param {Map<number|string, Object>|Array<Object>} subjectsMap 
 * @returns {Array<Object>} Array of clash errors found
 */
function validateEntireSchedule(entries, subjectsMap) {
  const clashes = [];
  for (let i = 0; i < entries.length; i++) {
    const candidate = entries[i];
    const priorEntries = entries.slice(0, i);
    const result = detectClash(candidate, priorEntries, subjectsMap);
    if (!result.isValid) {
      clashes.push({
        entryIndex: i,
        entry: candidate,
        ...result
      });
    }
  }
  return clashes;
}

module.exports = {
  detectClash,
  validateEntireSchedule
};
