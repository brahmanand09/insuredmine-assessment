const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Agent', agentSchema);
