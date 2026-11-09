const express = require('express');
const router = express.Router();
const busySlotController = require('../controllers/busySlotController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// Readable by both admin and faculty (faculty views their own commitments)
router.get('/', authenticateToken, busySlotController.getBusySlots);

// Admin-only mutations
router.post('/', authenticateToken, requireRole('admin'), busySlotController.createBusySlots);
router.delete('/:id', authenticateToken, requireRole('admin'), busySlotController.deleteBusySlot);

module.exports = router;

