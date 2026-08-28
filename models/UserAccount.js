const mongoose = require('mongoose');

const userAccountSchema = new mongoose.Schema({
  account_name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  }
}, { timestamps: true });

module.exports = mongoose.model('UserAccount', userAccountSchema);
