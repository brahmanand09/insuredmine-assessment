const mongoose = require('mongoose');

const policyCarrierSchema = new mongoose.Schema({
  company_name: {
    type: String,
    required: true,
    trim: true,
    index: true
  }
}, { timestamps: true });

module.exports = mongoose.model('PolicyCarrier', policyCarrierSchema);
