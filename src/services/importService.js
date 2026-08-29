const { Worker } = require('worker_threads');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

exports.importFileData = (filePath) => {
  return new Promise((resolve, reject) => {
    const workerScript = path.resolve(__dirname, '../workers/excelWorker.js');
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/insurance_policy_db';

    logger.info(`Offloading file parsing to Worker Thread: ${workerScript}`);

    const worker = new Worker(workerScript, {
      workerData: { filePath, mongoUri }
    });

    const cleanupTempFile = async () => {
      try {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
          logger.info(`Cleaned up temporary upload file: ${filePath}`);
        }
      } catch (err) {
        logger.warn(`Failed to cleanup temp file ${filePath}: ${err.message}`);
      }
    };

    worker.on('message', async (message) => {
      await cleanupTempFile();
      if (message.status === 'success') {
        resolve(message);
      } else {
        reject(new Error(message.error || 'Worker thread execution failed'));
      }
    });

    worker.on('error', async (err) => {
      await cleanupTempFile();
      logger.error('Worker Thread Error:', err);
      reject(err);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        logger.error(`Worker Thread stopped with exit code ${code}`);
      }
    });
  });
};
