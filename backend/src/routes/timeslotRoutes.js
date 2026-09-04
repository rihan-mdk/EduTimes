const express = require('express');
const router = express.Router();
const timeslotController = require('../controllers/timeslotController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.get('/', authenticateToken, timeslotController.getAllTimeslots);
router.get('/:id', authenticateToken, timeslotController.getTimeslotById);
router.post('/', authenticateToken, requireRole('admin'), timeslotController.createTimeslot);
router.put('/:id', authenticateToken, requireRole('admin'), timeslotController.updateTimeslot);
router.delete('/:id', authenticateToken, requireRole('admin'), timeslotController.deleteTimeslot);

module.exports = router;
