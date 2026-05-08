// ─────────────────────────────────────────────────────────────
//  server.js
//  The main entry point for the CyberNova backend.
//  Loads environment variables, sets up middleware,
//  mounts all routes, and starts listening on the chosen port.
// ─────────────────────────────────────────────────────────────
require('dotenv').config(); // Load .env BEFORE anything else

const express = require('express');
const cors    = require('cors');

// Import all route modules
const authRoutes          = require('./routes/authRoutes');
const chatRoutes          = require('./routes/chatRoutes');
const requestsRoutes      = require('./routes/requestsRoutes');
const demosRoutes         = require('./routes/demosRoutes');
const notificationsRoutes = require('./routes/notificationsRoutes');

// Initialise Firebase Admin SDK at startup
require('./config/firebase');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Global middleware ──────────────────────────────────────────────────────
// cors() allows the React Native app to make requests to this server
app.use(cors());
// express.json() parses incoming JSON request bodies
app.use(express.json());

// ── Simple request logger (helpful during development) ─────────────────────
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── Mount routes ───────────────────────────────────────────────────────────
// Each prefix maps to its own router file
app.use('/auth',          authRoutes);
app.use('/chat',          chatRoutes);
app.use('/requests',      requestsRoutes);
app.use('/demos',         demosRoutes);
app.use('/notifications', notificationsRoutes);

// ── Health check ───────────────────────────────────────────────────────────
// Call GET /health to confirm the server is running
app.get('/health', (_req, res) => {
  res.json({
    status: 'CyberNova API is running',
    time:   new Date().toISOString(),
    port:   PORT,
  });
});

// ── 404 handler ────────────────────────────────────────────────────────────
// Catches any request that did not match a registered route
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ── Global error handler ───────────────────────────────────────────────────
// Catches any error thrown by a controller that was not handled locally
app.use((err, _req, res, _next) => {
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

// ── Start the server ───────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ✅  CyberNova backend is running');
  console.log(`  🌐  http://localhost:${PORT}`);
  console.log(`  🔍  Health: http://localhost:${PORT}/health`);
  console.log('');
});
