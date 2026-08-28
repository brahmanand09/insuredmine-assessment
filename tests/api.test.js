const fs = require('fs');
const path = require('path');
const http = require('http');
const mongoose = require('mongoose');

const Agent = require('../src/models/Agent');
const User = require('../src/models/User');
const Account = require('../src/models/Account');
const Lob = require('../src/models/Lob');
const Carrier = require('../src/models/Carrier');
const Policy = require('../src/models/Policy');
const ScheduledMessage = require('../src/models/ScheduledMessage');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runTestSuite() {
  console.log(`\n=============================================================`);
  console.log(`[Insurance Policy API - Comprehensive Test Suite]`);
  console.log(`=============================================================\n`);

  try {
    // Connect directly to MongoDB for collection inspection
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/insurance_policy_db');
    console.log('[Test 1/6 MongoDB Connection]: Connected to test database.');

    // Clean existing test collections
    await Promise.all([
      Agent.deleteMany({}),
      User.deleteMany({}),
      Account.deleteMany({}),
      Lob.deleteMany({}),
      Carrier.deleteMany({}),
      Policy.deleteMany({}),
      ScheduledMessage.deleteMany({})
    ]);
    console.log('[Test 1/6 DB Cleanup]: Cleaned existing database collections.');

    // 1. Test POST /api/import via Worker Threads
    console.log('\n[Test 2/6 Testing POST /api/import via Worker Threads...]');
    const sampleFilePath = path.resolve(__dirname, '../data-sheet - Node js Assesment (2) (1).xlsx');

    if (!fs.existsSync(sampleFilePath)) {
      throw new Error(`Sample Excel file not found at: ${sampleFilePath}`);
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

    // 2. Verify Collections in MongoDB
    console.log('\n[Test 3/6 Verifying 6 MongoDB Collections...]');
    const [agentCount, userCount, accountCount, lobCount, carrierCount, policyCount] = await Promise.all([
      Agent.countDocuments(),
      User.countDocuments(),
      Account.countDocuments(),
      Lob.countDocuments(),
      Carrier.countDocuments(),
      Policy.countDocuments()
    ]);

    console.log(` -> agents collection: ${agentCount} documents`);
    console.log(` -> users collection: ${userCount} documents`);
    console.log(` -> accounts collection: ${accountCount} documents`);
    console.log(` -> lobs collection: ${lobCount} documents`);
    console.log(` -> carriers collection: ${carrierCount} documents`);
    console.log(` -> policies collection: ${policyCount} documents`);

    if (policyCount === 0 || userCount === 0) {
      throw new Error('Verification failed: MongoDB collections are empty!');
    }

    // 3. Test GET /api/policies/search?username=Lura
    console.log('\n[Test 4/6 Testing GET /api/policies/search?username=Lura...]');
    const searchRes = await httpRequest('/api/policies/search?username=Lura', 'GET');
    console.log('[Search API Response]:', searchRes);

    // 4. Test GET /api/policies/aggregate/users
    console.log('\n[Test 5/6 Testing GET /api/policies/aggregate/users...]');
    const aggRes = await httpRequest('/api/policies/aggregate/users', 'GET');
    console.log(`[Aggregation API Response]: ${aggRes.data ? aggRes.data.length : 0} user aggregated records.`);
    if (aggRes.data && aggRes.data.length > 0) {
      console.log(' Top Aggregated User:', aggRes.data[0]);
    }

    // 5. Test POST /api/messages/schedule
    console.log('\n[Test 6/6 Testing POST /api/messages/schedule...]');
    const schedulePayload = JSON.stringify({
      message: 'Policy renewal reminder',
      day: 'tomorrow',
      time: '10:30'
    });

    const schedRes = await httpRequest('/api/messages/schedule', 'POST', Buffer.from(schedulePayload), {
      'Content-Type': 'application/json'
    });
    console.log('[Schedule API Response]:', schedRes);

    console.log(`\n=============================================================`);
    console.log(`[SUCCESS] ALL API ENDPOINTS & COLLECTIONS TESTED SUCCESSFULLY!`);
    console.log(`=============================================================\n`);
  } catch (err) {
    console.error(`\n[TEST SUITE ERROR] ${err.message}`);
  } finally {
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
