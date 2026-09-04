const db = require('../config/db');

async function getAllTimeslots(req, res) {
  try {
    const result = await db.query(`
      SELECT * FROM timeslot 
      ORDER BY 
        CASE day
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
          ELSE 7
        END,
        period_number ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[Timeslot] Error fetching timeslots:', err);
    res.status(500).json({ error: err.message });
  }
}

async function getTimeslotById(req, res) {
  try {
    const result = await db.query('SELECT * FROM timeslot WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Timeslot not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Timeslot] Error fetching timeslot by ID:', err);
    res.status(500).json({ error: err.message });
  }
}

async function createTimeslot(req, res) {
  try {
    const { day, period_number, start_time, end_time } = req.body;
    if (!day || !period_number || !start_time || !end_time) {
      return res.status(400).json({ error: 'day, period_number, start_time, and end_time are required' });
    }

    const dayName = day.trim();
    const periodNum = parseInt(period_number, 10);

    // Step 1: Pre-validate uniqueness for (day, period_number)
    console.log(`\n🔍 [Timeslot Validation] Checking slot ${dayName} Period ${periodNum}`);
    const checkSql = 'SELECT id FROM timeslot WHERE day = $1 AND period_number = $2';
    console.log(`   SQL: ${checkSql} | Params: [ "${dayName}", ${periodNum} ]`);

    const existing = await db.query(checkSql, [dayName, periodNum]);
    if (existing.rows.length > 0) {
      console.warn(`⚠️ [Timeslot Validation] Duplicate found: ${dayName} Period ${periodNum} already exists (ID=${existing.rows[0].id})`);
      return res.status(400).json({ 
        error: `A timeslot for ${dayName} Period ${periodNum} is already configured.`,
        field: 'period_number'
      });
    }
    console.log(`✅ [Timeslot Validation] Timeslot ${dayName} Period ${periodNum} is available.`);

    const insertSql = `
      INSERT INTO timeslot (day, period_number, start_time, end_time)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    console.log(`📝 [Timeslot Insert] Executing insert for ${dayName} Period ${periodNum}`);

    const result = await db.query(insertSql, [dayName, periodNum, start_time, end_time]);
    console.log(`🎉 [Timeslot Insert] Successfully created timeslot ID=${result.rows[0].id}`);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ [Timeslot Insert Error]:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      constraint: err.constraint
    });

    if (err.code === '23505') {
      return res.status(400).json({ error: 'A timeslot for this day and period already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
}

async function updateTimeslot(req, res) {
  try {
    const { day, period_number, start_time, end_time } = req.body;
    const { id } = req.params;

    const dayName = day.trim();
    const periodNum = parseInt(period_number, 10);

    console.log(`\n🔍 [Timeslot Update Validation] Checking slot ${dayName} Period ${periodNum} for ID != ${id}`);
    const checkSql = 'SELECT id FROM timeslot WHERE day = $1 AND period_number = $2 AND id != $3';
    const existing = await db.query(checkSql, [dayName, periodNum, id]);
    if (existing.rows.length > 0) {
      console.warn(`⚠️ [Timeslot Update] Slot ${dayName} Period ${periodNum} already in use`);
      return res.status(400).json({ error: `A timeslot for ${dayName} Period ${periodNum} already exists.` });
    }

    const updateSql = `
      UPDATE timeslot
      SET day = $1, period_number = $2, start_time = $3, end_time = $4
      WHERE id = $5
      RETURNING *
    `;
    const result = await db.query(updateSql, [dayName, periodNum, start_time, end_time, id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Timeslot not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ [Timeslot Update Error]:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'A timeslot for this day and period already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
}

async function deleteTimeslot(req, res) {
  try {
    const result = await db.query('DELETE FROM timeslot WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Timeslot not found' });
    console.log(`🗑️ [Timeslot Delete] Deleted timeslot ID=${result.rows[0].id} (${result.rows[0].day} P${result.rows[0].period_number})`);
    res.json({ message: 'Timeslot deleted successfully', deleted: result.rows[0] });
  } catch (err) {
    console.error('❌ [Timeslot Delete Error]:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getAllTimeslots,
  getTimeslotById,
  createTimeslot,
  updateTimeslot,
  deleteTimeslot
};
