// ─────────────────────────────────────────────────────────────
//  controllers/notificationsController.js
//  Sends push notifications to users via Firebase Cloud Messaging.
//
//  POST /notifications/send → send a notification to a user
//
//  This controller is called internally by other controllers
//  (e.g., after an escalation, or after a demo is booked).
//  It can also be called directly via the API for testing.
// ─────────────────────────────────────────────────────────────
const admin = require('../config/firebase');
const pool  = require('../db/pool');

// ─────────────────────────────────────────────────────────────
//  NOTIFICATION TEMPLATES
//  Pre-defined messages for each event type.
//  Using templates keeps notifications consistent and
//  avoids constructing strings in multiple places.
// ─────────────────────────────────────────────────────────────
const TEMPLATES = {
  ESCALATION: (conversationId) => ({
    title: 'You are connected with our team',
    body:  'A staff member will review your query and respond shortly.',
    data:  {
      type: 'ESCALATION',
      conversationId: String(conversationId),
      title: 'You are connected with our team',          // ← add these
      body:  'A staff member will review your query and respond shortly.',
    },
  }),
  DEMO_CONFIRMED: (date, time) => ({
    title: 'Demo Booking Confirmed',
    body:  `Your demonstration is scheduled for ${date} at ${time}.`,
    data:  {
      type: 'DEMO_CONFIRMED',
      date: String(date), 
      time: String(time),
      title: 'Demo Booking Confirmed',                   // ← add these
      body:  `Your demonstration is scheduled for ${date} at ${time}.`,
    },
  }),
  REQUEST_UPDATE: (reference, status) => ({
    title: `Request ${reference} Updated`,
    body:  `Your service request status has changed to: ${status}.`,
    data:  {
      type: 'REQUEST_UPDATE',
      reference: String(reference),  
      status:    String(status),
      title: `Request ${reference} Updated`,             // ← add these
      body:  `Your service request status has changed to: ${status}.`,
    },
  }),
 BOOKING_CANCELLED: (product, date) => ({
    title: 'Booking Cancelled',
    body:  `Your demo booking for ${product} has been cancelled.`,
    data:  {
      type:    'BOOKING_CANCELLED',
      product: String(product),
      date:    String(date),
      title:   'Booking Cancelled',
      body:    `Your demo booking for ${product} has been cancelled.`,
    },
  }),

  BOOKING_COMPLETED: (product, date) => ({
    title: 'Demo Marked as Completed',
    body:  `Your demo for ${product} on ${date} has been marked as completed.`,
    data:  {
      type:    'BOOKING_COMPLETED',
      product: String(product), 
      date: String(date), 
      title:   'Demo Marked as Completed',
      body:    `Your demo for ${product} on ${date} has been marked as completed.`,
    },
  }),

  REQUEST_UPDATED: (reference) => ({
    title: 'Request Updated',
    body:  `Your request ${reference} has been updated successfully.`,
    data:  {
      type:      'REQUEST_UPDATED',
      reference,
      title:     'Request Updated',
      body:      `Your request ${reference} has been updated successfully.`,
    },
  }),

  REQUEST_CANCELLED: (reference) => ({
    title: 'Request Closed',
    body:  `Your request ${reference} has been closed.`,
    data:  {
      type:      'REQUEST_CANCELLED',
      reference,
      title:     'Request Closed',
      body:      `Your request ${reference} has been closed.`,
    },
  }),

  };
// ─────────────────────────────────────────────────────────────
//  Core send function
//  Used internally – not exposed as an API route directly.
// ─────────────────────────────────────────────────────────────
async function sendToUser(userId, { title, body, data = {} }) {
  try {
    // Look up the user's FCM device token
    const result = await pool.query(
      'SELECT fcm_token FROM users WHERE id = $1',
      [userId]
    );

    const fcmToken = result.rows[0]?.fcm_token;
    if (!fcmToken) {
      console.warn(`[Notifications] No FCM token found for user ${userId} – skipping push.`);
      return { sent: false, reason: 'no_token' };
    }

    // Build the FCM message
    const message = {
      token: fcmToken,
      notification: { title, body },
      data,
      // Android: high priority ensures the notification wakes the screen
      android: { priority: 'high' },
      // iOS: default notification sound
      apns: { payload: { aps: { sound: 'default' } } },
    };

    const response = await admin.messaging().send(message);
    console.log(`[Notifications] Sent to user ${userId}:`, response);
    return { sent: true, response };

  } catch (err) {
    console.error('[Notifications] Send error:', err.message);
    return { sent: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────
//  POST /notifications/send
//  Manual trigger (useful for testing or staff-initiated alerts).
// ─────────────────────────────────────────────────────────────
exports.sendNotification = async (req, res) => {
  const { userId, type, conversationId, date, time, reference, status } = req.body;

  if (!userId || !type) {
    return res.status(400).json({ error: 'userId and type are required.' });
  }

  // Pick the right template
  let template;
  switch (type) {
    case 'ESCALATION':      template = TEMPLATES.ESCALATION(conversationId);       break;
    case 'DEMO_CONFIRMED':  template = TEMPLATES.DEMO_CONFIRMED(date, time);        break;
    case 'REQUEST_UPDATE':  template = TEMPLATES.REQUEST_UPDATE(reference, status); break;
    default:
      return res.status(400).json({ error: `Unknown notification type: ${type}` });
  }

  const result = await sendToUser(userId, template);
  return res.status(200).json(result);
};

// Export sendToUser so other controllers can use it directly
exports.sendToUser = sendToUser;
exports.TEMPLATES  = TEMPLATES;
