// ─────────────────────────────────────────────────────────────
//  routes/demosRoutes.js
// ─────────────────────────────────────────────────────────────
const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/demosController');
const auth       = require('../middleware/auth');

router.post('/',        auth, controller.bookDemo);
router.get('/',         auth, controller.getMyBookings);
router.delete('/:id',   auth, controller.cancelBooking);
router.patch('/:id/complete', auth, controller.markCompleted);

module.exports = router;
