const mongoose = require('mongoose');

const scheduledMessageSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
    trim: true
  },
  day: {
    type: String,
    default: ''
  },
  time: {
    type: String,
    default: ''
  },
  scheduledAt: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  completedAt: {
    type: Date,
    default: null
  }
}, { 
  timestamps: true,
  collection: 'scheduled_messages'
});

module.exports = mongoose.model('ScheduledMessage', scheduledMessageSchema);
