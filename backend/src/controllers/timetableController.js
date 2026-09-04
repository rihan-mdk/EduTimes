const db = require('../config/db');
const { detectClash } = require('../services/clashDetector');
const { generateTimetable } = require('../services/scheduler');

// Helper to fetch full system lookup maps
async function fetchContextData(academicYear) {
  const [subjectsRes, existingRes, timeslotsRes, semestersRes] = await Promise.all([
    db.query(`
      SELECT sub.*, f.name as faculty_name, f.faculty_code, sem.number as semester_number
      FROM subject sub
      LEFT JOIN faculty f ON sub.faculty_id = f.id
      LEFT JOIN semester sem ON sub.semester_id = sem.id
    `),
    db.query(`
      SELECT te.*, sub.faculty_id, sub.name as subject_name, sub.subject_code, f.name as faculty_name, sem.number as semester_number
      FROM timetable_entry te
      JOIN subject sub ON te.subject_id = sub.id
      LEFT JOIN faculty f ON sub.faculty_id = f.id
      LEFT JOIN semester sem ON te.semester_id = sem.id
      WHERE te.academic_year = $1
    `, [academicYear]),
    db.query('SELECT * FROM timeslot ORDER BY id ASC'),
    db.query('SELECT * FROM semester ORDER BY number ASC')
  ]);

  const subjectsMap = new Map();
  subjectsRes.rows.forEach(s => subjectsMap.set(s.id, s));

  const timeslotsMap = new Map();
  timeslotsRes.rows.forEach(t => timeslotsMap.set(t.id, t));

  const semestersMap = new Map();
  semestersRes.rows.forEach(s => semestersMap.set(s.id, s));

  return {
    subjects: subjectsRes.rows,
    subjectsMap,
    existingEntries: existingRes.rows,
    timeslots: timeslotsRes.rows,
    timeslotsMap,
    semesters: semestersRes.rows,
    semestersMap
  };
}

// Helper: fetch IDs of all existing entries in a specific slot
async function getSlotOccupantIds(semesterId, timeslotId, academicYear, excludeEntryId = null) {
  let query = `SELECT id FROM timetable_entry WHERE semester_id = $1 AND timeslot_id = $2 AND academic_year = $3`;
  const params = [semesterId, timeslotId, academicYear];
  if (excludeEntryId) {
    params.push(excludeEntryId);
    query += ` AND id != $${params.length}`;
  }
  const res = await db.query(query, params);
  return res.rows.map(r => r.id);
}

// 1. Get Timetable (with rich joined details)
async function getTimetable(req, res) {
  try {
    const { semester_id, academic_year, faculty_id, department_id } = req.query;

    let query = `
      SELECT 
        te.id,
        te.subject_id,
        te.semester_id,
        te.timeslot_id,
        te.academic_year,
        te.session_type,
        sub.subject_code,
        sub.name as subject_name,
        sub.is_lab,
        sub.is_parallel_activity,
        sub.is_generic_activity,
        sub.weekly_hours,
        f.id as faculty_id,
        f.name as faculty_name,
        f.faculty_code,
        sem.number as semester_number,
        sem.class_room,
        sem.department_id,
        d.name as department_name,
        d.code as department_code,
        ts.day,
        ts.period_number,
        ts.start_time,
        ts.end_time
      FROM timetable_entry te
      JOIN subject sub ON te.subject_id = sub.id
      JOIN faculty f ON sub.faculty_id = f.id
      JOIN semester sem ON te.semester_id = sem.id
      LEFT JOIN department d ON sem.department_id = d.id
      JOIN timeslot ts ON te.timeslot_id = ts.id
      WHERE 1=1
    `;
    const params = [];

    if (semester_id) {
      params.push(semester_id);
      query += ` AND te.semester_id = $${params.length}`;
    }

    if (department_id) {
      params.push(department_id);
      query += ` AND sem.department_id = $${params.length}`;
    }

    if (academic_year) {
      params.push(academic_year);
      query += ` AND te.academic_year = $${params.length}`;
    }

    if (faculty_id) {
      params.push(faculty_id);
      query += ` AND sub.faculty_id = $${params.length}`;
    }

    query += `
      ORDER BY 
        CASE ts.day
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
          ELSE 7
        END,
        ts.period_number ASC
    `;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// 2. Validate a tentative move/placement (for live clash warning in frontend)
async function validateEntryPlacement(req, res) {
  try {
    const { id, exclude_entry_ids, exclude_same_slot, replace_slot, subject_id, semester_id, timeslot_id, academic_year } = req.body;
    if (!subject_id || !semester_id || !timeslot_id || !academic_year) {
      return res.status(400).json({ error: 'subject_id, semester_id, timeslot_id, and academic_year are required.' });
    }

    const context = await fetchContextData(academic_year);

    // When replace_slot is active, all current occupants will be deleted — exclude them from clash check
    let effectiveExcludeIds = Array.isArray(exclude_entry_ids) ? [...exclude_entry_ids] : [];
    if (replace_slot) {
      const slotOccupantIds = await getSlotOccupantIds(semester_id, timeslot_id, academic_year, id || null);
      effectiveExcludeIds = [...new Set([...effectiveExcludeIds, ...slotOccupantIds.map(String)])];
    }

    const candidate = { 
      id, 
      exclude_entry_ids: effectiveExcludeIds,
      exclude_same_slot: Boolean(exclude_same_slot || replace_slot), 
      subject_id, 
      semester_id, 
      timeslot_id, 
      academic_year 
    };
    const clashResult = detectClash(candidate, context.existingEntries, context.subjectsMap, context.timeslotsMap, context.semestersMap);

    res.json(clashResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// 3. Create Timetable Entry (with mandatory clash detection)
async function createTimetableEntry(req, res) {
  try {
    const { subject_id, semester_id, timeslot_id, academic_year, replace_slot, session_type } = req.body;
    if (!subject_id || !semester_id || !timeslot_id || !academic_year) {
      return res.status(400).json({ error: 'subject_id, semester_id, timeslot_id, and academic_year are required.' });
    }

    const context = await fetchContextData(academic_year);

    // When replace_slot is active, exclude all current occupants from clash check
    let effectiveExcludeIds = [];
    if (replace_slot) {
      const slotOccupantIds = await getSlotOccupantIds(semester_id, timeslot_id, academic_year);
      effectiveExcludeIds = slotOccupantIds.map(String);
    }

    const candidate = { 
      subject_id, 
      semester_id, 
      timeslot_id, 
      academic_year,
      exclude_entry_ids: effectiveExcludeIds,
      exclude_same_slot: Boolean(replace_slot)
    };
    const clashResult = detectClash(candidate, context.existingEntries, context.subjectsMap, context.timeslotsMap, context.semestersMap);

    if (!clashResult.isValid) {
      return res.status(409).json({
        error: clashResult.error,
        clashType: clashResult.clashType,
        conflictingEntry: clashResult.conflictingEntry
      });
    }

    if (replace_slot) {
      await db.query(
        'DELETE FROM timetable_entry WHERE semester_id = $1 AND timeslot_id = $2 AND academic_year = $3',
        [semester_id, timeslot_id, academic_year]
      );
    }

    // Derive session_type: explicit override > subject flags > default 'theory'
    const resolvedSessionType = session_type || 'theory';

    const insertQuery = `
      INSERT INTO timetable_entry (subject_id, semester_id, timeslot_id, academic_year, session_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await db.query(insertQuery, [subject_id, semester_id, timeslot_id, academic_year, resolvedSessionType]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A class is already scheduled for this semester and timeslot.' });
    }
    res.status(500).json({ error: err.message });
  }
}

// 4. Update / Move Timetable Entry (with mandatory clash detection)
async function updateTimetableEntry(req, res) {
  try {
    const { id } = req.params;
    const { subject_id, semester_id, timeslot_id, academic_year, replace_slot, session_type } = req.body;
    if (!subject_id || !semester_id || !timeslot_id || !academic_year) {
      return res.status(400).json({ error: 'subject_id, semester_id, timeslot_id, and academic_year are required.' });
    }

    const context = await fetchContextData(academic_year);

    // When replace_slot is active, fetch ALL occupants of this slot (excluding self)
    // and exclude them from the clash check — they'll be deleted right after.
    let effectiveExcludeIds = [String(id)]; // always exclude self
    if (replace_slot) {
      const slotOccupantIds = await getSlotOccupantIds(semester_id, timeslot_id, academic_year, id);
      effectiveExcludeIds = [...new Set([String(id), ...slotOccupantIds.map(String)])];
    }

    const candidate = { 
      id, 
      subject_id, 
      semester_id, 
      timeslot_id, 
      academic_year,
      exclude_entry_ids: effectiveExcludeIds,
      exclude_same_slot: Boolean(replace_slot)
    };
    const clashResult = detectClash(candidate, context.existingEntries, context.subjectsMap, context.timeslotsMap, context.semestersMap);

    if (!clashResult.isValid) {
      return res.status(409).json({
        error: clashResult.error,
        clashType: clashResult.clashType,
        conflictingEntry: clashResult.conflictingEntry
      });
    }

    if (replace_slot) {
      // Remove all OTHER entries in this slot (excluding the one being updated)
      await db.query(
        'DELETE FROM timetable_entry WHERE semester_id = $1 AND timeslot_id = $2 AND academic_year = $3 AND id != $4',
        [semester_id, timeslot_id, academic_year, id]
      );
    }

    // Derive session_type
    const resolvedSessionType = session_type || 'theory';

    const updateQuery = `
      UPDATE timetable_entry
      SET subject_id = $1, semester_id = $2, timeslot_id = $3, academic_year = $4, session_type = $5
      WHERE id = $6
      RETURNING *
    `;
    const result = await db.query(updateQuery, [subject_id, semester_id, timeslot_id, academic_year, resolvedSessionType, id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Timetable entry not found.' });

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A class is already scheduled for this semester and timeslot.' });
    }
    res.status(500).json({ error: err.message });
  }
}

// 5. Delete Timetable Entry
async function deleteTimetableEntry(req, res) {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM timetable_entry WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Timetable entry not found.' });
    res.json({ message: 'Timetable entry deleted successfully', deleted: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// 6. Auto-generate Timetable for Semesters (Backtracking Algorithm)
async function autoGenerateTimetable(req, res) {
  const client = await db.pool.connect();
  try {
    const { academic_year, overwrite = true, department_id } = req.body;
    if (!academic_year) {
      return res.status(400).json({ error: 'academic_year is required (e.g. "2025-2026").' });
    }

    let semQuery = 'SELECT * FROM semester WHERE academic_year = $1';
    let subQuery = `
      SELECT sub.*, sem.academic_year
      FROM subject sub
      JOIN semester sem ON sub.semester_id = sem.id
      WHERE sem.academic_year = $1
    `;
    const semParams = [academic_year];
    const subParams = [academic_year];

    if (department_id) {
      semParams.push(department_id);
      semQuery += ` AND department_id = $${semParams.length}`;

      subParams.push(department_id);
      subQuery += ` AND sem.department_id = $${subParams.length}`;
    }

    semQuery += ' ORDER BY number ASC';

    // Fetch semesters, subjects, timeslots, and existing entries of other departments
    const [semestersRes, subjectsRes, timeslotsRes, existingOtherEntriesRes] = await Promise.all([
      client.query(semQuery, semParams),
      client.query(subQuery, subParams),
      client.query('SELECT * FROM timeslot ORDER BY id ASC'),
      department_id 
        ? client.query(`
            SELECT te.*, sub.faculty_id
            FROM timetable_entry te
            JOIN semester sem ON te.semester_id = sem.id
            LEFT JOIN subject sub ON te.subject_id = sub.id
            WHERE te.academic_year = $1 AND sem.department_id != $2
          `, [academic_year, department_id])
        : Promise.resolve({ rows: [] })
    ]);

    const semesters = semestersRes.rows;
    const subjects = subjectsRes.rows;
    const timeslots = timeslotsRes.rows;
    const otherDeptEntries = existingOtherEntriesRes.rows || [];

    if (semesters.length === 0) {
      return res.status(400).json({ error: `No semesters found for academic year ${academic_year}${department_id ? ' in this department' : ''}.` });
    }
    if (subjects.length === 0) {
      return res.status(400).json({ error: `No subjects configured for academic year ${academic_year}${department_id ? ' in this department' : ''}.` });
    }
    if (timeslots.length === 0) {
      return res.status(400).json({ error: 'No timeslots configured in the system.' });
    }

    // Run deterministic backtracking solver across the department's semesters,
    // respecting existing entries of other departments so shared faculty are not double-booked
    const solution = generateTimetable({
      semesters,
      subjects,
      timeslots,
      academicYear: academic_year,
      existingEntries: otherDeptEntries
    });

    if (!solution.success) {
      return res.status(422).json({
        error: solution.message,
        stats: solution.stats
      });
    }

    // Commit generated entries to database inside a transaction
    await client.query('BEGIN');

    if (overwrite) {
      if (department_id) {
        await client.query(`
          DELETE FROM timetable_entry
          WHERE academic_year = $1 AND semester_id IN (
            SELECT id FROM semester WHERE department_id = $2
          )
        `, [academic_year, department_id]);
      } else {
        await client.query('DELETE FROM timetable_entry WHERE academic_year = $1', [academic_year]);
      }
    }

    const insertedEntries = [];
    for (const entry of solution.schedule) {
      const sessionType = entry.session_type || 'theory';
      const insRes = await client.query(`
        INSERT INTO timetable_entry (subject_id, semester_id, timeslot_id, academic_year, session_type)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [entry.subject_id, entry.semester_id, entry.timeslot_id, entry.academic_year, sessionType]);
      insertedEntries.push(insRes.rows[0]);
    }

    await client.query('COMMIT');

    return res.json({
      message: solution.message,
      entriesCount: insertedEntries.length,
      stats: solution.stats
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

// 7. Clear Timetable for semester / academic year
async function clearTimetable(req, res) {
  try {
    const { semester_id, academic_year } = req.body;
    if (!academic_year) {
      return res.status(400).json({ error: 'academic_year is required.' });
    }

    let query = 'DELETE FROM timetable_entry WHERE academic_year = $1';
    const params = [academic_year];

    if (semester_id) {
      params.push(semester_id);
      query += ' AND semester_id = $2';
    }

    const result = await db.query(query, params);
    res.json({ message: `Cleared ${result.rowCount} timetable entries.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getTimetable,
  validateEntryPlacement,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  autoGenerateTimetable,
  clearTimetable
};
