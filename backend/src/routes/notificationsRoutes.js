// ─────────────────────────────────────────────────────────────
//  routes/notificationsRoutes.js
// ─────────────────────────────────────────────────────────────
const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/notificationsController');
const auth       = require('../middleware/auth');

// Staff/admin can trigger a notification manually
router.post('/send', auth, controller.sendNotification);

module.exports = router;
