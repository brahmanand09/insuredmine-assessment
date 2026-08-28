const mongoose = require('mongoose');

const scheduledMessageSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
    trim: true
  },
  day: {
    type: String,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  scheduledFor: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'inserted', 'failed'],
    default: 'scheduled'
  },
  insertedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('ScheduledMessage', scheduledMessageSchema);
