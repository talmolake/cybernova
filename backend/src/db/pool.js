// ─────────────────────────────────────────────────────────────
//  db/pool.js
//  Single PostgreSQL connection pool shared across all modules.
//  Every controller imports this file to run queries.
// ─────────────────────────────────────────────────────────────
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'cybernova',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
  // Keep the pool small for a prototype – 5 connections is more than enough
  max: 5,
  idleTimeoutMillis: 30000,
});

// Log connection errors so they are visible in the terminal
pool.on('error', (err) => {
  console.error('[DB] Unexpected connection error:', err.message);
});

module.exports = pool;
