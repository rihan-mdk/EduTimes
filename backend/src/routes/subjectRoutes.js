const express = require('express');
const router = express.Router();
const subjectController = require('../controllers/subjectController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.get('/', authenticateToken, subjectController.getAllSubjects);
router.get('/:id', authenticateToken, subjectController.getSubjectById);
router.post('/', authenticateToken, requireRole('admin'), subjectController.createSubject);
router.put('/:id', authenticateToken, requireRole('admin'), subjectController.updateSubject);
router.delete('/:id', authenticateToken, requireRole('admin'), subjectController.deleteSubject);

module.exports = router;
