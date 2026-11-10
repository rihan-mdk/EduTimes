const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { sanitizeText, sanitizeCode, validatePassword } = require('../utils/sanitize');

async function getAllFaculty(req, res) {
  try {
    const { department_id } = req.query;
    let query = `
      SELECT f.id, f.faculty_code, f.name, f.role, f.department_id, d.name as department_name, d.code as department_code
      FROM faculty f
      LEFT JOIN department d ON f.department_id = d.id
    `;
    const params = [];
    if (department_id) {
      params.push(department_id);
      query += ` WHERE f.department_id = $${params.length}`;
    }
    query += ` ORDER BY f.id ASC`;

    const result = await db.query(query, params);
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
    const { faculty_code, name, password, role = 'faculty' } = req.body;
    const department_id = req.user?.department_id || req.body.department_id;
    if (!faculty_code || !name || !password || !department_id) {
      return res.status(400).json({ error: 'faculty_code, name, password, and department_id are required' });
    }

    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      return res.status(400).json({ error: pwdCheck.error });
    }

    const trimmedCode = sanitizeCode(faculty_code, 20);
    const sanitizedName = sanitizeText(name, 100);

    if (!trimmedCode || !sanitizedName) {
      return res.status(400).json({ error: 'Valid faculty code and name are required.' });
    }

    // Step 1: Check for duplicate faculty_code — join department for context
    console.log(`\n🔍 [Faculty Validation] Checking uniqueness for faculty_code: "${trimmedCode}"`);
    const checkSql = `
      SELECT f.id, f.faculty_code, f.name, f.department_id,
             d.name AS department_name, d.code AS department_code
      FROM faculty f
      LEFT JOIN department d ON f.department_id = d.id
      WHERE f.faculty_code = $1
    `;
    console.log(`   SQL: (faculty + dept join) | Params: [ "${trimmedCode}" ]`);

    const existing = await db.query(checkSql, [trimmedCode]);
    if (existing.rows.length > 0) {
      const found = existing.rows[0];
      const isSameDept = String(found.department_id) === String(department_id);

      if (isSameDept) {
        // Genuine duplicate within the same department → hard error
        console.warn(`⚠️ [Faculty Validation] Same-dept duplicate: ID=${found.id}, Name="${found.name}"`);
        return res.status(400).json({
          error: `Faculty code "${trimmedCode}" is already in use by ${found.name} in this department.`,
          field: 'faculty_code'
        });
      } else {
        // Cross-department clash → soft 409, let the UI ask the user
        console.warn(`ℹ️ [Faculty Validation] Cross-dept code: ID=${found.id}, Name="${found.name}", Dept="${found.department_name}"`);
        return res.status(409).json({
          conflict: true,
          message: `Faculty code "${trimmedCode}" is already registered in another department.`,
          existing: {
            id: found.id,
            name: found.name,
            department_name: found.department_name || 'Unknown Department',
            department_code: found.department_code || '',
          }
        });
      }
    }
    console.log(`✅ [Faculty Validation] faculty_code "${trimmedCode}" is unique and available.`);

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const insertSql = `
      INSERT INTO faculty (faculty_code, name, password_hash, role, department_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, faculty_code, name, role, department_id
    `;
    console.log(`📝 [Faculty Insert] Executing insert for "${sanitizedName}" (${trimmedCode})`);
    
    const result = await db.query(insertSql, [trimmedCode, sanitizedName, password_hash, role, department_id]);

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
    const { faculty_code, name, password, role } = req.body;
    const { id } = req.params;
    const userDeptId = req.user?.department_id;

    // Check target faculty existence and tenant ownership
    const targetCheck = await db.query('SELECT id, department_id, name FROM faculty WHERE id = $1', [id]);
    if (targetCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Faculty not found' });
    }
    const target = targetCheck.rows[0];

    // Enforce tenant isolation: admins can only modify faculty in their own department
    if (userDeptId && String(target.department_id) !== String(userDeptId)) {
      return res.status(403).json({ error: 'Access denied: Cannot modify faculty in another department' });
    }

    const trimmedCode = sanitizeCode(faculty_code, 20);
    const sanitizedName = sanitizeText(name, 100);

    if (!trimmedCode || !sanitizedName) {
      return res.status(400).json({ error: 'Valid faculty code and name are required.' });
    }

    // Check if code is taken by another faculty member
    console.log(`\n🔍 [Faculty Update Validation] Checking code "${trimmedCode}" for ID != ${id}`);
    const checkSql = 'SELECT id, name FROM faculty WHERE faculty_code = $1 AND id != $2';
    const existing = await db.query(checkSql, [trimmedCode, id]);
    if (existing.rows.length > 0) {
      console.warn(`⚠️ [Faculty Update] Code "${trimmedCode}" already used by ${existing.rows[0].name}`);
      return res.status(400).json({ error: `Faculty code "${trimmedCode}" already in use by ${existing.rows[0].name}.` });
    }

    const deptIdToUse = userDeptId || target.department_id;
    let query = '';
    let params = [];

    if (password && password.trim().length > 0) {
      const pwdCheck = validatePassword(password);
      if (!pwdCheck.valid) {
        return res.status(400).json({ error: pwdCheck.error });
      }
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      query = `
        UPDATE faculty
        SET faculty_code = $1, name = $2, password_hash = $3, role = $4, department_id = $5
        WHERE id = $6
        RETURNING id, faculty_code, name, role, department_id
      `;
      params = [trimmedCode, sanitizedName, password_hash, role || 'faculty', deptIdToUse, id];
    } else {
      query = `
        UPDATE faculty
        SET faculty_code = $1, name = $2, role = $3, department_id = $4
        WHERE id = $5
        RETURNING id, faculty_code, name, role, department_id
      `;
      params = [trimmedCode, sanitizedName, role || 'faculty', deptIdToUse, id];
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
    const { id } = req.params;
    const currentUserId = req.user?.id;
    const userDeptId = req.user?.department_id;

    if (currentUserId && String(currentUserId) === String(id)) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    // Verify tenant ownership before deleting
    const targetCheck = await db.query('SELECT id, department_id, name FROM faculty WHERE id = $1', [id]);
    if (targetCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Faculty not found' });
    }

    if (userDeptId && String(targetCheck.rows[0].department_id) !== String(userDeptId)) {
      return res.status(403).json({ error: 'Access denied: Cannot delete faculty in another department' });
    }

    const result = await db.query('DELETE FROM faculty WHERE id = $1 RETURNING id, faculty_code, name', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Faculty not found' });
    res.json({ message: 'Faculty deleted successfully', deleted: result.rows[0] });
  } catch (err) {
    console.error('❌ [Faculty Delete Error]:', err);
    res.status(500).json({ error: err.message });
  }
}

async function deleteAllFaculty(req, res) {
  try {
    // Strictly isolate by authenticated user's department
    const department_id = req.user?.department_id || req.query.department_id || req.body.department_id;
    const currentUserId = req.user?.id;

    if (!department_id) {
      return res.status(400).json({ error: 'department_id is required' });
    }

    // 1. Delete dependent subjects for this department to satisfy foreign key (faculty_id RESTRICT)
    await db.query(
      'DELETE FROM subject WHERE semester_id IN (SELECT id FROM semester WHERE department_id = $1)',
      [department_id]
    );

    // 2. Delete non-admin faculty strictly in this department, preserving the current admin
    let result;
    if (currentUserId) {
      result = await db.query(
        "DELETE FROM faculty WHERE department_id = $1 AND role != 'admin' AND id != $2 RETURNING id, faculty_code, name",
        [department_id, currentUserId]
      );
    } else {
      result = await db.query(
        "DELETE FROM faculty WHERE department_id = $1 AND role != 'admin' RETURNING id, faculty_code, name",
        [department_id]
      );
    }

    const count = result.rows.length;
    res.json({ message: `Successfully deleted ${count} faculty members`, count, deleted: result.rows });
  } catch (err) {
    console.error('❌ [Faculty Delete All Error]:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getAllFaculty,
  getFacultyById,
  createFaculty,
  updateFaculty,
  deleteFaculty,
  deleteAllFaculty
};
