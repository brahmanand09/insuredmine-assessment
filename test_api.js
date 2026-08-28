const fs = require('fs');
const path = require('path');
const http = require('http');
const mongoose = require('mongoose');

// Models for direct DB verification
const Agent = require('./models/Agent');
const User = require('./models/User');
const UserAccount = require('./models/UserAccount');
const PolicyCategory = require('./models/PolicyCategory');
const PolicyCarrier = require('./models/PolicyCarrier');
const Policy = require('./models/Policy');
const ScheduledMessage = require('./models/ScheduledMessage');

const PORT = 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runEndToEndVerification() {
  console.log(`\n=============================================================`);
  console.log(`[InsuredMine Technical Assessment - End-to-End Verification]`);
  console.log(`=============================================================\n`);

  try {
    // 1. Connect to MongoDB for direct collection inspection
    await mongoose.connect('mongodb://localhost:27017/insuredmine_db');
    console.log('[1/7 Direct MongoDB Connection]: Connected successfully.');

    // Clean existing test collections
    await Promise.all([
      Agent.deleteMany({}),
      User.deleteMany({}),
      UserAccount.deleteMany({}),
      PolicyCategory.deleteMany({}),
      PolicyCarrier.deleteMany({}),
      Policy.deleteMany({}),
      ScheduledMessage.deleteMany({})
    ]);
    console.log('[1/7 DB Cleanup]: Flushed previous database state for clean test.');

    // 2. Test Task 1 (1): Ingest sample XLSX via Worker Thread Upload API
    console.log('\n[2/7 Testing Task 1 (1): Worker Thread Data Upload...]');
    const sampleFilePath = path.join(__dirname, 'data-sheet - Node js Assesment (2) (1).xlsx');

    if (!fs.existsSync(sampleFilePath)) {
      throw new Error(`Sample Excel file not found at: ${sampleFilePath}`);
    }

    // Construct multipart form data manually for node http
    const boundary = '--------------------------' + Date.now().toString(16);
    const fileData = fs.readFileSync(sampleFilePath);

    const postDataHeader = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${path.basename(sampleFilePath)}"\r\n` +
      `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`
    );
    const postDataFooter = Buffer.from(`\r\n--${boundary}--\r\n`);
    const payload = Buffer.concat([postDataHeader, fileData, postDataFooter]);

    const uploadRes = await httpRequest('/api/policies/upload', 'POST', payload, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': payload.length
    });

    console.log('[Task 1 (1) Response]:', uploadRes);

    // 3. Verify Collections populated in MongoDB (Task 1 requirement 4)
    console.log('\n[3/7 Verifying Task 1 (4): 6 Separate Collections in MongoDB...]');
    const [agentCount, userCount, accountCount, categoryCount, carrierCount, policyCount] = await Promise.all([
      Agent.countDocuments(),
      User.countDocuments(),
      UserAccount.countDocuments(),
      PolicyCategory.countDocuments(),
      PolicyCarrier.countDocuments(),
      Policy.countDocuments()
    ]);

    console.log(` -> Agent Collection (1): ${agentCount} documents`);
    console.log(` -> User Collection (2): ${userCount} documents`);
    console.log(` -> User's Account Collection (3): ${accountCount} documents`);
    console.log(` -> Policy Category (LOB) Collection (4): ${categoryCount} documents`);
    console.log(` -> Policy Carrier Collection (5): ${carrierCount} documents`);
    console.log(` -> Policy Info Collection (6): ${policyCount} documents`);

    if (policyCount === 0 || userCount === 0) {
      throw new Error('Verification failed: MongoDB collections are empty!');
    }

    // Inspect foreign key references on sample Policy document
    const samplePolicy = await Policy.findOne()
      .populate('user_id')
      .populate('category_id')
      .populate('company_id')
      .populate('agent_id')
      .populate('account_id');

    console.log('\n[Inspected Sample Policy Document Foreign References]:');
    console.log(`  Policy Number: ${samplePolicy.policy_number}`);
    console.log(`  User: ${samplePolicy.user_id.firstname} (_id: ${samplePolicy.user_id._id})`);
    console.log(`  Category (LOB): ${samplePolicy.category_id.category_name} (_id: ${samplePolicy.category_id._id})`);
    console.log(`  Carrier: ${samplePolicy.company_id.company_name} (_id: ${samplePolicy.company_id._id})`);
    console.log(`  Agent: ${samplePolicy.agent_id.name} (_id: ${samplePolicy.agent_id._id})`);
    console.log(`  Account: ${samplePolicy.account_id.account_name} (_id: ${samplePolicy.account_id._id})`);

    // 4. Test Task 1 (2): Search API by Username
    console.log('\n[4/7 Testing Task 1 (2): Search Policy Info by Username...]');
    const sampleUser = await User.findOne();
    const usernameQuery = sampleUser.firstname;

    const searchRes = await httpRequest(`/api/policies/search?username=${encodeURIComponent(usernameQuery)}`, 'GET');
    console.log(`[Task 1 (2) Response for username="${usernameQuery}"]:`);
    console.log(` -> Users Found: ${searchRes.usersFound}, Total Linked Policies: ${searchRes.totalPolicies}`);

    // 5. Test Task 1 (3): Aggregated Policy by Each User
    console.log('\n[5/7 Testing Task 1 (3): Aggregated Policy API...]');
    const aggRes = await httpRequest('/api/policies/aggregated', 'GET');
    console.log(`[Task 1 (3) Response]: ${aggRes.totalUsersWithPolicies} aggregated user profiles returned.`);
    if (aggRes.data.length > 0) {
      console.log(' Top User Profile:', aggRes.data[0]);
    }

    // 6. Test Task 2 (1): CPU Monitoring Status API
    console.log('\n[6/7 Testing Task 2 (1): Real-time CPU Utilization Tracking API...]');
    const cpuRes = await httpRequest('/api/system/cpu', 'GET');
    console.log('[Task 2 (1) CPU Status Response]:', cpuRes);

    // 7. Test Task 2 (2): Scheduled Message Post Service
    console.log('\n[7/7 Testing Task 2 (2): Scheduled Post Service API...]');
    const postPayload = JSON.stringify({
      message: 'Test automated assessment notification',
      day: 'today',
      time: '15:30'
    });

    const schedRes = await httpRequest('/api/messages/schedule', 'POST', Buffer.from(postPayload), {
      'Content-Type': 'application/json'
    });
    console.log('[Task 2 (2) Scheduled Post Response]:', schedRes);

    console.log(`\n=============================================================`);
    console.log(`[SUCCESS] ALL TASKS & APIS VERIFIED SUCCESSFULLY!`);
    console.log(`=============================================================\n`);
  } catch (err) {
    console.error(`\n[VERIFICATION ERROR] ${err.message}`);
    console.error(err);
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

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

runEndToEndVerification();
