const db = require('../config/db');

async function getAllDepartments(req, res) {
  try {
    const result = await db.query('SELECT * FROM department ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('[Department] Error fetching departments:', err);
    res.status(500).json({ error: err.message });
  }
}

async function getDepartmentById(req, res) {
  try {
    const result = await db.query('SELECT * FROM department WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Department not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Department] Error fetching department by ID:', err);
    res.status(500).json({ error: err.message });
  }
}

async function createDepartment(req, res) {
  try {
    const { name, code } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Department name is required' });

    const trimmedName = name.trim();
    // Derive default code if not supplied: e.g. "Mechanical Engineering" -> "ME"
    const derivedCode = (code && code.trim())
      ? code.trim().toUpperCase()
      : trimmedName.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 10);

    // Step 1: Pre-validate uniqueness
    const checkSql = 'SELECT id, name, code FROM department WHERE LOWER(name) = LOWER($1) OR (code IS NOT NULL AND LOWER(code) = LOWER($2))';
    const existing = await db.query(checkSql, [trimmedName, derivedCode]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ 
        error: `Department "${existing.rows[0].name}" or code [${existing.rows[0].code}] already exists.`,
        field: 'name'
      });
    }

    const insertSql = 'INSERT INTO department (name, code) VALUES ($1, $2) RETURNING *';
    const result = await db.query(insertSql, [trimmedName, derivedCode]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ [Department Insert Error]:', err);

    if (err.code === '23505') {
      // If sequence was out of sync (pkey collision), compute next available ID and insert
      if (err.detail && (err.detail.includes('pkey') || err.detail.includes('(id)='))) {
        try {
          const maxRes = await db.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM department');
          const nextId = maxRes.rows[0].next_id;
          const fallbackRes = await db.query('INSERT INTO department (id, name, code) VALUES ($1, $2, $3) RETURNING *', [nextId, trimmedName, derivedCode]);
          return res.status(201).json(fallbackRes.rows[0]);
        } catch (retryErr) {
          return res.status(500).json({ error: retryErr.message });
        }
      }
      return res.status(400).json({ error: `Department "${trimmedName}" or code already exists.` });
    }
    res.status(500).json({ error: err.message });
  }
}

async function updateDepartment(req, res) {
  try {
    const { name, code } = req.body;
    const { id } = req.params;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Department name is required' });

    const trimmedName = name.trim();
    const derivedCode = (code && code.trim())
      ? code.trim().toUpperCase()
      : trimmedName.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 10);

    // Check duplicate on other records
    const checkSql = 'SELECT id, name, code FROM department WHERE (LOWER(name) = LOWER($1) OR (code IS NOT NULL AND LOWER(code) = LOWER($2))) AND id != $3';
    const existing = await db.query(checkSql, [trimmedName, derivedCode, id]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: `Department name "${existing.rows[0].name}" or code [${existing.rows[0].code}] already in use.` });
    }

    const updateSql = 'UPDATE department SET name = $1, code = $2 WHERE id = $3 RETURNING *';
    const result = await db.query(updateSql, [trimmedName, derivedCode, id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Department not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ [Department Update Error]:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Department name or code already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
}

async function deleteDepartment(req, res) {
  try {
    const result = await db.query('DELETE FROM department WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Department not found' });
    console.log(`🗑️ [Department Delete] Deleted department ID=${result.rows[0].id} (${result.rows[0].name})`);
    res.json({ message: 'Department deleted successfully', deleted: result.rows[0] });
  } catch (err) {
    console.error('❌ [Department Delete Error]:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};
