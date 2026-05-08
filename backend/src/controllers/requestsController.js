const pool = require('../db/pool');
const { sendToUser, TEMPLATES } = require('./notificationsController');

async function generateReference() {
  const year  = new Date().getFullYear();
  const count = await pool.query('SELECT COUNT(*) FROM service_requests');
  const seq   = parseInt(count.rows[0].count) + 1;
  return `REQ-${year}${String(seq).padStart(4, '0')}`;
}

exports.createRequest = async (req, res) => {
  console.log('[Requests] createRequest called, body:', req.body); 
  const { type, description, urgency } = req.body;
  const userId = req.user.id;

  const validTypes = ['software', 'sales', 'event', 'other'];
  if (!type || !validTypes.includes(type)) {
    return res.status(400).json({
      error: `Type is required and must be one of: ${validTypes.join(', ')}.`,
    });
  }

  try {
    const reference = await generateReference();

    const result = await pool.query(
      `INSERT INTO service_requests (user_id, type, description, urgency, reference)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, type, description || null, urgency || 'medium', reference]
    );

    console.log('[Requests] About to send notification to:', userId, 'ref:', reference);

    sendToUser(userId, TEMPLATES.REQUEST_UPDATED(reference))
      .catch(err => console.error('[Requests] Notification error:', err.message));

    return res.status(201).json({
      message:   'Service request submitted successfully.',
      reference: result.rows[0].reference,
      request:   result.rows[0],
    });

  } catch (err) {
    console.error('[Requests] Create error:', err.message);
    return res.status(500).json({ error: 'Could not submit the request. Please try again.' });
  }
};

exports.getMyRequests = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM service_requests
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.status(200).json({ requests: result.rows });
  } catch (err) {
    console.error('[Requests] Get error:', err.message);
    return res.status(500).json({ error: 'Could not retrieve your requests.' });
  }
};

exports.updateRequest = async (req, res) => {
  const { description, urgency, type } = req.body;

  try {
    const result = await pool.query(
      `UPDATE service_requests
       SET description = COALESCE($1, description),
           urgency     = COALESCE($2, urgency),
           type        = COALESCE($3, type)
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [description || null, urgency || null, type || null, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    sendToUser(req.user.id, TEMPLATES.REQUEST_UPDATED(
      result.rows[0].reference
    )).catch(err => console.error('[Requests] Notification error:', err.message));

    return res.status(200).json({ message: 'Request updated.', request: result.rows[0] });
  } catch (err) {
    console.error('[Requests] Update error:', err.message);
    return res.status(500).json({ error: 'Could not update the request.' });
  }
};

exports.updateStatus = async (req, res) => {
  const { id }     = req.params;
  const { status } = req.body;

  const validStatuses = ['submitted', 'under_review', 'in_progress', 'resolved', 'closed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}.` });
  }

  try {
    const result = await pool.query(
      `UPDATE service_requests SET status = $1
       WHERE id = $2
       RETURNING id, reference, status, user_id`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    sendToUser(result.rows[0].user_id, TEMPLATES.REQUEST_UPDATE(
      result.rows[0].reference,
      status
    )).catch(err => console.error('[Requests] Notification error:', err.message));

    return res.status(200).json({ message: 'Status updated.', request: result.rows[0] });
  } catch (err) {
    console.error('[Requests] Update error:', err.message);
    return res.status(500).json({ error: 'Could not update the status.' });
  }
};