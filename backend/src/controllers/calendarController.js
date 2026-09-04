const db = require('../config/db');

async function getAllCalendarDates(req, res) {
  try {
    const result = await db.query('SELECT * FROM academic_calendar ORDER BY date ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createCalendarDate(req, res) {
  try {
    const { date, type, remarks } = req.body;
    if (!date || !type) {
      return res.status(400).json({ error: 'date and type are required' });
    }

    const result = await db.query(`
      INSERT INTO academic_calendar (date, type, remarks)
      VALUES ($1, $2, $3)
      ON CONFLICT (date) DO UPDATE SET type = EXCLUDED.type, remarks = EXCLUDED.remarks
      RETURNING *
    `, [date, type, remarks]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteCalendarDate(req, res) {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM academic_calendar WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Calendar date not found' });
    res.json({ message: 'Deleted successfully', deleted: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getAllCalendarDates,
  createCalendarDate,
  deleteCalendarDate
};
