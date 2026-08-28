const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    index: true
  }
}, { 
  timestamps: true,
  collection: 'agents'
});

module.exports = mongoose.model('Agent', agentSchema);
