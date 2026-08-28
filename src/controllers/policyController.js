const policyService = require('../services/policyService');
const cpuMonitorService = require('../services/cpuMonitorService');

/**
 * GET /api/policies/search?username=Lura
 */
exports.searchPolicies = async (req, res, next) => {
  try {
    const username = req.query.username || req.query.firstname || req.params.username;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Query parameter "username" is required. Example: /api/policies/search?username=Lura'
      });
    }

    const result = await policyService.searchPoliciesByUsername(username);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: `No user or policy information found matching "${username}"`
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/policies/aggregate/users
 */
exports.aggregatePoliciesByUsers = async (req, res, next) => {
  try {
    const data = await policyService.aggregatePoliciesByUser();
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/health
 */
exports.getHealthStatus = (req, res) => {
  const cpuMetrics = cpuMonitorService.getMetrics();
  return res.status(200).json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    cpu: cpuMetrics
  });
};
