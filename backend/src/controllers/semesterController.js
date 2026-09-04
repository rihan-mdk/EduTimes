const db = require('../config/db');

async function getAllSemesters(req, res) {
  try {
    const result = await db.query(`
      SELECT s.*, d.name as department_name
      FROM semester s
      LEFT JOIN department d ON s.department_id = d.id
      ORDER BY s.number ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[Semester] Error fetching semesters:', err);
    res.status(500).json({ error: err.message });
  }
}

async function getSemesterById(req, res) {
  try {
    const result = await db.query(`
      SELECT s.*, d.name as department_name
      FROM semester s
      LEFT JOIN department d ON s.department_id = d.id
      WHERE s.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Semester not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Semester] Error fetching semester by ID:', err);
    res.status(500).json({ error: err.message });
  }
}

async function createSemester(req, res) {
  try {
    const { number, department_id, class_room, academic_year } = req.body;
    if (!number || !department_id || !class_room || !academic_year) {
      return res.status(400).json({ error: 'number, department_id, class_room, and academic_year are required' });
    }

    const semNum = parseInt(number, 10);
    const deptId = parseInt(department_id, 10);
    const year = academic_year.trim();
    const room = class_room.trim();

    // Step 1: Pre-validate duplicate semester number in the same department & academic year
    console.log(`\n🔍 [Semester Validation] Checking semester #${semNum} for Department #${deptId} (${year})`);
    const checkSql = 'SELECT id, number FROM semester WHERE number = $1 AND department_id = $2 AND academic_year = $3';
    console.log(`   SQL: ${checkSql} | Params: [ ${semNum}, ${deptId}, "${year}" ]`);

    const existing = await db.query(checkSql, [semNum, deptId, year]);
    if (existing.rows.length > 0) {
      console.warn(`⚠️ [Semester Validation] Duplicate found: Semester ${semNum} already configured for this department & academic year (ID=${existing.rows[0].id})`);
      return res.status(400).json({ 
        error: `Semester ${semNum} is already configured for this department in ${year}.`,
        field: 'number'
      });
    }
    console.log(`✅ [Semester Validation] Semester #${semNum} is available.`);

    const insertSql = `
      INSERT INTO semester (number, department_id, class_room, academic_year)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    console.log(`📝 [Semester Insert] Executing insert for Semester ${semNum} (Room: ${room})`);

    const result = await db.query(insertSql, [semNum, deptId, room, year]);
    console.log(`🎉 [Semester Insert] Successfully created semester ID=${result.rows[0].id}`);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ [Semester Insert Error]:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      constraint: err.constraint
    });

    if (err.code === '23505') {
      return res.status(400).json({ error: 'Semester already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
}

async function updateSemester(req, res) {
  try {
    const { number, department_id, class_room, academic_year } = req.body;
    const { id } = req.params;

    const semNum = parseInt(number, 10);
    const deptId = parseInt(department_id, 10);
    const year = academic_year.trim();
    const room = class_room.trim();

    console.log(`\n🔍 [Semester Update Validation] Checking semester #${semNum} for ID != ${id}`);
    const checkSql = 'SELECT id FROM semester WHERE number = $1 AND department_id = $2 AND academic_year = $3 AND id != $4';
    const existing = await db.query(checkSql, [semNum, deptId, year, id]);
    if (existing.rows.length > 0) {
      console.warn(`⚠️ [Semester Update] Semester ${semNum} already exists on another record`);
      return res.status(400).json({ error: `Semester ${semNum} already exists for this department in ${year}.` });
    }

    const updateSql = `
      UPDATE semester
      SET number = $1, department_id = $2, class_room = $3, academic_year = $4
      WHERE id = $5
      RETURNING *
    `;
    const result = await db.query(updateSql, [semNum, deptId, room, year, id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Semester not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ [Semester Update Error]:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Semester configuration already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
}

async function deleteSemester(req, res) {
  try {
    const result = await db.query('DELETE FROM semester WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Semester not found' });
    console.log(`🗑️ [Semester Delete] Deleted semester ID=${result.rows[0].id} (S${result.rows[0].number})`);
    res.json({ message: 'Semester deleted successfully', deleted: result.rows[0] });
  } catch (err) {
    console.error('❌ [Semester Delete Error]:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getAllSemesters,
  getSemesterById,
  createSemester,
  updateSemester,
  deleteSemester
};
