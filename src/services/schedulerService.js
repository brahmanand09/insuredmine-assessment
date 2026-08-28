const schedule = require('node-schedule');
const ScheduledMessage = require('../models/ScheduledMessage');
const logger = require('../utils/logger');

function calculateTargetDate(dayStr, timeStr) {
  let targetDate = new Date();
  const now = new Date();
  const lowerDay = String(dayStr || '').trim().toLowerCase();

  if (lowerDay === 'today' || !dayStr) {
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
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed;
      }
    }
  }

  // Parse time (e.g. "10:30", "14:45:00", "2:30 PM")
  const timeRegex = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i;
  const match = String(timeStr || '').trim().match(timeRegex);

  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = match[3] ? parseInt(match[3], 10) : 0;
    const meridian = match[4] ? match[4].toLowerCase() : null;

    if (meridian === 'pm' && hours < 12) hours += 12;
    if (meridian === 'am' && hours === 12) hours = 0;

    targetDate.setHours(hours, minutes, seconds, 0);
  }

  return targetDate;
}

exports.scheduleMessage = async ({ message, day, time }) => {
  const scheduledAt = calculateTargetDate(day, time);
  const now = new Date();

  // Persist job in MongoDB
  const doc = await ScheduledMessage.create({
    message,
    day,
    time,
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

async function executeJob(jobId) {
  try {
    const doc = await ScheduledMessage.findById(jobId);
    if (!doc || doc.status === 'completed') return;

    doc.status = 'completed';
    doc.completedAt = new Date();
    await doc.save();

    logger.info(`[SCHEDULED JOB EXECUTED] Message inserted: "${doc.message}" (ID: ${doc._id})`);
  } catch (error) {
    logger.error(`[SCHEDULED JOB FAILED] ID: ${jobId}`, error);
    await ScheduledMessage.findByIdAndUpdate(jobId, { status: 'failed' });
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
