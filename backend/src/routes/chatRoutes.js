// ─────────────────────────────────────────────────────────────
//  routes/chatRoutes.js
// ─────────────────────────────────────────────────────────────
const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/chatController');
const auth       = require('../middleware/auth');

// All chat routes require authentication
router.post('/',        auth, controller.sendMessage);
router.get('/history',  auth, controller.getHistory);
router.post('/new',           auth, controller.newConversation);
router.post('/intro', auth, controller.salesRepIntro);
router.get('/conversations',  auth, controller.getConversations);
router.delete('/conversations',     auth, controller.deleteAllConversations); // delete ALL
router.delete('/conversations/:id', auth, controller.deleteConversation);     // delete ONE

module.exports = router;
