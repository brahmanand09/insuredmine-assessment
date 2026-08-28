const { parentPort, workerData } = require('worker_threads');
const mongoose = require('mongoose');
const XLSX = require('xlsx');

// Import models
const Agent = require('../../models/Agent');
const User = require('../../models/User');
const UserAccount = require('../../models/UserAccount');
const PolicyCategory = require('../../models/PolicyCategory');
const PolicyCarrier = require('../../models/PolicyCarrier');
const Policy = require('../../models/Policy');

function parseExcelDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    const jsDate = XLSX.SSF.parse_date_code(val);
    if (jsDate) return new Date(Date.UTC(jsDate.y, jsDate.m - 1, jsDate.d, jsDate.H, jsDate.M, jsDate.S));
  }
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? null : parsed;
}

async function processFile() {
  const startTime = Date.now();
  const { filePath, mongoUri } = workerData;

  try {
    await mongoose.connect(mongoUri || 'mongodb://localhost:27017/insuredmine_db');

    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    console.log(`[Worker] Loaded ${rawRows.length} rows from file.`);

    // Pre-fetch existing collections into memory maps for ultra-fast matching
    const [existingAgents, existingUsers, existingAccounts, existingCategories, existingCarriers] = await Promise.all([
      Agent.find().lean(),
      User.find().lean(),
      UserAccount.find().lean(),
      PolicyCategory.find().lean(),
      PolicyCarrier.find().lean()
    ]);

    const agentCache = new Map(existingAgents.map(a => [a.name.trim().toLowerCase(), a._id]));
    const userCache = new Map(existingUsers.map(u => [`${u.firstname.trim().toLowerCase()}_${(u.email || '').trim().toLowerCase()}`, u._id]));
    const accountCache = new Map(existingAccounts.map(a => [`${a.account_name.trim().toLowerCase()}_${a.userId}`, a._id]));
    const categoryCache = new Map(existingCategories.map(c => [c.category_name.trim().toLowerCase(), c._id]));
    const carrierCache = new Map(existingCarriers.map(c => [c.company_name.trim().toLowerCase(), c._id]));

    const policiesToInsert = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];

      if (i % 50 === 0) {
        // Yield CPU to prevent CPU usage spike
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      // 1. Agent
      const agentName = (row.agent || 'Unknown Agent').trim();
      const agentKey = agentName.toLowerCase();
      let agentId = agentCache.get(agentKey);
      if (!agentId) {
        let agentDoc = await Agent.create({ name: agentName });
        agentId = agentDoc._id;
        agentCache.set(agentKey, agentId);
      }

      // 2. User
      const firstname = (row.firstname || row.user || 'Unknown User').trim();
      const email = (row.email || '').trim().toLowerCase();
      const userKey = `${firstname.toLowerCase()}_${email}`;

      let userId = userCache.get(userKey);
      if (!userId) {
        let userDoc = await User.create({
          firstname,
          dob: parseExcelDate(row.dob),
          address: (row.address || '').trim(),
          phone: String(row.phone || '').trim(),
          state: (row.state || '').trim(),
          zip: String(row.zip || '').trim(),
          email,
          gender: (row.gender || '').trim(),
          userType: (row.userType || '').trim()
        });
        userId = userDoc._id;
        userCache.set(userKey, userId);
      }

      // 3. User's Account
      const accountName = (row.account_name || `${firstname}'s Account`).trim();
      const accountKey = `${accountName.toLowerCase()}_${userId}`;
      let accountId = accountCache.get(accountKey);
      if (!accountId) {
        let accountDoc = await UserAccount.create({
          account_name: accountName,
          userId
        });
        accountId = accountDoc._id;
        accountCache.set(accountKey, accountId);
      }

      // 4. Policy Category (LOB)
      const categoryName = (row.category_name || 'General').trim();
      const categoryKey = categoryName.toLowerCase();
      let categoryId = categoryCache.get(categoryKey);
      if (!categoryId) {
        let catDoc = await PolicyCategory.create({ category_name: categoryName });
        categoryId = catDoc._id;
        categoryCache.set(categoryKey, categoryId);
      }

      // 5. Policy Carrier
      const companyName = (row.company_name || 'Default Carrier').trim();
      const carrierKey = companyName.toLowerCase();
      let companyId = carrierCache.get(carrierKey);
      if (!companyId) {
        let carrierDoc = await PolicyCarrier.create({ company_name: companyName });
        companyId = carrierDoc._id;
        carrierCache.set(carrierKey, companyId);
      }

      // 6. Policy Info
      const policyNumber = (row.policy_number || `POL-${Date.now()}-${Math.floor(Math.random()*1000)}`).trim();
      const premiumAmount = parseFloat(row.premium_amount) || 0;

      policiesToInsert.push({
        policy_number: policyNumber,
        policy_start_date: parseExcelDate(row.policy_start_date),
        policy_end_date: parseExcelDate(row.policy_end_date),
        category_id: categoryId,
        company_id: companyId,
        user_id: userId,
        account_id: accountId,
        agent_id: agentId,
        premium_amount: premiumAmount,
        policy_mode: String(row.policy_mode || ''),
        policy_type: String(row.policy_type || '')
      });
    }

    // Bulk insert policies in batches
    const batchSize = 500;
    let insertedCount = 0;
    for (let i = 0; i < policiesToInsert.length; i += batchSize) {
      const batch = policiesToInsert.slice(i, i + batchSize);
      await Policy.insertMany(batch, { ordered: false });
      insertedCount += batch.length;
    }

    const durationMs = Date.now() - startTime;
    parentPort.postMessage({
      status: 'success',
      totalRows: rawRows.length,
      insertedPolicies: insertedCount,
      agentsCount: agentCache.size,
      usersCount: userCache.size,
      accountsCount: accountCache.size,
      categoriesCount: categoryCache.size,
      carriersCount: carrierCache.size,
      durationMs
    });
  } catch (error) {
    console.error('[Worker Error]', error);
    parentPort.postMessage({
      status: 'error',
      error: error.message
    });
  } finally {
    await mongoose.disconnect();
  }
}

processFile();
