// ─────────────────────────────────────────────────────────────
//  routes/requestsRoutes.js
// ─────────────────────────────────────────────────────────────
const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/requestsController');
const auth       = require('../middleware/auth');

router.post('/',       auth, controller.createRequest);
router.get('/',        auth, controller.getMyRequests);
router.patch('/:id/status', auth, controller.updateStatus);
router.patch('/:id',   auth, controller.updateRequest);
module.exports = router;
