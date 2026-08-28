const { Worker } = require('worker_threads');
const path = require('path');
const mongoose = require('mongoose');

const User = require('../models/User');
const Policy = require('../models/Policy');
const Agent = require('../models/Agent');
const PolicyCategory = require('../models/PolicyCategory');
const PolicyCarrier = require('../models/PolicyCarrier');
const UserAccount = require('../models/UserAccount');

/**
 * Task 1 (1): API to upload XLSX/CSV data into MongoDB using worker threads
 */
exports.uploadPolicies = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an XLSX or CSV file.' });
    }

    const filePath = req.file.path;
    const workerScript = path.resolve(__dirname, '../services/worker/excelWorker.js');
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/insuredmine_db';

    console.log(`[Controller] Offloading Excel/CSV parsing to Worker Thread: ${workerScript}`);

    const worker = new Worker(workerScript, {
      workerData: { filePath, mongoUri }
    });

    worker.on('message', (message) => {
      if (message.status === 'success') {
        return res.status(200).json({
          success: true,
          message: 'Data successfully uploaded and ingested into MongoDB collections via Worker Thread!',
          data: message
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Worker thread failed to process file.',
          error: message.error
        });
      }
    });

    worker.on('error', (err) => {
      console.error('[Worker Error Event]', err);
      return res.status(500).json({ success: false, error: err.message });
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker stopped with exit code ${code}`);
      }
    });
  } catch (error) {
    console.error('[Upload Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Task 1 (2): Search API to find policy info with the help of the username / firstname
 */
exports.searchPoliciesByUsername = async (req, res) => {
  try {
    const { username, firstname } = req.query;
    const searchTerm = username || firstname || req.params.username;

    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a username or firstname search query (e.g. ?username=Lura)'
      });
    }

    // Find users matching firstname case-insensitive
    const users = await User.find({
      firstname: { $regex: new RegExp(searchTerm, 'i') }
    });

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No user found matching name "${searchTerm}"`
      });
    }

    const userIds = users.map(u => u._id);

    // Fetch policies for found users with populated collections
    const policies = await Policy.find({ user_id: { $in: userIds } })
      .populate('user_id', 'firstname email phone address state zip userType')
      .populate('category_id', 'category_name')
      .populate('company_id', 'company_name')
      .populate('agent_id', 'name')
      .populate('account_id', 'account_name');

    return res.status(200).json({
      success: true,
      query: searchTerm,
      usersFound: users.length,
      totalPolicies: policies.length,
      data: {
        users,
        policies
      }
    });
  } catch (error) {
    console.error('[Search Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Task 1 (3): API to provide aggregated policy by each user
 */
exports.getAggregatedPoliciesByUser = async (req, res) => {
  try {
    const aggregationPipeline = [
      {
        $group: {
          _id: '$user_id',
          totalPolicies: { $sum: 1 },
          totalPremiumAmount: { $sum: '$premium_amount' },
          policyNumbers: { $push: '$policy_number' },
          categories: { $addToSet: '$category_id' },
          carriers: { $addToSet: '$company_id' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      {
        $unwind: '$userDetails'
      },
      {
        $project: {
          _id: 1,
          userId: '$_id',
          userName: '$userDetails.firstname',
          email: '$userDetails.email',
          phone: '$userDetails.phone',
          userType: '$userDetails.userType',
          totalPolicies: 1,
          totalPremiumAmount: { $round: ['$totalPremiumAmount', 2] },
          policyNumbers: 1,
          categoryCount: { $size: '$categories' },
          carrierCount: { $size: '$carriers' }
        }
      },
      {
        $sort: { totalPolicies: -1, totalPremiumAmount: -1 }
      }
    ];

    const results = await Policy.aggregate(aggregationPipeline);

    return res.status(200).json({
      success: true,
      totalUsersWithPolicies: results.length,
      data: results
    });
  } catch (error) {
    console.error('[Aggregation Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get Collection Stats Overview
 */
exports.getDatabaseOverview = async (req, res) => {
  try {
    const [agentCount, userCount, accountCount, categoryCount, carrierCount, policyCount] = await Promise.all([
      Agent.countDocuments(),
      User.countDocuments(),
      UserAccount.countDocuments(),
      PolicyCategory.countDocuments(),
      PolicyCarrier.countDocuments(),
      Policy.countDocuments()
    ]);

    return res.status(200).json({
      success: true,
      collections: {
        agents: agentCount,
        users: userCount,
        accounts: accountCount,
        categories: categoryCount,
        carriers: carrierCount,
        policies: policyCount
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
