const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  type: {
    type: String,
    default: 'Commercial'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  }
}, { 
  timestamps: true,
  collection: 'accounts'
});

accountSchema.index({ name: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Account', accountSchema);
