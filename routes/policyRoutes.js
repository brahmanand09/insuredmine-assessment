const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const policyController = require('../controllers/policyController');

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx, .xls, and .csv files are supported!'));
    }
  }
});

// Task 1 Routes
router.post('/upload', upload.single('file'), policyController.uploadPolicies);
router.get('/search', policyController.searchPoliciesByUsername);
router.get('/search/:username', policyController.searchPoliciesByUsername);
router.get('/aggregated', policyController.getAggregatedPoliciesByUser);
router.get('/overview', policyController.getDatabaseOverview);

module.exports = router;
