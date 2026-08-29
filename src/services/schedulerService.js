const schedule = require('node-schedule');
const ScheduledMessage = require('../models/ScheduledMessage');
const Message = require('../models/Message');
const logger = require('../utils/logger');

function calculateTargetDate(dayStr, timeStr) {
  if (!dayStr || !String(dayStr).trim()) {
    throw new Error('Day is required');
  }

  if (!timeStr || !String(timeStr).trim()) {
    throw new Error('Time is required');
  }

  // Parse & Validate time string (e.g. "10:30", "14:45:00", "2:30 PM")
  const timeRegex = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i;
  const match = String(timeStr).trim().match(timeRegex);

  if (!match) {
    throw new Error('Invalid time format. Expected format HH:MM, HH:MM:SS, or HH:MM AM/PM (e.g. 10:30, 14:45, 2:30 PM)');
  }

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = match[3] ? parseInt(match[3], 10) : 0;
  const meridian = match[4] ? match[4].toLowerCase() : null;

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
    throw new Error('Invalid time values. Hours must be 0-23, minutes and seconds must be 0-59');
  }

  if (meridian === 'pm' && hours < 12) hours += 12;
  if (meridian === 'am' && hours === 12) hours = 0;

  let targetDate = new Date();
  const now = new Date();
  const lowerDay = String(dayStr).trim().toLowerCase();

  if (lowerDay === 'today') {
    targetDate = new Date(now);
  } else if (lowerDay === 'tomorrow') {
    targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + 1);
  } else {
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayIndex = weekdays.indexOf(lowerDay);
    if (dayIndex !== -1) {
      targetDate = new Date(now);
      let diff = dayIndex - targetDate.getDay();
      if (diff <= 0) diff += 7;
      targetDate.setDate(targetDate.getDate() + diff);
    } else {
      const parsed = new Date(dayStr);
      if (isNaN(parsed.getTime())) {
        throw new Error('Invalid day/date specified. Expected "today", "tomorrow", a weekday name, or a valid date (YYYY-MM-DD)');
      }
      targetDate = parsed;
    }
  }

  targetDate.setHours(hours, minutes, seconds, 0);

  if (isNaN(targetDate.getTime())) {
    throw new Error('Invalid day/date specified');
  }

  return targetDate;
}

exports.scheduleMessage = async ({ message, day, time }) => {
  if (!message || !String(message).trim()) {
    throw new Error('Message is required');
  }

  const scheduledAt = calculateTargetDate(day, time);
  const now = new Date();

  // Persist scheduled job in MongoDB
  const doc = await ScheduledMessage.create({
    message: String(message).trim(),
    day: String(day).trim(),
    time: String(time).trim(),
    scheduledAt,
    status: 'pending'
  });

  if (scheduledAt.getTime() <= now.getTime() + 1000) {
    await executeJob(doc._id);
  } else {
    schedule.scheduleJob(doc._id.toString(), scheduledAt, async () => {
      await executeJob(doc._id);
    });
    logger.info(`Message scheduled for ${scheduledAt.toISOString()} (ID: ${doc._id})`);
  }

  return doc;
};

/**
 * Atomically claim and execute scheduled job to prevent race conditions across multiple instances
 */
async function executeJob(jobId) {
  try {
    // 1. Atomic Claim: status 'pending' -> 'processing'
    const job = await ScheduledMessage.findOneAndUpdate(
      { _id: jobId, status: 'pending' },
      { $set: { status: 'processing', processingAt: new Date() } },
      { new: true }
    );

    if (!job) {
      return;
    }

    // 2. Insert Message record into DB
    await Message.create({
      message: job.message,
      scheduledJobId: job._id,
      insertedAt: new Date()
    });

    // 3. Mark job as completed
    await ScheduledMessage.updateOne(
      { _id: job._id },
      { $set: { status: 'completed', completedAt: new Date() } }
    );

    logger.info(`[ATOMIC SCHEDULED JOB EXECUTED] Message inserted into DB: "${job.message}" (ID: ${job._id})`);
  } catch (error) {
    logger.error(`[SCHEDULED JOB FAILED] ID: ${jobId}`, error);
    await ScheduledMessage.updateOne({ _id: jobId }, { $set: { status: 'failed' } });
  }
}

exports.restorePendingJobs = async () => {
  try {
    const pendingJobs = await ScheduledMessage.find({ status: 'pending' });
    const now = new Date();

    for (const job of pendingJobs) {
      if (job.scheduledAt.getTime() <= now.getTime()) {
        await executeJob(job._id);
      } else {
        schedule.scheduleJob(job._id.toString(), job.scheduledAt, async () => {
          await executeJob(job._id);
        });
      }
    }
    if (pendingJobs.length > 0) {
      logger.info(`Restored ${pendingJobs.length} pending scheduled tasks from MongoDB.`);
    }
  } catch (error) {
    logger.error('Failed to restore pending scheduled jobs:', error);
  }
};
