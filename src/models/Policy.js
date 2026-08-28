const mongoose = require('mongoose');

const policySchema = new mongoose.Schema({
  policyNumber: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    index: true
  },
  policyStartDate: {
    type: Date,
    default: null
  },
  policyEndDate: {
    type: Date,
    default: null
  },
  policyCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lob',
    required: true,
    index: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Carrier',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    default: null,
    index: true
  },
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    default: null,
    index: true
  },
  premiumAmount: {
    type: Number,
    default: 0
  },
  policyType: {
    type: String,
    default: 'Single'
  },
  policyMode: {
    type: String,
    default: ''
  }
}, { 
  timestamps: true,
  collection: 'policies'
});

module.exports = mongoose.model('Policy', policySchema);
