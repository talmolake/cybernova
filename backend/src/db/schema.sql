-- ─────────────────────────────────────────────────────────────
--  CyberNova Database Schema
--  Run this ONCE to set up all tables.
--
--  How to run:
--    1. Open your terminal
--    2. Make sure PostgreSQL is running
--    3. Run:  psql -U postgres -c "CREATE DATABASE cybernova;"
--    4. Then: psql -U postgres -d cybernova -f src/db/schema.sql
-- ─────────────────────────────────────────────────────────────

-- Enable UUID generation (needed for gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
--  USERS
--  Stores all registered customers and staff members.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(100) NOT NULL,
  email        VARCHAR(255) UNIQUE NOT NULL,
  password     VARCHAR(255) NOT NULL,         -- bcrypt hash, never plain text
  phone_number VARCHAR(20),
  interest     VARCHAR(100),
  company      VARCHAR(100),
  country      VARCHAR(100),
  role         VARCHAR(20)  NOT NULL DEFAULT 'customer', -- 'customer' | 'staff' | 'admin'
  firebase_uid VARCHAR(128),                  -- links this record to Firebase Auth
  fcm_token    VARCHAR(255),                  -- device token for push notifications
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
--  CONVERSATIONS (chat sessions)
--  Each row is one chat session started by a user.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  escalated    BOOLEAN     NOT NULL DEFAULT FALSE,
  started_at   TIMESTAMP   NOT NULL DEFAULT NOW(),
  ended_at     TIMESTAMP                        -- NULL means session is still active
);

-- ─────────────────────────────────────────────────────────────
--  MESSAGES
--  Every individual chat message (sent by user, AI, or staff).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender          VARCHAR(10) NOT NULL,  -- 'user' | 'ai' | 'staff'
  content         TEXT        NOT NULL,
  created_at      TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
--  ESCALATIONS
--  Created whenever a conversation is escalated to a human agent.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escalations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trigger_reason  VARCHAR(50) NOT NULL,  -- 'low_confidence' | 'user_request' | 'repeat_query'
  assigned_to     UUID        REFERENCES users(id),  -- staff member (NULL until assigned)
  status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'in_progress' | 'resolved'
  created_at      TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
--  SERVICE REQUESTS
--  Software assistance, sales enquiries, event info requests.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_requests (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,    -- 'software' | 'sales' | 'event' | 'other'
  description TEXT,
  urgency     VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low' | 'medium' | 'high' | 'critical'
  status      VARCHAR(30) NOT NULL DEFAULT 'submitted',
  -- 'submitted' | 'under_review' | 'in_progress' | 'resolved' | 'closed'
  reference   VARCHAR(20) UNIQUE NOT NULL,  -- human-readable e.g. REQ-20260001
  created_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
--  DEMO BOOKINGS
--  Product demonstration scheduling.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS demo_bookings (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product      VARCHAR(100),           -- which product the demo is for
  booking_date DATE        NOT NULL,
  booking_time TIME        NOT NULL,
  notes        TEXT,
  status       VARCHAR(20) NOT NULL DEFAULT 'confirmed', -- 'confirmed' | 'cancelled'
  created_at   TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
--  Indexes – speed up the most common lookups
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_conversation   ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user      ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_user   ON service_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_demo_bookings_user      ON demo_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_escalations_conversation ON escalations(conversation_id);
