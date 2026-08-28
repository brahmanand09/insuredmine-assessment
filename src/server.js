require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
const cpuMonitorService = require('./services/cpuMonitorService');
const schedulerService = require('./services/schedulerService');

const PORT = process.env.PORT || 5000;

async function startServer() {
  // Connect to MongoDB
  await connectDB();

  const server = app.listen(PORT, async () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    logger.info(`Process PID: ${process.pid}`);

    // Set server instance & start CPU monitoring
    cpuMonitorService.setServerInstance(server);
    cpuMonitorService.startMonitoring();

    // Restore pending scheduled jobs
    await schedulerService.restorePendingJobs();
  });
}

startServer();
