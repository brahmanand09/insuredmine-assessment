const { Worker } = require('worker_threads');
const path = require('path');
const logger = require('../utils/logger');

exports.importFileData = (filePath) => {
  return new Promise((resolve, reject) => {
    const workerScript = path.resolve(__dirname, '../workers/excelWorker.js');
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/insurance_policy_db';

    logger.info(`Offloading file parsing to Worker Thread: ${workerScript}`);

    const worker = new Worker(workerScript, {
      workerData: { filePath, mongoUri }
    });

    worker.on('message', (message) => {
      if (message.status === 'success') {
        resolve(message);
      } else {
        reject(new Error(message.error || 'Worker thread execution failed'));
      }
    });

    worker.on('error', (err) => {
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
