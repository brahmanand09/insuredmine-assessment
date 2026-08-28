const cpuMonitor = require('../services/cpuMonitor');

/**
 * Task 2 (1): Real-time CPU status endpoint
 */
exports.getCpuMetrics = (req, res) => {
  const status = cpuMonitor.getCpuStatus();
  return res.status(200).json({
    success: true,
    data: status
  });
};

/**
 * Task 2 (1): Simulate >70% CPU Spike for Testing
 */
exports.simulateCpuSpike = (req, res) => {
  const duration = parseInt(req.body.durationMs, 10) || 5000;
  
  // Respond first before starting high CPU loop
  res.status(200).json({
    success: true,
    message: `Triggered CPU spike simulation for ${duration}ms. If usage exceeds 70%, server will restart!`
  });

  setImmediate(() => {
    cpuMonitor.simulateCpuSpike(duration);
  });
};
