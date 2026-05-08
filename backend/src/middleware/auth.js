// ─────────────────────────────────────────────────────────────
//  middleware/auth.js
//  Protects routes by verifying the JWT sent in the
//  Authorization header.
//
//  How to use on any route:
//    const auth = require('../middleware/auth');
//    router.get('/protected', auth, controller.handler);
//
//  The middleware attaches req.user so controllers can
//  access the logged-in user's id, email, and role.
// ─────────────────────────────────────────────────────────────
const jwt  = require('jsonwebtoken');
const pool = require('../db/pool');

module.exports = async (req, res, next) => {
  // 1. Check the Authorization header exists and starts with "Bearer "
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  // 2. Extract the token string after "Bearer "
  const token = header.split(' ')[1];

  try {
    // 3. Verify the token using the same secret used to sign it
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4. Look up the user in the database to confirm they still exist
    const result = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User account not found.' });
    }

    // 5. Attach user info to the request so controllers can use it
    req.user = result.rows[0];
    next(); // move on to the actual route handler

  } catch (err) {
    // jwt.verify throws if the token is expired or tampered with
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
};
