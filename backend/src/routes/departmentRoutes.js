const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.get('/', authenticateToken, departmentController.getAllDepartments);
router.get('/:id', authenticateToken, departmentController.getDepartmentById);
router.post('/', authenticateToken, requireRole('admin'), departmentController.createDepartment);
router.put('/:id', authenticateToken, requireRole('admin'), departmentController.updateDepartment);
router.delete('/:id', authenticateToken, requireRole('admin'), departmentController.deleteDepartment);

module.exports = router;
