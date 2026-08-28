const pidusage = require('pidusage');
const { spawn } = require('child_process');
const path = require('path');

let monitorInterval = null;
let currentCpuUsage = 0;
let maxCpuRecorded = 0;
let isRestarting = false;
const CPU_THRESHOLD = 70; // 70% CPU usage threshold

let consecutiveHighSamples = 0;
const REQUIRED_CONSECUTIVE_SAMPLES = 5; // Requires high CPU for 5 consecutive checks (~10 seconds)

function startCpuMonitoring(intervalMs = 2000) {
  if (monitorInterval) return;

  console.log(`[CPU Monitor] Monitoring node server CPU utilization (Threshold: ${CPU_THRESHOLD}%)...`);

  monitorInterval = setInterval(async () => {
    try {
      const stats = await pidusage(process.pid);
      currentCpuUsage = parseFloat(stats.cpu.toFixed(2));
      if (currentCpuUsage > maxCpuRecorded) {
        maxCpuRecorded = currentCpuUsage;
      }

      // Check if threshold exceeded
      if (currentCpuUsage >= CPU_THRESHOLD) {
        consecutiveHighSamples++;
        console.log(`[CPU Monitor Warning] CPU usage at ${currentCpuUsage}% (${consecutiveHighSamples}/${REQUIRED_CONSECUTIVE_SAMPLES} consecutive high readings)`);
        
        if (consecutiveHighSamples >= REQUIRED_CONSECUTIVE_SAMPLES && !isRestarting) {
          handleCpuExceeded(currentCpuUsage);
        }
      } else {
        consecutiveHighSamples = 0;
      }
    } catch (err) {
      console.error('[CPU Monitor Error]', err.message);
    }
  }, intervalMs);
}

function handleCpuExceeded(usagePercent) {
  isRestarting = true;
  console.error(`\n=============================================================`);
  console.error(`[CRITICAL ALERT] CPU Utilization exceeded threshold!`);
  console.error(`[CPU Monitor] Current CPU: ${usagePercent}% | Threshold: ${CPU_THRESHOLD}%`);
  console.error(`[CPU Monitor] Initiating Node Server restart now...`);
  console.error(`=============================================================\n`);

  restartServer();
}

let serverInstance = null;

function setServerInstance(server) {
  serverInstance = server;
}

function restartServer() {
  const serverPath = path.resolve(__dirname, '../server.js');
  console.log(`[CPU Monitor] Spawning new process: node ${serverPath}`);

  if (serverInstance) {
    try {
      serverInstance.close(() => console.log('[CPU Monitor] Port released.'));
    } catch (e) {
      console.error('[CPU Monitor] Error closing server:', e.message);
    }
  }

  setTimeout(() => {
    // Spawn new independent process
    const child = spawn(process.argv[0], [serverPath], {
      detached: true,
      stdio: 'inherit'
    });
    child.unref();

    setTimeout(() => {
      console.log('[CPU Monitor] Terminating old process PID:', process.pid);
      process.exit(1);
    }, 500);
  }, 1000);
}

function simulateCpuSpike(durationMs = 5000) {
  console.log(`[CPU Monitor Test] Simulating high CPU spike (>70%)...`);
  const endTime = Date.now() + durationMs;
  
  // Busy loop to spike CPU
  const spikeWorker = () => {
    while (Date.now() < endTime) {
      Math.random() * Math.random();
    }
  };

  spikeWorker();
  currentCpuUsage = 95.5;
  consecutiveHighSamples = REQUIRED_CONSECUTIVE_SAMPLES;
  handleCpuExceeded(currentCpuUsage);
}

function getCpuStatus() {
  return {
    pid: process.pid,
    currentCpuPercentage: currentCpuUsage,
    thresholdPercentage: CPU_THRESHOLD,
    maxCpuRecorded,
    status: currentCpuUsage >= CPU_THRESHOLD ? 'EXCEEDED_THRESHOLD' : 'NORMAL'
  };
}

module.exports = {
  startCpuMonitoring,
  getCpuStatus,
  simulateCpuSpike,
  restartServer,
  setServerInstance
};
