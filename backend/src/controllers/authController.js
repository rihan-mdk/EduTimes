const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'yensync_super_secret_jwt_key_2026_department';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

async function login(req, res) {
  try {
    const { faculty_code, password } = req.body;

    if (!faculty_code || !password) {
      return res.status(400).json({ error: 'Faculty code and password are required.' });
    }

    const query = `
      SELECT f.id, f.faculty_code, f.name, f.password_hash, f.role, f.department_id, d.name as department_name
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

    const payload = {
      id: faculty.id,
      faculty_code: faculty.faculty_code,
      name: faculty.name,
      role: faculty.role,
      department_id: faculty.department_id,
      department_name: faculty.department_name
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
      SELECT f.id, f.faculty_code, f.name, f.role, f.department_id, d.name as department_name
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

module.exports = {
  login,
  getMe
};
