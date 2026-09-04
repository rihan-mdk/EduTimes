const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.get('/', authenticateToken, calendarController.getAllCalendarDates);
router.post('/', authenticateToken, requireRole('admin'), calendarController.createCalendarDate);
router.delete('/:id', authenticateToken, requireRole('admin'), calendarController.deleteCalendarDate);

module.exports = router;
