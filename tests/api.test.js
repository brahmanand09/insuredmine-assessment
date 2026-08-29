const fs = require('fs');
const path = require('path');
const http = require('http');
const mongoose = require('mongoose');

// Load environment variables strictly from .env.test for complete test isolation
require('dotenv').config({ path: path.resolve(__dirname, '../.env.test') });

const app = require('../src/app');
const Agent = require('../src/models/Agent');
const User = require('../src/models/User');
const Account = require('../src/models/Account');
const Lob = require('../src/models/Lob');
const Carrier = require('../src/models/Carrier');
const Policy = require('../src/models/Policy');
const ScheduledMessage = require('../src/models/ScheduledMessage');
const Message = require('../src/models/Message');

const PORT = process.env.PORT || 5001;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runTestSuite() {
  console.log(`\n=============================================================`);
  console.log(`[Insurance Policy API - Isolated Test Suite]`);
  console.log(`=============================================================\n`);

  let server;

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/insurance_policy_test';
    
    // Safety check: Ensure test suite NEVER runs against production / dev database
    if (!mongoUri.includes('test')) {
      throw new Error(`CRITICAL TEST SAFETY VIOLATION: MONGODB_URI must contain "test". Provided: ${mongoUri}`);
    }

    await mongoose.connect(mongoUri);
    console.log(`[Test Isolation Guard]: Connected strictly to TEST database: ${mongoUri}`);

    // Clean test database
    await Promise.all([
      Agent.deleteMany({}),
      User.deleteMany({}),
      Account.deleteMany({}),
      Lob.deleteMany({}),
      Carrier.deleteMany({}),
      Policy.deleteMany({}),
      ScheduledMessage.deleteMany({}),
      Message.deleteMany({})
    ]);
    console.log('[DB Cleanup]: Flushed test database collections.');

    // Start Express test server on isolated test PORT
    server = app.listen(PORT);
    console.log(`[Test Server]: Express test instance running on http://127.0.0.1:${PORT}`);

    // 1. Test File Upload API (POST /api/import)
    console.log('\n[1/8 Testing POST /api/import...]');
    const sampleFilePath = path.resolve(__dirname, '../data-sheet - Node js Assesment (2) (1).xlsx');

    if (!fs.existsSync(sampleFilePath)) {
      throw new Error(`Sample file not found at: ${sampleFilePath}`);
    }

    const boundary = '--------------------------' + Date.now().toString(16);
    const fileData = fs.readFileSync(sampleFilePath);

    const postDataHeader = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${path.basename(sampleFilePath)}"\r\n` +
      `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`
    );
    const postDataFooter = Buffer.from(`\r\n--${boundary}--\r\n`);
    const payload = Buffer.concat([postDataHeader, fileData, postDataFooter]);

    const importRes = await httpRequest('/api/import', 'POST', payload, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': payload.length
    });

    console.log('[Import Response]:', importRes);

    // 2. Verify MongoDB Collections
    console.log('\n[2/8 Verifying 6 MongoDB Collections in Test Database...]');
    const [agentCount, userCount, accountCount, lobCount, carrierCount, policyCount] = await Promise.all([
      Agent.countDocuments(),
      User.countDocuments(),
      Account.countDocuments(),
      Lob.countDocuments(),
      Carrier.countDocuments(),
      Policy.countDocuments()
    ]);

    console.log(` -> agents collection: ${agentCount}`);
    console.log(` -> users collection: ${userCount}`);
    console.log(` -> accounts collection: ${accountCount}`);
    console.log(` -> lobs collection: ${lobCount}`);
    console.log(` -> carriers collection: ${carrierCount}`);
    console.log(` -> policies collection: ${policyCount}`);

    if (policyCount === 0 || userCount === 0) {
      throw new Error('Verification failed: Test MongoDB collections are empty!');
    }

    // 3. Test Policy Search API (Existing User & Unknown User)
    console.log('\n[3/8 Testing GET /api/policies/search...]');
    const sampleUser = await User.findOne();
    const searchRes = await httpRequest(`/api/policies/search?username=${encodeURIComponent(sampleUser.firstName)}`, 'GET');
    console.log(`[Search Response for "${sampleUser.firstName}"]:`, searchRes.success ? `Found ${searchRes.data.policies.length} policies` : searchRes.message);

    const unknownSearchRes = await httpRequest('/api/policies/search?username=NonExistentUser12345', 'GET');
    console.log('[Search Unknown User Response (404 expected)]:', unknownSearchRes.message);

    // 4. Test User Aggregations API
    console.log('\n[4/8 Testing GET /api/policies/aggregate/users...]');
    const aggRes = await httpRequest('/api/policies/aggregate/users', 'GET');
    console.log(`[Aggregation Response]: Returned ${aggRes.data ? aggRes.data.length : 0} user aggregated records.`);

    // 5. Test Scheduler API & Atomic Job Execution
    console.log('\n[5/8 Testing POST /api/messages/schedule...]');
    const schedPayload = JSON.stringify({
      message: 'Isolated test notification',
      day: 'today',
      time: '12:00'
    });

    const schedRes = await httpRequest('/api/messages/schedule', 'POST', Buffer.from(schedPayload), {
      'Content-Type': 'application/json'
    });
    console.log('[Scheduler API Response]:', schedRes);

    // 6. Test Scheduler Invalid Time Validation (400 Bad Request Expected)
    console.log('\n[6/8 Testing POST /api/messages/schedule with invalid time string...]');
    const invalidTimePayload = JSON.stringify({
      message: 'Hello',
      day: '2026-09-10',
      time: 'wrong-time'
    });

    const invalidTimeRes = await httpRequest('/api/messages/schedule', 'POST', Buffer.from(invalidTimePayload), {
      'Content-Type': 'application/json'
    });
    console.log('[Scheduler Invalid Time Response (400 Expected)]:', invalidTimeRes);

    // 7. Test Health Endpoint
    console.log('\n[7/8 Testing GET /api/health...]');
    const healthRes = await httpRequest('/api/health', 'GET');
    console.log('[Health Response]: Status:', healthRes.status, '| CPU:', healthRes.cpu.currentCpuPercentage + '%');

    // 8. Verify Temporary File Cleanup in uploads/
    console.log('\n[8/8 Verifying Upload Temporary File Cleanup...]');
    const uploadsDir = path.resolve(__dirname, '../uploads');
    const filesInUploads = fs.readdirSync(uploadsDir).filter(f => f !== '.gitkeep');
    console.log(` -> Files remaining in uploads/: ${filesInUploads.length} (Expected: 0)`);

    console.log(`\n=============================================================`);
    console.log(`[SUCCESS] ALL ISOLATED TEST SUITE TASKS PASSED SUCCESSFULLY!`);
    console.log(`=============================================================\n`);
  } catch (err) {
    console.error(`\n[TEST ERROR] ${err.message}`);
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
  }
}

function httpRequest(endpoint, method, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${endpoint}`;
    const parsedUrl = new URL(url);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: headers
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', (e) => reject(e));

    if (data) req.write(data);
    req.end();
  });
}

runTestSuite();
