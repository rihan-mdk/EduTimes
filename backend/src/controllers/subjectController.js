const db = require('../config/db');

async function getAllSubjects(req, res) {
  try {
    const { department_id } = req.query;
    let query = `
      SELECT sub.*, 
             sem.number as semester_number, 
             sem.class_room, 
             sem.department_id,
             d.name as department_name,
             d.code as department_code,
             f.name as faculty_name, 
             f.faculty_code
      FROM subject sub
      LEFT JOIN semester sem ON sub.semester_id = sem.id
      LEFT JOIN department d ON sem.department_id = d.id
      LEFT JOIN faculty f ON sub.faculty_id = f.id
    `;
    const params = [];
    if (department_id) {
      params.push(department_id);
      query += ` WHERE sem.department_id = $${params.length}`;
    }
    query += ` ORDER BY sem.number ASC, sub.id ASC`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[Subject] Error fetching all subjects:', err);
    res.status(500).json({ error: err.message });
  }
}

async function getSubjectById(req, res) {
  try {
    const result = await db.query(`
      SELECT sub.*, 
             sem.number as semester_number, 
             sem.department_id,
             d.name as department_name,
             d.code as department_code,
             f.name as faculty_name, 
             f.faculty_code
      FROM subject sub
      LEFT JOIN semester sem ON sub.semester_id = sem.id
      LEFT JOIN department d ON sem.department_id = d.id
      LEFT JOIN faculty f ON sub.faculty_id = f.id
      WHERE sub.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Subject not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Subject] Error fetching subject by ID:', err);
    res.status(500).json({ error: err.message });
  }
}

async function createSubject(req, res) {
  try {
    const { 
      subject_code, 
      name, 
      semester_id, 
      faculty_id, 
      weekly_hours, 
      is_lab = false,
      is_parallel_activity = false,
      is_generic_activity = false,
      block_session_hours = 0,
      block_session_count = 0
    } = req.body;
    if (!subject_code || !name || !semester_id || !faculty_id || !weekly_hours) {
      return res.status(400).json({ error: 'subject_code, name, semester_id, faculty_id, and weekly_hours are required' });
    }

    const trimmedCode = subject_code.trim();

    // Step 1: Explicitly check for duplicate subject_code with query logging
    console.log(`\n🔍 [Subject Validation] Checking uniqueness for subject_code: "${trimmedCode}"`);
    const checkSql = 'SELECT id, subject_code, name FROM subject WHERE subject_code = $1';
    console.log(`   SQL: ${checkSql} | Params: [ "${trimmedCode}" ]`);

    const existing = await db.query(checkSql, [trimmedCode]);
    if (existing.rows.length > 0) {
      console.warn(`⚠️ [Subject Validation] Duplicate found: ID=${existing.rows[0].id}, Name="${existing.rows[0].name}"`);
      return res.status(400).json({ 
        error: `Subject code "${trimmedCode}" is already in use by "${existing.rows[0].name}".`,
        field: 'subject_code'
      });
    }
    console.log(`✅ [Subject Validation] subject_code "${trimmedCode}" is unique and available.`);

    const insertSql = `
      INSERT INTO subject (subject_code, name, semester_id, faculty_id, weekly_hours, is_lab, is_parallel_activity, is_generic_activity, block_session_hours, block_session_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    console.log(`📝 [Subject Insert] Executing insert for "${name.trim()}" (${trimmedCode})`);

    const result = await db.query(insertSql, [
      trimmedCode, 
      name.trim(), 
      semester_id, 
      faculty_id, 
      weekly_hours, 
      is_lab,
      is_parallel_activity,
      is_generic_activity,
      block_session_hours,
      block_session_count
    ]);

    console.log(`🎉 [Subject Insert] Successfully created subject ID=${result.rows[0].id}`);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ [Subject Insert Error]:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      constraint: err.constraint
    });

    if (err.code === '23505') {
      if (err.constraint && err.constraint.includes('subject_code')) {
        return res.status(400).json({ error: `Subject code already exists.` });
      }
      return res.status(400).json({ error: `Unique constraint violation (${err.constraint || 'primary key / code collision'}).` });
    }
    res.status(500).json({ error: err.message });
  }
}

async function updateSubject(req, res) {
  try {
    const { 
      subject_code, 
      name, 
      semester_id, 
      faculty_id, 
      weekly_hours, 
      is_lab,
      is_parallel_activity = false,
      is_generic_activity = false,
      block_session_hours = 0,
      block_session_count = 0
    } = req.body;
    const { id } = req.params;
    const trimmedCode = subject_code.trim();

    // Check if code is taken by another subject
    console.log(`\n🔍 [Subject Update Validation] Checking code "${trimmedCode}" for ID != ${id}`);
    const checkSql = 'SELECT id, name FROM subject WHERE subject_code = $1 AND id != $2';
    const existing = await db.query(checkSql, [trimmedCode, id]);
    if (existing.rows.length > 0) {
      console.warn(`⚠️ [Subject Update] Code "${trimmedCode}" already used by "${existing.rows[0].name}"`);
      return res.status(400).json({ error: `Subject code "${trimmedCode}" already in use by "${existing.rows[0].name}".` });
    }

    const updateSql = `
      UPDATE subject
      SET subject_code = $1, name = $2, semester_id = $3, faculty_id = $4, weekly_hours = $5, is_lab = $6, is_parallel_activity = $7, is_generic_activity = $8, block_session_hours = $9, block_session_count = $10
      WHERE id = $11
      RETURNING *
    `;
    const result = await db.query(updateSql, [
      trimmedCode, 
      name.trim(), 
      semester_id, 
      faculty_id, 
      weekly_hours, 
      is_lab,
      is_parallel_activity,
      is_generic_activity,
      block_session_hours,
      block_session_count,
      id
    ]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Subject not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ [Subject Update Error]:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Subject code already in use.' });
    }
    res.status(500).json({ error: err.message });
  }
}

async function deleteSubject(req, res) {
  try {
    const result = await db.query('DELETE FROM subject WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Subject not found' });
    res.json({ message: 'Subject deleted successfully', deleted: result.rows[0] });
  } catch (err) {
    console.error('❌ [Subject Delete Error]:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getAllSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject
};
