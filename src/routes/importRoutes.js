const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const importController = require('../controllers/importController');

router.post('/', upload.single('file'), importController.importData);

module.exports = router;
