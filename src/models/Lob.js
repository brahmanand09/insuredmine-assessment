const mongoose = require('mongoose');

const lobSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    index: true
  }
}, { 
  timestamps: true,
  collection: 'lobs'
});

module.exports = mongoose.model('Lob', lobSchema);
