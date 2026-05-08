# CyberNova — Academic Prototype
### Mobile app | Node.js backend | PostgreSQL | OpenAI | Firebase

---

## Folder Structure

```
cybernova/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── firebase.js          ← Firebase Admin SDK setup
│   │   ├── controllers/
│   │   │   ├── authController.js    ← register, login, profile
│   │   │   ├── chatController.js    ← OpenAI chat + escalation
│   │   │   ├── requestsController.js← service request CRUD
│   │   │   ├── demosController.js   ← demo booking
│   │   │   └── notificationsController.js ← FCM push notifications
│   │   ├── db/
│   │   │   ├── pool.js              ← PostgreSQL connection pool
│   │   │   └── schema.sql           ← Run once to create all tables
│   │   ├── middleware/
│   │   │   └── auth.js              ← JWT verification middleware
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── chatRoutes.js
│   │   │   ├── requestsRoutes.js
│   │   │   ├── demosRoutes.js
│   │   │   └── notificationsRoutes.js
│   │   └── server.js                ← Entry point (port 3000)
│   ├── .env.example                 ← Copy to .env and fill in values
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── screens/
    │   │   ├── LoginScreen.js       ← Login + Registration
    │   │   ├── ChatScreen.js        ← AI chat interface
    │   │   ├── RequestsScreen.js    ← Submit + view service requests
    │   │   ├── BookDemoScreen.js    ← Demo scheduling form
    │   │   └── ProfileScreen.js     ← User profile + logout
    │   └── services/
    │       ├── api.js               ← All backend API calls (axios)
    │       └── AuthContext.js       ← Global login state
    ├── App.js                       ← Navigation setup
    └── package.json
```

---

## STEP 1 — Set Up PostgreSQL

```bash
# Make sure PostgreSQL is installed and running, then:

# 1. Create the database
psql -U postgres -c "CREATE DATABASE cybernova;"

# 2. Run the schema to create all tables
psql -U postgres -d cybernova -f backend/src/db/schema.sql

# Confirm tables were created:
psql -U postgres -d cybernova -c "\dt"
# You should see: users, conversations, messages, escalations, service_requests, demo_bookings
```

---

## STEP 2 — Configure the Backend

```bash
cd backend

# Copy the example env file
cp .env.example .env

# Open .env and fill in:
#   JWT_SECRET      → any long random string
#   DB_PASSWORD     → your PostgreSQL password
#   OPENAI_API_KEY  → from https://platform.openai.com/api-keys
#   FIREBASE_*      → from Firebase Console (see below)
```

### Getting Firebase credentials:
1. Go to https://console.firebase.google.com
2. Select your project (or create one)
3. Click ⚙️ Project Settings → Service Accounts
4. Click **Generate new private key** → download the JSON file
5. Copy the values into your .env:
   - `FIREBASE_PROJECT_ID`  = `project_id` field in the JSON
   - `FIREBASE_CLIENT_EMAIL` = `client_email` field
   - `FIREBASE_PRIVATE_KEY`  = `private_key` field (keep the quotes)

---

## STEP 3 — Run the Backend

```bash
cd backend
npm install
npm run dev        # uses nodemon – restarts automatically on file changes
# OR
npm start          # plain node, no auto-restart
```

Expected output:
```
[Firebase] Admin SDK initialised

  ✅  CyberNova backend is running
  🌐  http://localhost:3000
  🔍  Health: http://localhost:3000/health
```

Test it: open http://localhost:3000/health in your browser. You should see:
```json
{ "status": "CyberNova API is running", "port": 3000 }
```

---

## STEP 4 — Set Up the React Native Frontend

```bash
# Install React Native CLI if you haven't already
npm install -g react-native-cli

# From the frontend folder:
cd frontend
npm install

# For iOS (Mac only):
cd ios && pod install && cd ..
```

### Configure the base URL in api.js:
Open `frontend/src/services/api.js` and set `BASE_URL`:
- Android emulator: `http://10.0.2.2:3000`
- iOS simulator:    `http://localhost:3000`
- Physical device:  `http://YOUR_MACHINE_IP:3000` (find with `ipconfig` / `ifconfig`)

### Run on Android emulator:
```bash
# Start the Metro bundler first
npx react-native start

# Then in a new terminal:
npx react-native run-android
```

### Run on iOS simulator (Mac only):
```bash
npx react-native run-ios
```

---

## API Reference + Postman Tests

### Base URL
```
http://localhost:3000
```

---

### AUTH

#### Register
```
POST /auth/register
Content-Type: application/json

{
  "name":     "Tal Molake",
  "email":    "tal@cybernova.co.bw",
  "password": "Test@1234",
  "company":  "CyberNova",
  "country":  "Botswana"
}
```
Expected response (201):
```json
{
  "message": "Registration successful.",
  "token":   "eyJ...",
  "user":    { "id": "uuid", "name": "Tal Molake", "email": "...", "role": "customer" }
}
```

#### Login
```
POST /auth/login
Content-Type: application/json

{
  "email":    "tal@cybernova.co.bw",
  "password": "Test@1234"
}
```
Copy the `token` from the response — you need it for all other requests.

#### Get my profile (protected)
```
GET /auth/me
Authorization: Bearer YOUR_TOKEN_HERE
```

---

### CHAT

#### Send a message
```
POST /chat
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "message": "What is phishing and how can my business protect against it?"
}
```
Expected response (200):
```json
{
  "conversationId": "uuid",
  "response":       "Phishing is when...",
  "escalated":      false,
  "trigger":        null
}
```

**Test escalation:** Send this message:
```json
{ "message": "I want to speak to a person please" }
```
Expected: `"escalated": true, "trigger": "user_request"`

#### Get chat history
```
GET /chat/history
Authorization: Bearer YOUR_TOKEN_HERE
```

---

### SERVICE REQUESTS

#### Submit a request
```
POST /requests
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "type":        "software",
  "description": "I am experiencing issues with the dashboard loading.",
  "urgency":     "high"
}
```
Expected response includes a reference number like `REQ-20260001`.

#### View my requests
```
GET /requests
Authorization: Bearer YOUR_TOKEN_HERE
```

---

### DEMO BOOKINGS

#### Book a demo
```
POST /demos
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "product":     "CyberNova Threat Monitor",
  "bookingDate": "2026-09-15",
  "bookingTime": "14:30",
  "notes":       "Interested in network monitoring features"
}
```

#### View my bookings
```
GET /demos
Authorization: Bearer YOUR_TOKEN_HERE
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ECONNREFUSED` on login | Backend is not running. Run `npm run dev` in the backend folder. |
| `invalid password` | Password must be 8+ chars, 1 uppercase, 1 special character. |
| OpenAI 401 error | Check `OPENAI_API_KEY` in your `.env` file. |
| Firebase init error | Check `FIREBASE_PRIVATE_KEY` — make sure the quotes are included and `\n` is not escaped. |
| Android: network request failed | Use `10.0.2.2` not `localhost` in `api.js`. |
| `relation "users" does not exist` | Run `schema.sql` again: `psql -U postgres -d cybernova -f backend/src/db/schema.sql` |

---

## Route Summary

| Method | Route | Auth | What it does |
|--------|-------|------|--------------|
| POST | /auth/register | ✗ | Create account |
| POST | /auth/login | ✗ | Login, returns JWT |
| GET | /auth/me | ✓ | Get my profile |
| PATCH | /auth/fcm-token | ✓ | Save push notification token |
| POST | /chat | ✓ | Send message to AI |
| GET | /chat/history | ✓ | Load chat messages |
| POST | /requests | ✓ | Submit service request |
| GET | /requests | ✓ | View my requests |
| PATCH | /requests/:id | ✓ | Update request status |
| POST | /demos | ✓ | Book a demo |
| GET | /demos | ✓ | View my bookings |
| DELETE | /demos/:id | ✓ | Cancel a booking |
| POST | /notifications/send | ✓ | Send push notification |
| GET | /health | ✗ | Server health check |
