const { getCpuUsage } = require('../utils/cpuUsage');
const logger = require('../utils/logger');
const { spawn } = require('child_process');
const path = require('path');

let monitorInterval = null;
let currentCpu = 0;
let maxCpu = 0;
let consecutiveHighReadings = 0;
let isShuttingDown = false;
let serverInstance = null;

const CPU_THRESHOLD = parseInt(process.env.CPU_THRESHOLD, 10) || 70;
const CHECK_INTERVAL = parseInt(process.env.CPU_CHECK_INTERVAL, 10) || 5000;
const REQUIRED_CONSECUTIVE_READINGS = 3; // Sustained high CPU (~15 seconds)

function setServerInstance(server) {
  serverInstance = server;
}

function startMonitoring() {
  if (monitorInterval) return;

  logger.info(`Starting CPU Monitor (Threshold: ${CPU_THRESHOLD}%, Interval: ${CHECK_INTERVAL}ms)...`);

  monitorInterval = setInterval(async () => {
    currentCpu = await getCpuUsage();
    if (currentCpu > maxCpu) maxCpu = currentCpu;

    if (currentCpu >= CPU_THRESHOLD) {
      consecutiveHighReadings++;
      logger.warn(`CPU Utilization High: ${currentCpu}% (${consecutiveHighReadings}/${REQUIRED_CONSECUTIVE_READINGS})`);

      if (consecutiveHighReadings >= REQUIRED_CONSECUTIVE_READINGS && !isShuttingDown) {
        handleCpuExceeded(currentCpu);
      }
    } else {
      consecutiveHighReadings = 0;
    }
  }, CHECK_INTERVAL);
}

function handleCpuExceeded(cpuValue) {
  isShuttingDown = true;
  logger.error(`\n=============================================================`);
  logger.error(`[CRITICAL] CPU Utilization reached ${cpuValue}% (Threshold: ${CPU_THRESHOLD}%)!`);
  logger.error(`[CRITICAL] Initiating Graceful Shutdown & Server Restart...`);
  logger.error(`=============================================================\n`);

  if (serverInstance) {
    try {
      serverInstance.close(() => logger.info('HTTP Server closed successfully.'));
    } catch (e) {
      logger.error('Error closing HTTP server:', e.message);
    }
  }

  // If PM2 is managing the process, process.exit(1) causes PM2 to auto-restart.
  // Otherwise, spawn standalone child fallback.
  setTimeout(() => {
    if (!process.env.PM2_HOME && !process.env.pm_id) {
      const serverPath = path.resolve(__dirname, '../server.js');
      logger.info(`Spawning fallback restart process: node ${serverPath}`);
      const child = spawn(process.argv[0], [serverPath], {
        detached: true,
        stdio: 'inherit'
      });
      child.unref();
    }
    process.exit(1);
  }, 1000);
}

function simulateCpuSpike(durationMs = 5000) {
  logger.warn(`[CPU Test] Simulating CPU spike for ${durationMs}ms...`);
  const endTime = Date.now() + durationMs;
  while (Date.now() < endTime) {
    Math.random() * Math.random();
  }
  currentCpu = 96.5;
  consecutiveHighReadings = REQUIRED_CONSECUTIVE_READINGS;
  handleCpuExceeded(currentCpu);
}

function getMetrics() {
  return {
    pid: process.pid,
    currentCpuPercentage: currentCpu,
    thresholdPercentage: CPU_THRESHOLD,
    maxCpuRecorded: maxCpu,
    status: currentCpu >= CPU_THRESHOLD ? 'EXCEEDED_THRESHOLD' : 'NORMAL'
  };
}

module.exports = {
  startMonitoring,
  setServerInstance,
  getMetrics,
  simulateCpuSpike
};
