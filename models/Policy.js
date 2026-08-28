const mongoose = require('mongoose');

const policySchema = new mongoose.Schema({
  policy_number: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  policy_start_date: {
    type: Date,
    default: null
  },
  policy_end_date: {
    type: Date,
    default: null
  },
  category_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PolicyCategory',
    required: true,
    index: true
  },
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PolicyCarrier',
    required: true,
    index: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  account_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserAccount',
    default: null
  },
  agent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    default: null
  },
  premium_amount: {
    type: Number,
    default: 0
  },
  policy_mode: {
    type: String,
    default: ''
  },
  policy_type: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('Policy', policySchema);
