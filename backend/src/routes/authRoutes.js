const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/login', authController.login);
router.post('/check-department', authController.checkDepartment);
router.post('/setup-department', authController.setupDepartment);
router.get('/me', authenticateToken, authController.getMe);

module.exports = router;
