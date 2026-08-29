const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
    trim: true
  },
  scheduledJobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledMessage',
    default: null
  },
  insertedAt: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true,
  collection: 'messages'
});

module.exports = mongoose.model('Message', messageSchema);
