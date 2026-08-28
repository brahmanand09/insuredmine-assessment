const express = require('express');
const router = express.Router();
const systemController = require('../controllers/systemController');

// Task 2 (1) Routes
router.get('/cpu', systemController.getCpuMetrics);
router.post('/simulate-cpu-spike', systemController.simulateCpuSpike);

module.exports = router;
