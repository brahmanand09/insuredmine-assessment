const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstname: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  dob: {
    type: Date,
    default: null
  },
  address: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  state: {
    type: String,
    default: ''
  },
  zip: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: '',
    trim: true,
    lowercase: true,
    index: true
  },
  gender: {
    type: String,
    default: ''
  },
  userType: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
