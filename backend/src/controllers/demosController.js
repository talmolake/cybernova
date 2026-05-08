// ─────────────────────────────────────────────────────────────
//  controllers/demosController.js
//  Handles product demonstration bookings.
//
//  POST  /demos      → book a demo
//  GET   /demos      → get the user's bookings
//  DELETE /demos/:id → cancel a booking
// ─────────────────────────────────────────────────────────────
const pool = require('../db/pool');
const { sendToUser, TEMPLATES } = require('./notificationsController');

// ── POST /demos ────────────────────────────────────────────────────────────
exports.bookDemo = async (req, res) => {
  const { product, bookingDate, bookingTime, notes } = req.body;
  const userId = req.user.id;

  if (!bookingDate || !bookingTime) {
    return res.status(400).json({ error: 'Booking date and time are required.' });
  }

  // Simple date validation – must be today or in the future
  const selectedDate = new Date(bookingDate);
  const today        = new Date();
  today.setHours(0, 0, 0, 0);

  if (selectedDate < today) {
    return res.status(400).json({ error: 'Booking date must be today or a future date.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO demo_bookings (user_id, product, booking_date, booking_time, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, product || 'CyberNova Platform', bookingDate, bookingTime, notes || null]
    );

    await sendToUser(userId, TEMPLATES.DEMO_CONFIRMED(bookingDate, bookingTime));
    return res.status(201).json({
      message:  'Demo booking confirmed.',
      booking:  result.rows[0],
    });

  } catch (err) {
    console.error('[Demos] Book error:', err.message);
    return res.status(500).json({ error: 'Could not book the demo. Please try again.' });
  }
};

// ── GET /demos ─────────────────────────────────────────────────────────────
exports.getMyBookings = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM demo_bookings
       WHERE user_id = $1
       ORDER BY booking_date ASC, booking_time ASC`,
      [req.user.id]
    );
    return res.status(200).json({ bookings: result.rows });
  } catch (err) {
    console.error('[Demos] Get error:', err.message);
    return res.status(500).json({ error: 'Could not retrieve bookings.' });
  }
};

// ── DELETE /demos/:id ──────────────────────────────────────────────────────
exports.cancelBooking = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE demo_bookings SET status = 'cancelled'
      WHERE id = $1 AND user_id = $2
      RETURNING id, status, product, booking_date, user_id`,  // ← this line
      [req.params.id, req.user.id]
    );

   if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found.' });
    }
const formattedDate = new Date(result.rows[0].booking_date).toLocaleDateString();

    sendToUser(result.rows[0].user_id,  TEMPLATES.BOOKING_CANCELLED(
      result.rows[0].product,
      formattedDate
    )).catch(err => console.error('[Demos] Notification error:', err.message));

    return res.status(200).json({ message: 'Booking cancelled.', booking: result.rows[0] });
  } catch (err) {
    console.error('[Demos] Cancel error:', err.message);
    return res.status(500).json({ error: 'Could not cancel the booking.' });
  }
};

exports.markCompleted = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE demo_bookings SET status = 'completed'
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    // Send FCM notification
    sendToUser(result.rows[0].user_id, TEMPLATES.BOOKING_COMPLETED(
      result.rows[0].product,
      String(result.rows[0].booking_date)
    )).catch(err => console.error('[Demos] Notification error:', err.message));

    return res.status(200).json({ message: 'Booking marked as completed.', booking: result.rows[0] });
  } catch (err) {
    console.error('[Demos] Complete error:', err.message);
    return res.status(500).json({ error: 'Could not update the booking.' });
  }
};