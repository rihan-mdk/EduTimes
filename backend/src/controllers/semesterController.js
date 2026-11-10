const db = require('../config/db');
const { sanitizeText } = require('../utils/sanitize');

async function getAllSemesters(req, res) {
  try {
    const department_id = req.query.department_id;
    let query = `
      SELECT s.*, d.name as department_name, d.code as department_code
      FROM semester s
      LEFT JOIN department d ON s.department_id = d.id
    `;
    const params = [];
    if (department_id) {
      params.push(department_id);
      query += ` WHERE s.department_id = $${params.length}`;
    }
    query += ` ORDER BY s.number ASC`;

    const result = await db.query(query, params);
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
    const { number, class_room, academic_year, class_advisor, mentors } = req.body;
    // Derive department_id strictly from authenticated user if available
    const department_id = req.user?.department_id || req.body.department_id;
    
    if (!number || !department_id || !class_room || !academic_year) {
      return res.status(400).json({ error: 'number, department_id, class_room, and academic_year are required' });
    }

    const semNum = parseInt(number, 10);
    const deptId = parseInt(department_id, 10);
    const year = sanitizeText(academic_year, 20);
    const room = sanitizeText(class_room, 50);
    const advisor = class_advisor ? sanitizeText(class_advisor, 100) : null;
    const mentorsList = mentors ? sanitizeText(mentors, 255) : null;

    // Step 1: Pre-validate duplicate semester number in the same department & academic year
    console.log(`\n🔍 [Semester Validation] Checking semester #${semNum} for Department #${deptId} (${year})`);
    const checkSql = 'SELECT id, number FROM semester WHERE number = $1 AND department_id = $2 AND academic_year = $3';
    const existing = await db.query(checkSql, [semNum, deptId, year]);
    if (existing.rows.length > 0) {
      console.warn(`⚠️ [Semester Validation] Duplicate found: Semester ${semNum} already configured for this department & academic year (ID=${existing.rows[0].id})`);
      return res.status(400).json({ 
        error: `Semester ${semNum} is already configured for this department in ${year}.`,
        field: 'number'
      });
    }

    const insertSql = `
      INSERT INTO semester (number, department_id, class_room, academic_year, class_advisor, mentors)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await db.query(insertSql, [semNum, deptId, room, year, advisor, mentorsList]);
    console.log(`🎉 [Semester Insert] Successfully created semester ID=${result.rows[0].id}`);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ [Semester Insert Error]:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Semester already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
}

async function updateSemester(req, res) {
  try {
    const { number, class_room, academic_year, class_advisor, mentors } = req.body;
    const { id } = req.params;
    const userDeptId = req.user?.department_id;

    // Check target semester existence and tenant ownership
    const targetCheck = await db.query('SELECT id, department_id FROM semester WHERE id = $1', [id]);
    if (targetCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Semester not found' });
    }
    const target = targetCheck.rows[0];

    if (userDeptId && String(target.department_id) !== String(userDeptId)) {
      return res.status(403).json({ error: 'Access denied: Cannot modify semester in another department' });
    }

    const semNum = parseInt(number, 10);
    const deptId = userDeptId || parseInt(req.body.department_id || target.department_id, 10);
    const year = sanitizeText(academic_year, 20);
    const room = sanitizeText(class_room, 50);
    const advisor = class_advisor !== undefined ? (class_advisor ? sanitizeText(class_advisor, 100) : null) : null;
    const mentorsList = mentors !== undefined ? (mentors ? sanitizeText(mentors, 255) : null) : null;

    console.log(`\n🔍 [Semester Update Validation] Checking semester #${semNum} for ID != ${id}`);
    const checkSql = 'SELECT id FROM semester WHERE number = $1 AND department_id = $2 AND academic_year = $3 AND id != $4';
    const existing = await db.query(checkSql, [semNum, deptId, year, id]);
    if (existing.rows.length > 0) {
      console.warn(`⚠️ [Semester Update] Semester ${semNum} already exists on another record`);
      return res.status(400).json({ error: `Semester ${semNum} already exists for this department in ${year}.` });
    }

    const updateSql = `
      UPDATE semester
      SET number = $1, department_id = $2, class_room = $3, academic_year = $4, class_advisor = $5, mentors = $6
      WHERE id = $7
      RETURNING *
    `;
    const result = await db.query(updateSql, [semNum, deptId, room, year, advisor, mentorsList, id]);

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
    const { id } = req.params;
    const userDeptId = req.user?.department_id;

    if (userDeptId) {
      const targetCheck = await db.query('SELECT id, department_id FROM semester WHERE id = $1', [id]);
      if (targetCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Semester not found' });
      }
      if (String(targetCheck.rows[0].department_id) !== String(userDeptId)) {
        return res.status(403).json({ error: 'Access denied: Cannot delete semester in another department' });
      }
    }

    const result = await db.query('DELETE FROM semester WHERE id = $1 RETURNING *', [id]);
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
