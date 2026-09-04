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
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Department name is required' });

    const trimmedName = name.trim();

    // Step 1: Pre-validate uniqueness with query logging
    console.log(`\n🔍 [Department Validation] Checking uniqueness for department name: "${trimmedName}"`);
    const checkSql = 'SELECT id, name FROM department WHERE LOWER(name) = LOWER($1)';
    console.log(`   SQL: ${checkSql} | Params: [ "${trimmedName}" ]`);
    
    const existing = await db.query(checkSql, [trimmedName]);
    if (existing.rows.length > 0) {
      console.warn(`⚠️ [Department Validation] Duplicate found: ID=${existing.rows[0].id}, Name="${existing.rows[0].name}"`);
      return res.status(400).json({ 
        error: `Department "${existing.rows[0].name}" already exists.`,
        field: 'name'
      });
    }
    console.log(`✅ [Department Validation] Department name "${trimmedName}" is available.`);

    const insertSql = 'INSERT INTO department (name) VALUES ($1) RETURNING *';
    console.log(`📝 [Department Insert] Executing insert for "${trimmedName}"`);

    const result = await db.query(insertSql, [trimmedName]);
    console.log(`🎉 [Department Insert] Successfully created department ID=${result.rows[0].id}`);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ [Department Insert Error]:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      constraint: err.constraint
    });

    if (err.code === '23505') {
      return res.status(400).json({ error: `Department already exists.` });
    }
    res.status(500).json({ error: err.message });
  }
}

async function updateDepartment(req, res) {
  try {
    const { name } = req.body;
    const { id } = req.params;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Department name is required' });

    const trimmedName = name.trim();

    // Check duplicate on other records
    console.log(`\n🔍 [Department Update Validation] Checking name "${trimmedName}" for ID != ${id}`);
    const checkSql = 'SELECT id, name FROM department WHERE LOWER(name) = LOWER($1) AND id != $2';
    const existing = await db.query(checkSql, [trimmedName, id]);
    if (existing.rows.length > 0) {
      console.warn(`⚠️ [Department Update] Name "${trimmedName}" already used by ID=${existing.rows[0].id}`);
      return res.status(400).json({ error: `Department name "${existing.rows[0].name}" already in use.` });
    }

    const updateSql = 'UPDATE department SET name = $1 WHERE id = $2 RETURNING *';
    const result = await db.query(updateSql, [trimmedName, id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Department not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ [Department Update Error]:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Department name already exists.' });
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
