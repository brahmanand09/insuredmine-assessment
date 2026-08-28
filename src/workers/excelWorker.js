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

    const agentBulkOps = [];
    const userBulkOps = [];
    const accountBulkOps = [];
    const lobBulkOps = [];
    const carrierBulkOps = [];

    const validRows = [];
    let skippedRowsCount = 0;

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];

      // Row validation: check required fields
      const firstname = (row.firstname || row.user || '').trim();
      const policyNumber = (row.policy_number || '').trim();

      if (!firstname && !policyNumber) {
        skippedRowsCount++;
        continue;
      }

      const agentName = (row.agent || 'Unknown Agent').trim();
      const email = (row.email || `${firstname.toLowerCase().replace(/\s+/g, '')}@placeholder.com`).trim().toLowerCase();
      const accountName = (row.account_name || `${firstname}'s Account`).trim();
      const categoryName = (row.category_name || 'General').trim();
      const companyName = (row.company_name || 'Default Carrier').trim();

      validRows.push({
        row,
        agentName,
        firstname,
        email,
        accountName,
        categoryName,
        companyName,
        policyNumber: policyNumber || `POL-${Date.now()}-${i}`
      });

      // Prepare Bulk Upsert Operations
      agentBulkOps.push({
        updateOne: {
          filter: { name: agentName },
          update: { $setOnInsert: { name: agentName } },
          upsert: true
        }
      });

      userBulkOps.push({
        updateOne: {
          filter: { email },
          update: {
            $set: {
              firstName: firstname,
              dob: parseExcelDate(row.dob),
              address: (row.address || '').trim(),
              phone: String(row.phone || '').trim(),
              state: (row.state || '').trim(),
              zip: String(row.zip || '').trim(),
              gender: row.gender ? String(row.gender).trim() : null,
              userType: (row.userType || 'Active Client').trim()
            }
          },
          upsert: true
        }
      });

      lobBulkOps.push({
        updateOne: {
          filter: { name: categoryName },
          update: { $setOnInsert: { name: categoryName } },
          upsert: true
        }
      });

      carrierBulkOps.push({
        updateOne: {
          filter: { name: companyName },
          update: { $setOnInsert: { name: companyName } },
          upsert: true
        }
      });
    }

    // Execute Bulk Write for references concurrently
    await Promise.all([
      agentBulkOps.length ? Agent.bulkWrite(agentBulkOps, { ordered: false }) : Promise.resolve(),
      userBulkOps.length ? User.bulkWrite(userBulkOps, { ordered: false }) : Promise.resolve(),
      lobBulkOps.length ? Lob.bulkWrite(lobBulkOps, { ordered: false }) : Promise.resolve(),
      carrierBulkOps.length ? Carrier.bulkWrite(carrierBulkOps, { ordered: false }) : Promise.resolve()
    ]);

    // Fetch generated IDs into Maps
    const [agents, users, lobs, carriers] = await Promise.all([
      Agent.find().lean(),
      User.find().lean(),
      Lob.find().lean(),
      Carrier.find().lean()
    ]);

    const agentMap = new Map(agents.map(a => [a.name.toLowerCase(), a._id]));
    const userMap = new Map(users.map(u => [u.email.toLowerCase(), u._id]));
    const lobMap = new Map(lobs.map(l => [l.name.toLowerCase(), l._id]));
    const carrierMap = new Map(carriers.map(c => [c.name.toLowerCase(), c._id]));

    // Account bulk write with userId reference
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

    const accounts = await Account.find().lean();
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
      skippedRows: skippedRowsCount,
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
