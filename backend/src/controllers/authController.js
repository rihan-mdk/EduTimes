const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'yensync_super_secret_jwt_key_2026_department';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// ---------------------------------------------------------------
// POST /api/auth/check-department
// Public — checks if a department code exists
// Returns: { exists: true, id, name, code } | { exists: false }
// ---------------------------------------------------------------
async function checkDepartment(req, res) {
  try {
    const { department_code } = req.body;
    if (!department_code || !department_code.trim()) {
      return res.status(400).json({ error: 'Department code is required.' });
    }

    const result = await db.query(
      `SELECT id, name, code FROM department WHERE LOWER(code) = LOWER($1)`,
      [department_code.trim()]
    );

    if (result.rows.length === 0) {
      return res.json({ exists: false });
    }

    const dept = result.rows[0];
    return res.json({ exists: true, id: dept.id, name: dept.name, code: dept.code });
  } catch (err) {
    console.error('[Auth] checkDepartment error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ---------------------------------------------------------------
// POST /api/auth/setup-department
// Public — creates a new department + first admin account, returns JWT
// Body: { department_name, department_code, faculty_code, admin_name, password }
// ---------------------------------------------------------------
async function setupDepartment(req, res) {
  try {
    const { department_name, department_code, faculty_code, admin_name, password } = req.body;

    if (!department_name || !department_code || !faculty_code || !admin_name || !password) {
      return res.status(400).json({
        error: 'All fields are required: department_name, department_code, faculty_code, admin_name, password.'
      });
    }

    const trimmedCode = department_code.trim().toUpperCase();
    const trimmedFacultyCode = faculty_code.trim();

    // Check dept code not already taken
    const deptCheck = await db.query(
      `SELECT id FROM department WHERE LOWER(code) = LOWER($1)`,
      [trimmedCode]
    );
    if (deptCheck.rows.length > 0) {
      return res.status(400).json({ error: `Department code "${trimmedCode}" already exists.` });
    }

    // Check faculty_code not already taken globally
    const facCheck = await db.query(
      `SELECT id FROM faculty WHERE faculty_code = $1`,
      [trimmedFacultyCode]
    );
    if (facCheck.rows.length > 0) {
      return res.status(400).json({ error: `Faculty code "${trimmedFacultyCode}" is already in use.` });
    }

    // 1. Create the department
    const deptResult = await db.query(
      `INSERT INTO department (name, code) VALUES ($1, $2) RETURNING id, name, code`,
      [department_name.trim(), trimmedCode]
    );
    const newDept = deptResult.rows[0];

    // 2. Create the first admin account
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const facResult = await db.query(
      `INSERT INTO faculty (faculty_code, name, password_hash, role, department_id)
       VALUES ($1, $2, $3, 'admin', $4)
       RETURNING id, faculty_code, name, role, department_id`,
      [trimmedFacultyCode, admin_name.trim(), password_hash, newDept.id]
    );
    const newAdmin = facResult.rows[0];

    // 3. Sign JWT and return
    const payload = {
      id: newAdmin.id,
      faculty_code: newAdmin.faculty_code,
      name: newAdmin.name,
      role: newAdmin.role,
      department_id: newDept.id,
      department_name: newDept.name,
      department_code: newDept.code,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    console.log(`🏛️ [Setup] New department "${newDept.name}" (${newDept.code}) created with admin "${newAdmin.name}" (${newAdmin.faculty_code})`);

    return res.status(201).json({
      message: `Department "${newDept.name}" created successfully!`,
      token,
      user: payload,
    });
  } catch (err) {
    console.error('[Auth] setupDepartment error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ---------------------------------------------------------------
// POST /api/auth/login
// Credentials: faculty_code + password + department_code (required)
// ---------------------------------------------------------------
async function login(req, res) {
  try {
    const { faculty_code, password, department_id, department_code } = req.body;

    if (!faculty_code || !password) {
      return res.status(400).json({ error: 'Faculty code and password are required.' });
    }

    const query = `
      SELECT f.id, f.faculty_code, f.name, f.password_hash, f.role, f.department_id, 
             d.name as department_name, d.code as department_code
      FROM faculty f
      LEFT JOIN department d ON f.department_id = d.id
      WHERE f.faculty_code = $1
    `;
    const result = await db.query(query, [faculty_code.trim()]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid faculty code or password.' });
    }

    const faculty = result.rows[0];
    const isMatch = await bcrypt.compare(password, faculty.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid faculty code or password.' });
    }

    // Verify department if explicitly specified during login
    if (department_id && String(faculty.department_id) !== String(department_id)) {
      return res.status(401).json({
        error: `Account ${faculty.faculty_code} (${faculty.name}) belongs to "${faculty.department_name || 'another department'}", not the selected department.`
      });
    }

    if (department_code && faculty.department_code &&
        faculty.department_code.toLowerCase() !== department_code.toLowerCase().trim()) {
      return res.status(401).json({
        error: `Account ${faculty.faculty_code} (${faculty.name}) belongs to "${faculty.department_name || 'another department'}", not department [${department_code.toUpperCase()}].`
      });
    }

    const payload = {
      id: faculty.id,
      faculty_code: faculty.faculty_code,
      name: faculty.name,
      role: faculty.role,
      department_id: faculty.department_id,
      department_name: faculty.department_name,
      department_code: faculty.department_code || ''
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return res.json({
      message: 'Login successful',
      token,
      user: payload
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
}

async function getMe(req, res) {
  try {
    const query = `
      SELECT f.id, f.faculty_code, f.name, f.role, f.department_id, 
             d.name as department_name, d.code as department_code
      FROM faculty f
      LEFT JOIN department d ON f.department_id = d.id
      WHERE f.id = $1
    `;
    const result = await db.query(query, [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const { name, faculty_code, current_password, new_password } = req.body;

    // 1. Fetch current faculty record
    const userQuery = `
      SELECT f.id, f.faculty_code, f.name, f.password_hash, f.role, f.department_id,
             d.name as department_name, d.code as department_code
      FROM faculty f
      LEFT JOIN department d ON f.department_id = d.id
      WHERE f.id = $1
    `;
    const userResult = await db.query(userQuery, [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const currentUser = userResult.rows[0];

    // 2. If password update requested, verify current password
    let updatedPasswordHash = currentUser.password_hash;
    if (new_password) {
      if (!current_password) {
        return res.status(400).json({ error: 'Current password is required to set a new password.' });
      }
      if (new_password.length < 4) {
        return res.status(400).json({ error: 'New password must be at least 4 characters long.' });
      }
      const isMatch = await bcrypt.compare(current_password, currentUser.password_hash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Incorrect current password.' });
      }
      const salt = await bcrypt.genSalt(10);
      updatedPasswordHash = await bcrypt.hash(new_password, salt);
    }

    // 3. If faculty_code is being changed, check uniqueness
    let updatedFacultyCode = currentUser.faculty_code;
    if (faculty_code && faculty_code.trim()) {
      const trimmedCode = faculty_code.trim();
      if (trimmedCode.toLowerCase() !== currentUser.faculty_code.toLowerCase()) {
        const codeCheck = await db.query(
          `SELECT id FROM faculty WHERE LOWER(faculty_code) = LOWER($1) AND id != $2`,
          [trimmedCode, userId]
        );
        if (codeCheck.rows.length > 0) {
          return res.status(400).json({ error: `Faculty code "${trimmedCode}" is already in use by another faculty member.` });
        }
        updatedFacultyCode = trimmedCode;
      }
    }

    // 4. If name changed
    const updatedName = name && name.trim() ? name.trim() : currentUser.name;

    // 5. Update database record
    await db.query(
      `UPDATE faculty 
       SET faculty_code = $1, name = $2, password_hash = $3 
       WHERE id = $4`,
      [updatedFacultyCode, updatedName, updatedPasswordHash, userId]
    );

    // 6. Sign fresh JWT payload
    const payload = {
      id: currentUser.id,
      faculty_code: updatedFacultyCode,
      name: updatedName,
      role: currentUser.role,
      department_id: currentUser.department_id,
      department_name: currentUser.department_name,
      department_code: currentUser.department_code || ''
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return res.json({
      message: 'Profile updated successfully!',
      user: payload,
      token
    });
  } catch (error) {
    console.error('[Auth] updateProfile error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error while updating profile.' });
  }
}

module.exports = {
  checkDepartment,
  setupDepartment,
  login,
  getMe,
  updateProfile
};
