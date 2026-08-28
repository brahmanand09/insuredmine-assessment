const schedule = require('node-schedule');
const ScheduledMessage = require('../models/ScheduledMessage');

/**
 * Parse day and time strings into a JS Date object.
 * Examples for day: "2026-08-30", "today", "tomorrow", "monday", "2026-09-01"
 * Examples for time: "14:30", "09:15", "2:30 PM", "15:00:00"
 */
function parseDayAndTime(dayStr, timeStr) {
  let targetDate = new Date();

  const now = new Date();
  const lowerDay = String(dayStr || '').trim().toLowerCase();

  if (lowerDay === 'today' || !dayStr) {
    targetDate = new Date(now);
  } else if (lowerDay === 'tomorrow') {
    targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + 1);
  } else {
    // Check if weekday name (e.g. monday)
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayIndex = weekdays.indexOf(lowerDay);
    if (dayIndex !== -1) {
      targetDate = new Date(now);
      const currentDay = targetDate.getDay();
      let distance = dayIndex - currentDay;
      if (distance <= 0) distance += 7; // next occurrence
      targetDate.setDate(targetDate.getDate() + distance);
    } else {
      // Try YYYY-MM-DD or full date
      const parsedDate = new Date(dayStr);
      if (!isNaN(parsedDate.getTime())) {
        targetDate = parsedDate;
      }
    }
  }

  // Parse time
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

async function scheduleMessagePosting({ message, day, time }) {
  const scheduledFor = parseDayAndTime(day, time);
  const now = new Date();

  // Create record in database
  const doc = await ScheduledMessage.create({
    message,
    day: String(day),
    time: String(time),
    scheduledFor,
    status: 'scheduled'
  });

  // If time is in past or within 1 second, insert immediately
  if (scheduledFor.getTime() <= now.getTime() + 1000) {
    await executeInsert(doc._id);
  } else {
    // Schedule job using node-schedule
    schedule.scheduleJob(doc._id.toString(), scheduledFor, async () => {
      await executeInsert(doc._id);
    });
    console.log(`[Schedule Service] Message scheduled for ID: ${doc._id} at ${scheduledFor.toISOString()}`);
  }

  return doc;
}

async function executeInsert(messageId) {
  try {
    const doc = await ScheduledMessage.findById(messageId);
    if (!doc || doc.status === 'inserted') return;

    doc.status = 'inserted';
    doc.insertedAt = new Date();
    await doc.save();

    console.log(`[SCHEDULED JOB COMPLETED] Inserted message to DB at scheduled time: "${doc.message}" (ID: ${doc._id})`);
  } catch (error) {
    console.error(`[Schedule Service Error] Failed to execute scheduled insert for ID ${messageId}:`, error.message);
    await ScheduledMessage.findByIdAndUpdate(messageId, { status: 'failed' });
  }
}

// Restore pending scheduled jobs on server restart
async function restorePendingSchedules() {
  try {
    const pendingJobs = await ScheduledMessage.find({ status: 'scheduled' });
    const now = new Date();

    for (const job of pendingJobs) {
      if (job.scheduledFor.getTime() <= now.getTime()) {
        await executeInsert(job._id);
      } else {
        schedule.scheduleJob(job._id.toString(), job.scheduledFor, async () => {
          await executeInsert(job._id);
        });
      }
    }
    if (pendingJobs.length > 0) {
      console.log(`[Schedule Service] Restored ${pendingJobs.length} pending scheduled tasks from DB.`);
    }
  } catch (err) {
    console.error('[Schedule Service Restoration Error]', err.message);
  }
}

module.exports = {
  scheduleMessagePosting,
  restorePendingSchedules,
  parseDayAndTime
};
