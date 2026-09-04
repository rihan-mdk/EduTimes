const express = require('express');
const router = express.Router();
const semesterController = require('../controllers/semesterController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.get('/', authenticateToken, semesterController.getAllSemesters);
router.get('/:id', authenticateToken, semesterController.getSemesterById);
router.post('/', authenticateToken, requireRole('admin'), semesterController.createSemester);
router.put('/:id', authenticateToken, requireRole('admin'), semesterController.updateSemester);
router.delete('/:id', authenticateToken, requireRole('admin'), semesterController.deleteSemester);

module.exports = router;
