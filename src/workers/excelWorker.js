const { parentPort, workerData } = require('worker_threads');
const mongoose = require('mongoose');
const XLSX = require('xlsx');

// Import models
const Agent = require('../models/Agent');
const User = require('../models/User');
const Account = require('../models/Account');
const Lob = require('../models/Lob');
const Carrier = require('../models/Carrier');
const Policy = require('../models/Policy');

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
    await mongoose.connect(mongoUri || 'mongodb://localhost:27017/insurance_policy_db');

    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    console.log(`[Worker Thread] Loaded ${rawRows.length} raw rows from file.`);

    const validRows = [];
    const skippedRows = [];

    // Strict Validation: Validate all 7 required business fields (No manufactured fake data)
    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2; // Excel line number (row 1 is header)

      const email = String(row.email || '').trim().toLowerCase();
      if (!email) {
        skippedRows.push({ row: rowNum, reason: 'Email is required' });
        continue;
      }

      const policyNumber = String(row.policy_number || '').trim();
      if (!policyNumber) {
        skippedRows.push({ row: rowNum, reason: 'Policy number is required' });
        continue;
      }

      const firstname = String(row.firstname || row.user || '').trim();
      if (!firstname) {
        skippedRows.push({ row: rowNum, reason: 'First name is required' });
        continue;
      }

      const agentName = String(row.agent || '').trim();
      if (!agentName) {
        skippedRows.push({ row: rowNum, reason: 'Agent is required' });
        continue;
      }

      const accountName = String(row.account_name || '').trim();
      if (!accountName) {
        skippedRows.push({ row: rowNum, reason: 'Account name is required' });
        continue;
      }

      const categoryName = String(row.category_name || '').trim();
      if (!categoryName) {
        skippedRows.push({ row: rowNum, reason: 'Policy category is required' });
        continue;
      }

      const companyName = String(row.company_name || '').trim();
      if (!companyName) {
        skippedRows.push({ row: rowNum, reason: 'Policy carrier is required' });
        continue;
      }

      validRows.push({
        row,
        agentName,
        firstname,
        email,
        accountName,
        categoryName,
        companyName,
        policyNumber
      });
    }

    if (validRows.length === 0) {
      parentPort.postMessage({
        status: 'success',
        totalRows: rawRows.length,
        processedRows: 0,
        skippedRows: skippedRows.length,
        errors: skippedRows,
        agentsCount: 0,
        usersCount: 0,
        accountsCount: 0,
        lobsCount: 0,
        carriersCount: 0,
        durationMs: Date.now() - startTime
      });
      return;
    }

    // Batch-Scoped Queries (Extract unique batch entities)
    const uniqueAgentNames = [...new Set(validRows.map(r => r.agentName))];
    const uniqueEmails = [...new Set(validRows.map(r => r.email))];
    const uniqueLobNames = [...new Set(validRows.map(r => r.categoryName))];
    const uniqueCarrierNames = [...new Set(validRows.map(r => r.companyName))];

    // Prepare Bulk Upsert Operations for entities
    const agentBulkOps = uniqueAgentNames.map(name => ({
      updateOne: {
        filter: { name },
        update: { $setOnInsert: { name } },
        upsert: true
      }
    }));

    const userBulkOps = validRows.map(item => ({
      updateOne: {
        filter: { email: item.email },
        update: {
          $set: {
            firstName: item.firstname,
            dob: parseExcelDate(item.row.dob),
            address: (item.row.address || '').trim(),
            phone: String(item.row.phone || '').trim(),
            state: (item.row.state || '').trim(),
            zip: String(item.row.zip || '').trim(),
            gender: item.row.gender ? String(item.row.gender).trim() : null,
            userType: (item.row.userType || 'Active Client').trim()
          }
        },
        upsert: true
      }
    }));

    const lobBulkOps = uniqueLobNames.map(name => ({
      updateOne: {
        filter: { name },
        update: { $setOnInsert: { name } },
        upsert: true
      }
    }));

    const carrierBulkOps = uniqueCarrierNames.map(name => ({
      updateOne: {
        filter: { name },
        update: { $setOnInsert: { name } },
        upsert: true
      }
    }));

    // Execute Bulk Write for references concurrently
    await Promise.all([
      agentBulkOps.length ? Agent.bulkWrite(agentBulkOps, { ordered: false }) : Promise.resolve(),
      userBulkOps.length ? User.bulkWrite(userBulkOps, { ordered: false }) : Promise.resolve(),
      lobBulkOps.length ? Lob.bulkWrite(lobBulkOps, { ordered: false }) : Promise.resolve(),
      carrierBulkOps.length ? Carrier.bulkWrite(carrierBulkOps, { ordered: false }) : Promise.resolve()
    ]);

    // Fetch batch-scoped document IDs into Maps
    const [agents, users, lobs, carriers] = await Promise.all([
      Agent.find({ name: { $in: uniqueAgentNames } }).lean(),
      User.find({ email: { $in: uniqueEmails } }).lean(),
      Lob.find({ name: { $in: uniqueLobNames } }).lean(),
      Carrier.find({ name: { $in: uniqueCarrierNames } }).lean()
    ]);

    const agentMap = new Map(agents.map(a => [a.name.toLowerCase(), a._id]));
    const userMap = new Map(users.map(u => [u.email.toLowerCase(), u._id]));
    const lobMap = new Map(lobs.map(l => [l.name.toLowerCase(), l._id]));
    const carrierMap = new Map(carriers.map(c => [c.name.toLowerCase(), c._id]));

    // Account bulk write with userId reference
    const accountBulkOps = [];
    for (const item of validRows) {
      const userId = userMap.get(item.email.toLowerCase());
      if (userId) {
        accountBulkOps.push({
          updateOne: {
            filter: { name: item.accountName, userId },
            update: {
              $set: {
                name: item.accountName,
                type: (item.row.account_type || 'Commercial').trim(),
                userId
              }
            },
            upsert: true
          }
        });
      }
    }

    if (accountBulkOps.length) {
      await Account.bulkWrite(accountBulkOps, { ordered: false });
    }

    const uniqueAccountNames = [...new Set(validRows.map(r => r.accountName))];
    const userIds = [...userMap.values()];
    const accounts = await Account.find({ name: { $in: uniqueAccountNames }, userId: { $in: userIds } }).lean();
    const accountMap = new Map(accounts.map(a => [`${a.name.toLowerCase()}_${a.userId}`, a._id]));

    // Prepare Policy Bulk Operations
    const policyBulkOps = [];
    for (const item of validRows) {
      const userId = userMap.get(item.email.toLowerCase());
      const agentId = agentMap.get(item.agentName.toLowerCase());
      const policyCategoryId = lobMap.get(item.categoryName.toLowerCase());
      const companyId = carrierMap.get(item.companyName.toLowerCase());
      const accountId = userId ? accountMap.get(`${item.accountName.toLowerCase()}_${userId}`) : null;

      policyBulkOps.push({
        updateOne: {
          filter: { policyNumber: item.policyNumber },
          update: {
            $set: {
              policyNumber: item.policyNumber,
              policyStartDate: parseExcelDate(item.row.policy_start_date),
              policyEndDate: parseExcelDate(item.row.policy_end_date),
              policyCategoryId,
              companyId,
              userId,
              agentId,
              accountId,
              premiumAmount: parseFloat(item.row.premium_amount) || 0,
              policyType: String(item.row.policy_type || 'Single').trim(),
              policyMode: String(item.row.policy_mode || '').trim()
            }
          },
          upsert: true
        }
      });
    }

    if (policyBulkOps.length) {
      await Policy.bulkWrite(policyBulkOps, { ordered: false });
    }

    const durationMs = Date.now() - startTime;
    parentPort.postMessage({
      status: 'success',
      totalRows: rawRows.length,
      processedRows: validRows.length,
      skippedRows: skippedRows.length,
      errors: skippedRows,
      agentsCount: agentMap.size,
      usersCount: userMap.size,
      accountsCount: accountMap.size,
      lobsCount: lobMap.size,
      carriersCount: carrierMap.size,
      durationMs
    });
  } catch (error) {
    console.error('[Worker Thread Error]', error);
    parentPort.postMessage({
      status: 'error',
      error: error.message
    });
  } finally {
    await mongoose.disconnect();
  }
}

processFile();
