const db = require('../config/db');
const { sanitizeText, sanitizeCode } = require('../utils/sanitize');

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
    let { subject_code } = req.body;
    const userDeptId = req.user?.department_id;

    if (!name || !semester_id || !weekly_hours) {
      return res.status(400).json({ error: 'name, semester_id, and weekly_hours are required' });
    }

    // Tenant check: verify target semester belongs to admin's department
    if (userDeptId) {
      const semCheck = await db.query('SELECT department_id FROM semester WHERE id = $1', [semester_id]);
      if (semCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Semester not found' });
      }
      if (String(semCheck.rows[0].department_id) !== String(userDeptId)) {
        return res.status(403).json({ error: 'Access denied: Cannot add subject to another department semester' });
      }
    }

    // For academic subjects, faculty is required
    if (!is_generic_activity && !faculty_id) {
      return res.status(400).json({ error: 'faculty_id is required for academic subjects' });
    }

    // For generic activities, auto-generate a subject code if none provided
    if (is_generic_activity && (!subject_code || !subject_code.trim())) {
      const slug = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      subject_code = `ACT-${slug || 'GEN'}`;
    }

    const trimmedCode = sanitizeCode(subject_code, 20);
    const sanitizedName = sanitizeText(name, 100);

    if (!trimmedCode || !sanitizedName) {
      return res.status(400).json({ error: 'Valid subject code and name are required' });
    }

    // Step 1: Check for duplicate subject_code within the same semester
    console.log(`\n🔍 [Subject Validation] Checking uniqueness for subject_code: "${trimmedCode}" in semester ${semester_id}`);
    const checkSql = 'SELECT id, subject_code, name FROM subject WHERE subject_code = $1 AND semester_id = $2';
    const existing = await db.query(checkSql, [trimmedCode, semester_id]);
    if (existing.rows.length > 0) {
      console.warn(`⚠️ [Subject Validation] Duplicate found in semester: ID=${existing.rows[0].id}, Name="${existing.rows[0].name}"`);
      return res.status(400).json({ 
        error: `Subject code "${trimmedCode}" is already in use in this semester by "${existing.rows[0].name}".`,
        field: 'subject_code'
      });
    }

    const effectiveFacultyId = is_generic_activity ? null : (faculty_id || null);

    const insertSql = `
      INSERT INTO subject (subject_code, name, semester_id, faculty_id, weekly_hours, is_lab, is_parallel_activity, is_generic_activity, block_session_hours, block_session_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const result = await db.query(insertSql, [
      trimmedCode, 
      sanitizedName, 
      semester_id, 
      effectiveFacultyId, 
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
    console.error('❌ [Subject Insert Error]:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Subject code already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
}

async function updateSubject(req, res) {
  try {
    const { 
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
    let { subject_code } = req.body;
    const { id } = req.params;
    const userDeptId = req.user?.department_id;

    // Tenant check: verify existing subject belongs to user's department
    if (userDeptId) {
      const existingSubCheck = await db.query(`
        SELECT sub.id, sem.department_id 
        FROM subject sub
        JOIN semester sem ON sub.semester_id = sem.id
        WHERE sub.id = $1
      `, [id]);
      if (existingSubCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Subject not found' });
      }
      if (String(existingSubCheck.rows[0].department_id) !== String(userDeptId)) {
        return res.status(403).json({ error: 'Access denied: Cannot edit subject in another department' });
      }
      // If moving to another semester, verify that semester is also in department
      if (semester_id) {
        const targetSemCheck = await db.query('SELECT department_id FROM semester WHERE id = $1', [semester_id]);
        if (targetSemCheck.rows.length === 0 || String(targetSemCheck.rows[0].department_id) !== String(userDeptId)) {
          return res.status(403).json({ error: 'Access denied: Target semester is in another department' });
        }
      }
    }

    // For generic activities, auto-generate a code if none provided
    if (is_generic_activity && (!subject_code || !subject_code.trim())) {
      const slug = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      subject_code = `ACT-${slug || 'GEN'}`;
    }

    const trimmedCode = sanitizeCode(subject_code, 20);
    const sanitizedName = sanitizeText(name, 100);

    // Check if code is taken by another subject in the same semester
    console.log(`\n🔍 [Subject Update Validation] Checking code "${trimmedCode}" for semester ${semester_id} and ID != ${id}`);
    const checkSql = 'SELECT id, name FROM subject WHERE subject_code = $1 AND semester_id = $2 AND id != $3';
    const existing = await db.query(checkSql, [trimmedCode, semester_id, id]);
    if (existing.rows.length > 0) {
      console.warn(`⚠️ [Subject Update] Code "${trimmedCode}" already used in this semester by "${existing.rows[0].name}"`);
      return res.status(400).json({ error: `Subject code "${trimmedCode}" is already in use in this semester by "${existing.rows[0].name}".` });
    }

    const effectiveFacultyId = is_generic_activity ? null : (faculty_id || null);

    const updateSql = `
      UPDATE subject
      SET subject_code = $1, name = $2, semester_id = $3, faculty_id = $4, weekly_hours = $5, is_lab = $6, is_parallel_activity = $7, is_generic_activity = $8, block_session_hours = $9, block_session_count = $10
      WHERE id = $11
      RETURNING *
    `;
    const result = await db.query(updateSql, [
      trimmedCode, 
      sanitizedName, 
      semester_id, 
      effectiveFacultyId, 
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
    const { id } = req.params;
    const userDeptId = req.user?.department_id;

    if (userDeptId) {
      const existingSubCheck = await db.query(`
        SELECT sub.id, sem.department_id 
        FROM subject sub
        JOIN semester sem ON sub.semester_id = sem.id
        WHERE sub.id = $1
      `, [id]);
      if (existingSubCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Subject not found' });
      }
      if (String(existingSubCheck.rows[0].department_id) !== String(userDeptId)) {
        return res.status(403).json({ error: 'Access denied: Cannot delete subject in another department' });
      }
    }

    const result = await db.query('DELETE FROM subject WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Subject not found' });
    res.json({ message: 'Subject deleted successfully', deleted: result.rows[0] });
  } catch (err) {
    console.error('❌ [Subject Delete Error]:', err);
    res.status(500).json({ error: err.message });
  }
}

async function deleteAllSubjects(req, res) {
  try {
    const department_id = req.user?.department_id || req.query.department_id || req.body.department_id;
    if (!department_id) {
      return res.status(400).json({ error: 'department_id is required for scoped subject deletion' });
    }

    const result = await db.query(
      'DELETE FROM subject WHERE semester_id IN (SELECT id FROM semester WHERE department_id = $1) RETURNING id',
      [department_id]
    );
    const count = result.rows.length;
    res.json({ message: `Successfully deleted ${count} subjects`, count });
  } catch (err) {
    console.error('❌ [Subject Delete All Error]:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getAllSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
  deleteAllSubjects
};
