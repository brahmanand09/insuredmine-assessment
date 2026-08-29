const express = require('express');
const router = express.Router();
const policyController = require('../controllers/policyController');

router.get('/search', policyController.searchPolicies);
router.get('/search/:username', policyController.searchPolicies);
router.get('/aggregate/users', policyController.aggregatePoliciesByUsers);
router.get('/aggregated', policyController.aggregatePoliciesByUsers); // Backwards compatibility alias

router.get('/overview', policyController.getCollectionOverview);

module.exports = router;
