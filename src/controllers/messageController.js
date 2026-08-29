const schedulerService = require('../services/schedulerService');
const ScheduledMessage = require('../models/ScheduledMessage');

/**
 * POST /api/messages/schedule
 */
exports.scheduleMessage = async (req, res, next) => {
  try {
    const { message, day, time } = req.body;

    const doc = await schedulerService.scheduleMessage({ message, day, time });

    return res.status(201).json({
      success: true,
      message: 'Message successfully scheduled for database insertion.',
      data: doc
    });
  } catch (error) {
    if (error.message.includes('required') || error.message.includes('Invalid')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

/**
 * GET /api/messages
 */
exports.getScheduledMessages = async (req, res, next) => {
  try {
    const messages = await ScheduledMessage.find().sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    next(error);
  }
};
