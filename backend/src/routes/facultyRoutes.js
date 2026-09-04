const express = require('express');
const router = express.Router();
const facultyController = require('../controllers/facultyController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.get('/', authenticateToken, facultyController.getAllFaculty);
router.get('/:id', authenticateToken, facultyController.getFacultyById);
router.post('/', authenticateToken, requireRole('admin'), facultyController.createFaculty);
router.put('/:id', authenticateToken, requireRole('admin'), facultyController.updateFaculty);
router.delete('/:id', authenticateToken, requireRole('admin'), facultyController.deleteFaculty);

module.exports = router;
