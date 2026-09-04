const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function getAllFaculty(req, res) {
  try {
    const result = await db.query(`
      SELECT f.id, f.faculty_code, f.name, f.role, f.department_id, d.name as department_name
      FROM faculty f
      LEFT JOIN department d ON f.department_id = d.id
      ORDER BY f.id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[Faculty] Error fetching all faculty:', err);
    res.status(500).json({ error: err.message });
  }
}

async function getFacultyById(req, res) {
  try {
    const result = await db.query(`
      SELECT f.id, f.faculty_code, f.name, f.role, f.department_id, d.name as department_name
      FROM faculty f
      LEFT JOIN department d ON f.department_id = d.id
      WHERE f.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Faculty not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Faculty] Error fetching faculty by ID:', err);
    res.status(500).json({ error: err.message });
  }
}

async function createFaculty(req, res) {
  try {
    const { faculty_code, name, password, role = 'faculty', department_id } = req.body;
    if (!faculty_code || !name || !password || !department_id) {
      return res.status(400).json({ error: 'faculty_code, name, password, and department_id are required' });
    }

    const trimmedCode = faculty_code.trim();

    // Step 1: Explicitly check for duplicate faculty_code with query logging
    console.log(`\n🔍 [Faculty Validation] Checking uniqueness for faculty_code: "${trimmedCode}"`);
    const checkSql = 'SELECT id, faculty_code, name FROM faculty WHERE faculty_code = $1';
    console.log(`   SQL: ${checkSql} | Params: [ "${trimmedCode}" ]`);
    
    const existing = await db.query(checkSql, [trimmedCode]);
    if (existing.rows.length > 0) {
      console.warn(`⚠️ [Faculty Validation] Duplicate found: ID=${existing.rows[0].id}, Name="${existing.rows[0].name}"`);
      return res.status(400).json({ 
        error: `Faculty code "${trimmedCode}" is already in use by ${existing.rows[0].name}.`,
        field: 'faculty_code'
      });
    }
    console.log(`✅ [Faculty Validation] faculty_code "${trimmedCode}" is unique and available.`);

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const insertSql = `
      INSERT INTO faculty (faculty_code, name, password_hash, role, department_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, faculty_code, name, role, department_id
    `;
    console.log(`📝 [Faculty Insert] Executing insert for "${name.trim()}" (${trimmedCode})`);
    
    const result = await db.query(insertSql, [trimmedCode, name.trim(), password_hash, role, department_id]);

    console.log(`🎉 [Faculty Insert] Successfully created faculty ID=${result.rows[0].id}`);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ [Faculty Insert Error]:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      constraint: err.constraint
    });

    if (err.code === '23505') {
      if (err.constraint && err.constraint.includes('faculty_code')) {
        return res.status(400).json({ error: `Faculty code already exists.` });
      }
      return res.status(400).json({ error: `Unique constraint violation (${err.constraint || 'primary key / code collision'}).` });
    }
    res.status(500).json({ error: err.message });
  }
}

async function updateFaculty(req, res) {
  try {
    const { faculty_code, name, password, role, department_id } = req.body;
    const { id } = req.params;
    const trimmedCode = faculty_code.trim();

    // Check if code is taken by another faculty member
    console.log(`\n🔍 [Faculty Update Validation] Checking code "${trimmedCode}" for ID != ${id}`);
    const checkSql = 'SELECT id, name FROM faculty WHERE faculty_code = $1 AND id != $2';
    const existing = await db.query(checkSql, [trimmedCode, id]);
    if (existing.rows.length > 0) {
      console.warn(`⚠️ [Faculty Update] Code "${trimmedCode}" already used by ${existing.rows[0].name}`);
      return res.status(400).json({ error: `Faculty code "${trimmedCode}" already in use by ${existing.rows[0].name}.` });
    }

    let query = '';
    let params = [];

    if (password && password.trim().length > 0) {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      query = `
        UPDATE faculty
        SET faculty_code = $1, name = $2, password_hash = $3, role = $4, department_id = $5
        WHERE id = $6
        RETURNING id, faculty_code, name, role, department_id
      `;
      params = [trimmedCode, name.trim(), password_hash, role || 'faculty', department_id, id];
    } else {
      query = `
        UPDATE faculty
        SET faculty_code = $1, name = $2, role = $3, department_id = $4
        WHERE id = $5
        RETURNING id, faculty_code, name, role, department_id
      `;
      params = [trimmedCode, name.trim(), role || 'faculty', department_id, id];
    }

    const result = await db.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Faculty not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ [Faculty Update Error]:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Faculty code already in use.' });
    }
    res.status(500).json({ error: err.message });
  }
}

async function deleteFaculty(req, res) {
  try {
    const result = await db.query('DELETE FROM faculty WHERE id = $1 RETURNING id, faculty_code, name', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Faculty not found' });
    res.json({ message: 'Faculty deleted successfully', deleted: result.rows[0] });
  } catch (err) {
    console.error('❌ [Faculty Delete Error]:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getAllFaculty,
  getFacultyById,
  createFaculty,
  updateFaculty,
  deleteFaculty
};
