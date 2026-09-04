const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// Allow public retrieval of departments (used on login screen)
router.get('/public', departmentController.getAllDepartments);
router.get('/', departmentController.getAllDepartments);
router.get('/:id', departmentController.getDepartmentById);
router.post('/', authenticateToken, requireRole('admin'), departmentController.createDepartment);
router.put('/:id', authenticateToken, requireRole('admin'), departmentController.updateDepartment);
router.delete('/:id', authenticateToken, requireRole('admin'), departmentController.deleteDepartment);

module.exports = router;
