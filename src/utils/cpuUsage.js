const pidusage = require('pidusage');

async function getCpuUsage() {
  try {
    const stats = await pidusage(process.pid);
    return parseFloat(stats.cpu.toFixed(2));
  } catch (err) {
    return 0;
  }
}

module.exports = {
  getCpuUsage
};
