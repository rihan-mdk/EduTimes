const express = require('express');
const router = express.Router();
const timetableController = require('../controllers/timetableController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// Accessible by both admin and faculty to view timetables
router.get('/', authenticateToken, timetableController.getTimetable);

// Live clash validation for drag and drop moves / placement preview
router.post('/validate-move', authenticateToken, timetableController.validateEntryPlacement);

// Admin-only mutation routes
router.post('/', authenticateToken, requireRole('admin'), timetableController.createTimetableEntry);
router.put('/:id', authenticateToken, requireRole('admin'), timetableController.updateTimetableEntry);
router.delete('/:id', authenticateToken, requireRole('admin'), timetableController.deleteTimetableEntry);

// Auto-generate timetable across ALL semesters with deterministic backtracking CSP algorithm
router.post('/auto-generate', authenticateToken, requireRole('admin'), timetableController.autoGenerateTimetable);

// Clear timetable for academic year or semester
router.post('/clear', authenticateToken, requireRole('admin'), timetableController.clearTimetable);

module.exports = router;
