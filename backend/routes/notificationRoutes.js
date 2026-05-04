const express = require('express');
const { getNotifications, markAsRead, markAllAsRead, clearAll } = require('../controllers/notificationController');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, getNotifications);
router.put('/all/read', auth, markAllAsRead);
router.delete('/all', auth, clearAll);
router.put('/:id/read', auth, markAsRead);

module.exports = router;
