// ─────────────────────────────────────────────────────────────
//  controllers/authController.js
//  Handles user registration and login.
//
//  POST  /auth/register   → create a new account
//  POST  /auth/login      → verify credentials, return JWT
//  GET   /auth/me         → return current user's profile
//  PATCH /auth/fcm-token  → save device push token
// ─────────────────────────────────────────────────────────────
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const pool   = require('../db/pool');

function createToken(userId) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// ── POST /auth/register ────────────────────────────────────────────────────
exports.register = async (req, res) => {
  const { name, email, password, company, country, phone_number, interest } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const passwordOk = (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[!@#$%^&*()\-_=+\[\]{}|;:'",.<>?]/.test(password)
  );
  if (!passwordOk) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters and include one uppercase letter and one special character.',
    });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const hashed = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (name, email, password, company, country, phone_number, interest)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, role`,
      [name, email.toLowerCase(), hashed, company || null, country || null, phone_number || null, interest || null]
    );

    const user  = result.rows[0];
    const token = createToken(user.id);

    return res.status(201).json({
      message: 'Registration successful.',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });

  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
};

// ── POST /auth/login ───────────────────────────────────────────────────────
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user  = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = createToken(user.id);

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });

  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
};

// ── GET /auth/me ───────────────────────────────────────────────────────────
exports.getMe = (req, res) => {
  return res.status(200).json({ user: req.user });
};

// ── PATCH /auth/fcm-token ──────────────────────────────────────────────────
// Called by the mobile app after login to save the device's FCM token.
//
// FIX: Added guard against empty/whitespace token strings — a blank token
// would overwrite a valid one and silently break notifications.
// Also logs the user ID so you can verify it's being called with auth. 
exports.saveFcmToken = async (req, res) => {
  const { fcmToken } = req.body;

  // Guard: reject missing or blank tokens
  if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.trim().length === 0) {
    return res.status(400).json({ error: 'A valid fcmToken is required.' });
  }

  try {
    await pool.query(
      'UPDATE users SET fcm_token = $1 WHERE id = $2',
      [fcmToken.trim(), req.user.id]
    );
    console.log(`[Auth] FCM token saved for user ${req.user.id}`);
    return res.status(200).json({ message: 'Device token saved.' });
  } catch (err) {
    console.error('[Auth] FCM token save error:', err.message);
    return res.status(500).json({ error: 'Could not save device token.' });
  }
};