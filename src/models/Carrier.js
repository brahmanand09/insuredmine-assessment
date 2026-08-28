const mongoose = require('mongoose');

const carrierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    index: true
  }
}, { 
  timestamps: true,
  collection: 'carriers'
});

module.exports = mongoose.model('Carrier', carrierSchema);
