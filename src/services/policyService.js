const Agent = require('../models/Agent');
const User = require('../models/User');
const Account = require('../models/Account');
const Lob = require('../models/Lob');
const Carrier = require('../models/Carrier');
const Policy = require('../models/Policy');

exports.searchPoliciesByUsername = async (usernameQuery) => {
  // Search user by firstName (case-insensitive regex)
  const users = await User.find({
    firstName: { $regex: new RegExp(usernameQuery, 'i') }
  });

  if (!users || users.length === 0) {
    return null;
  }

  const userIds = users.map(u => u._id);

  const rawPolicies = await Policy.find({ userId: { $in: userIds } })
    .populate('userId', 'firstName email phone address state zip userType')
    .populate('policyCategoryId', 'name')
    .populate('companyId', 'name')
    .populate('agentId', 'name')
    .populate('accountId', 'name type');

  const mainUser = users[0];

  const formattedPolicies = rawPolicies.map(p => ({
    policyNumber: p.policyNumber,
    startDate: p.policyStartDate ? p.policyStartDate.toISOString().split('T')[0] : null,
    endDate: p.policyEndDate ? p.policyEndDate.toISOString().split('T')[0] : null,
    category: p.policyCategoryId ? p.policyCategoryId.name : 'N/A',
    carrier: p.companyId ? p.companyId.name : 'N/A',
    agent: p.agentId ? p.agentId.name : 'N/A',
    account: p.accountId ? p.accountId.name : 'N/A',
    premiumAmount: p.premiumAmount,
    policyType: p.policyType
  }));

  return {
    user: {
      name: mainUser.firstName,
      email: mainUser.email,
      phone: mainUser.phone,
      address: mainUser.address
    },
    policies: formattedPolicies
  };
};

exports.aggregatePoliciesByUser = async () => {
  const pipeline = [
    {
      $group: {
        _id: '$userId',
        policyCount: { $sum: 1 },
        totalPremium: { $sum: '$premiumAmount' }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: '$user'
    },
    {
      $project: {
        _id: 0,
        userId: '$_id',
        userName: '$user.firstName',
        email: '$user.email',
        policyCount: 1,
        totalPremium: { $round: ['$totalPremium', 2] }
      }
    },
    {
      $sort: { policyCount: -1, totalPremium: -1 }
    }
  ];

  return await Policy.aggregate(pipeline);
};

exports.getCollectionOverview = async () => {
  const [agents, users, accounts, lobs, carriers, policies] = await Promise.all([
    Agent.countDocuments(),
    User.countDocuments(),
    Account.countDocuments(),
    Lob.countDocuments(),
    Carrier.countDocuments(),
    Policy.countDocuments()
  ]);

  return { agents, users, accounts, lobs, carriers, policies };
};
