const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: {
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
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
    index: true
  },
  gender: {
    type: String,
    default: null
  },
  userType: {
    type: String,
    default: 'Active Client'
  }
}, { 
  timestamps: true,
  collection: 'users'
});

module.exports = mongoose.model('User', userSchema);
