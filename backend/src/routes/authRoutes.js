const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiters');

router.post('/login', authLimiter, authController.login);
router.post('/check-department', authLimiter, authController.checkDepartment);
router.post('/setup-department', authLimiter, authController.setupDepartment);
router.get('/me', authenticateToken, authController.getMe);
router.put('/profile', authenticateToken, authController.updateProfile);

module.exports = router;
