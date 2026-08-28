const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/db');
const cpuMonitor = require('./services/cpuMonitor');
const scheduleService = require('./services/scheduleService');

const policyRoutes = require('./routes/policyRoutes');
const systemRoutes = require('./routes/systemRoutes');
const messageRoutes = require('./routes/messageRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/policies', policyRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/messages', messageRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Global 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// Start Server
const server = app.listen(PORT, async () => {
  console.log(`\n=============================================================`);
  console.log(`[InsuredMine Technical Assessment Server]`);
  console.log(`Server running on: http://localhost:${PORT}`);
  console.log(`Web Dashboard: http://localhost:${PORT}`);
  console.log(`Process PID: ${process.pid}`);
  console.log(`=============================================================\n`);

  // Set server instance for graceful port release during CPU restart
  cpuMonitor.setServerInstance(server);

  // Start real-time CPU monitor (Task 2 - 1)
  cpuMonitor.startCpuMonitoring(2000);

  // Restore pending scheduled message jobs (Task 2 - 2)
  await scheduleService.restorePendingSchedules();
});

module.exports = server;
