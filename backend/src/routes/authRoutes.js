// ─────────────────────────────────────────────────────────────
//  routes/authRoutes.js
// ─────────────────────────────────────────────────────────────
const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/authController');
const auth       = require('../middleware/auth');

// Public routes – no token needed
router.post('/register', controller.register);
router.post('/login',    controller.login);

// Protected routes – require a valid JWT
router.get('/me',           auth, controller.getMe);
router.patch('/fcm-token',  auth, controller.saveFcmToken);

module.exports = router;
