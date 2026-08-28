module.exports = {
  apps: [
    {
      name: 'insurance-policy-api',
      script: './src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
        MONGODB_URI: 'mongodb://localhost:27017/insurance_policy_db',
        CPU_THRESHOLD: 70,
        CPU_CHECK_INTERVAL: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        MONGODB_URI: 'mongodb://localhost:27017/insurance_policy_db',
        CPU_THRESHOLD: 70,
        CPU_CHECK_INTERVAL: 5000
      }
    }
  ]
};
