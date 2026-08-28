const express = require('express');
const cors = require('cors');
const path = require('path');

const importRoutes = require('./routes/importRoutes');
const policyRoutes = require('./routes/policyRoutes');
const messageRoutes = require('./routes/messageRoutes');
const policyController = require('./controllers/policyController');
const cpuMonitorService = require('./services/cpuMonitorService');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.resolve(__dirname, '../public')));

// API Endpoint Mounts
app.use('/api/import', importRoutes);
app.use('/api/policies/upload', importRoutes); // Alias
app.use('/api/policies', policyRoutes);
app.use('/api/messages', messageRoutes);

// Health check endpoint
app.get('/api/health', policyController.getHealthStatus);

// CPU Monitor endpoints for testing & verification
app.get('/api/system/cpu', (req, res) => {
  res.status(200).json({ success: true, data: cpuMonitorService.getMetrics() });
});

app.post('/api/system/simulate-cpu-spike', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Triggered CPU spike simulation. Server will execute controlled shutdown & restart.'
  });
  setImmediate(() => cpuMonitorService.simulateCpuSpike(5000));
});

// 404 Not Found Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
