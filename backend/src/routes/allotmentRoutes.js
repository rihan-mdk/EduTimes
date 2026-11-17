const express = require('express');
const router = express.Router();
const allotmentController = require('../controllers/allotmentController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// Sessions
router.get('/sessions', authenticateToken, allotmentController.getSessions);
router.post('/sessions', authenticateToken, requireRole('admin'), allotmentController.createSession);
router.get('/sessions/:id', authenticateToken, allotmentController.getSessionDetails);
router.patch('/sessions/:id/status', authenticateToken, requireRole('admin'), allotmentController.updateSessionStatus);
router.post('/sessions/:id/sync', authenticateToken, requireRole('admin'), allotmentController.syncToMasterData);

// Courses
router.post('/courses', authenticateToken, requireRole('admin'), allotmentController.addCourse);
router.put('/courses/:id', authenticateToken, requireRole('admin'), allotmentController.updateCourse);
router.delete('/courses/:id', authenticateToken, requireRole('admin'), allotmentController.deleteCourse);
router.post('/courses/:course_id/allot', authenticateToken, requireRole('admin'), allotmentController.allotFaculty);

// Faculty Preference Sheet & Choice Submission
router.get('/faculty/sheet', authenticateToken, allotmentController.getFacultySheet);
router.post('/faculty/preferences', authenticateToken, allotmentController.submitPreferences);

module.exports = router;
