const scheduleService = require('../services/scheduleService');
const ScheduledMessage = require('../models/ScheduledMessage');

/**
 * Task 2 (2): Post service taking message, day, and time in body parameters
 */
exports.schedulePost = async (req, res) => {
  try {
    const { message, day, time } = req.body;

    if (!message || !day || !time) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters. Please provide "message", "day", and "time" in the request body.'
      });
    }

    const scheduledMessageDoc = await scheduleService.scheduleMessagePosting({ message, day, time });

    return res.status(201).json({
      success: true,
      message: `Message scheduled for DB insertion at target date/time (${scheduledMessageDoc.scheduledFor.toISOString()})`,
      data: scheduledMessageDoc
    });
  } catch (error) {
    console.error('[Schedule Post Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * List all scheduled / inserted messages
 */
exports.getScheduledMessages = async (req, res) => {
  try {
    const messages = await ScheduledMessage.find().sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
