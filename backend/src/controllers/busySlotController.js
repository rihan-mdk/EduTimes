const db = require('../config/db');
const { sanitizeText } = require('../utils/sanitize');

/**
 * GET /api/faculty-busy-slots
 * Retrieve busy slots, scoped to user role & department.
 */
async function getBusySlots(req, res) {
  try {
    const { faculty_id, academic_year } = req.query;
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const userDeptId = req.user?.department_id;

    const conditions = [];
    const params = [];

    // Faculty members can only view their own busy slots
    if (userRole === 'faculty') {
      params.push(userId);
      conditions.push(`fbs.faculty_id = $${params.length}`);
    } else {
      // Admin: filter by query faculty_id if provided
      if (faculty_id) {
        params.push(faculty_id);
        conditions.push(`fbs.faculty_id = $${params.length}`);
      }
      // Restrict admin to faculty within their department
      if (userDeptId) {
        params.push(userDeptId);
        conditions.push(`f.department_id = $${params.length}`);
      }
    }

    if (academic_year) {
      params.push(academic_year);
      conditions.push(`fbs.academic_year = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        fbs.id,
        fbs.faculty_id,
        fbs.timeslot_id,
        fbs.academic_year,
        fbs.reason,
        fbs.created_at,
        f.name AS faculty_name,
        f.faculty_code,
        ts.day,
        ts.period_number,
        ts.start_time,
        ts.end_time
      FROM faculty_busy_slot fbs
      JOIN faculty f ON fbs.faculty_id = f.id
      JOIN timeslot ts ON fbs.timeslot_id = ts.id
      ${whereClause}
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

/**
 * POST /api/faculty-busy-slots
 * Create one or more busy slots.
 * Body: { faculty_id, timeslot_ids: [number], academic_year, reason }
 */
async function createBusySlots(req, res) {
  try {
    const { faculty_id, timeslot_ids, academic_year, reason } = req.body;
    const userDeptId = req.user?.department_id;

    if (!faculty_id || !timeslot_ids || !Array.isArray(timeslot_ids) || timeslot_ids.length === 0 || !academic_year) {
      return res.status(400).json({
        error: 'faculty_id, timeslot_ids (array), and academic_year are required.'
      });
    }

    // Tenant check: ensure target faculty belongs to admin's department
    if (userDeptId) {
      const facultyCheck = await db.query('SELECT department_id FROM faculty WHERE id = $1', [faculty_id]);
      if (facultyCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Faculty not found' });
      }
      if (String(facultyCheck.rows[0].department_id) !== String(userDeptId)) {
        return res.status(403).json({ error: 'Access denied: Cannot configure busy slots for another department' });
      }
    }

    const sanitizedReason = reason ? sanitizeText(reason, 255) : null;
    const inserted = [];
    for (const timeslot_id of timeslot_ids) {
      const result = await db.query(`
        INSERT INTO faculty_busy_slot (faculty_id, timeslot_id, academic_year, reason)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (faculty_id, timeslot_id, academic_year) DO UPDATE
          SET reason = EXCLUDED.reason
        RETURNING *
      `, [faculty_id, timeslot_id, academic_year, sanitizedReason]);
      inserted.push(result.rows[0]);
    }

    res.status(201).json({ created: inserted.length, slots: inserted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /api/faculty-busy-slots/:id
 * Remove a specific busy slot.
 */
async function deleteBusySlot(req, res) {
  try {
    const { id } = req.params;
    const userDeptId = req.user?.department_id;

    // Tenant check: verify slot's faculty belongs to admin's department
    if (userDeptId) {
      const slotCheck = await db.query(`
        SELECT fbs.id, f.department_id 
        FROM faculty_busy_slot fbs
        JOIN faculty f ON fbs.faculty_id = f.id
        WHERE fbs.id = $1
      `, [id]);

      if (slotCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Busy slot not found.' });
      }
      if (String(slotCheck.rows[0].department_id) !== String(userDeptId)) {
        return res.status(403).json({ error: 'Access denied: Cannot delete busy slot from another department' });
      }
    }

    const result = await db.query('DELETE FROM faculty_busy_slot WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Busy slot not found.' });
    }
    res.json({ message: 'Busy slot removed.', deleted: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getBusySlots,
  createBusySlots,
  deleteBusySlot
};

