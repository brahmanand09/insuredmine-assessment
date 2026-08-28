const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

// Task 2 (2) Routes
router.post('/schedule', messageController.schedulePost);
router.get('/', messageController.getScheduledMessages);

module.exports = router;
