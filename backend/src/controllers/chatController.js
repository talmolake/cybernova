// ─────────────────────────────────────────────────────────────
//  controllers/chatController.js
//  Handles the AI chat flow:
//    1. Receive a message from the user
//    2. Load conversation history (for context)
//    3. Send to OpenAI and get a response
//    4. Check if the response should trigger escalation
//    5. Save both messages to the database
//    6. Return the AI response to the app
//
//  POST /chat         → send a message
//  GET  /chat/history → get all messages for a conversation
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
//  controllers/chatController.js
// ─────────────────────────────────────────────────────────────
const { OpenAI } = require('openai');
const pool = require('../db/pool');
const { sendToUser, TEMPLATES } = require('./notificationsController');

const openai = new OpenAI({
  apiKey:  process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'http://192.168.0.132:3000',
    'X-Title':      'CyberNova',
  },
});

const SYSTEM_PROMPT = `You are CyberNova's AI cybersecurity assistant.
CyberNova Analytics Ltd — a cybersecurity company based in Gaborone, Botswana 
that serves SMEs, financial institutions, and government agencies across Southern Africa.
Your job is to help small business owners, finance teams, and government staff
understand cybersecurity risks and what they can do about them.

You can help customers with:
- Cybersecurity risks and threats explained in simple, everyday language
- Information about CyberNova's products and services including AI-driven threat 
  monitoring, automated risk assessments, predictive system maintenance, and 
  digital infrastructure solutions
- Software assistance queries
- Guiding users to schedule a product demonstration — direct them to the Bookings tab
- Information about upcoming CyberNova events, webinars, and regional summits 
  across Southern Africa
- Basic sales and pricing queries — explain that pricing is tailored per client 
  and a formal quote can be arranged
- Service requests — direct them to the Requests tab in the app

When a user asks about booking a demo, guide them:
1. Tap the "Bookings" tab at the bottom of the app
2. Tap "+ Schedule Booking"
3. Select the product they want demonstrated
4. Choose a date and time
5. Add any notes
6. Tap "Submit" to confirm

When a user asks about submitting a service request, guide them through the process:
1. Tap the "Requests" tab at the bottom of the app
2. Tap "+ New Request" in the top right
3. Select the request type:
   - Software: for technical issues or software assistance
   - Sales: for pricing, packages, or purchasing queries
   - Event: for information about upcoming CyberNova events and webinars
   - Other: for anything else
4. Select urgency level: Low, Medium, High, or Critical
5. Describe their issue or query in detail
6. Tap "Submit Request" to send
They will receive updates on their request status via push notifications.
They can track all their requests in the Requests tab.

You must follow these rules in every response:
1. Use plain, everyday language. Never use unexplained technical jargon.
   If you must use a technical term, explain it immediately in simple words.
2. When explaining a cybersecurity risk, always cover three things:
   - What the risk is
   - Why it matters to the business
   - At least one specific, practical action the user can take right now
3. If you are not confident in your answer, you MUST include this exact phrase:
   "I want to make sure you get the right answer — let me connect you with our team."
   Do NOT guess or make up an answer if you are unsure.
4. Keep responses short and clear — 3 to 5 sentences unless more detail is needed.
5. Always be warm, professional, and reassuring.`;

const AI_UNCERTAINTY_PHRASES = [
  "let me connect you with our team",
  "i'm not confident",
  "i cannot answer that",
  "i don't have enough information",
  "i want to make sure you get the right answer",
];

const USER_ESCALATION_KEYWORDS = [
  'speak to someone', 'talk to a person', 'human agent',
  'real person', 'speak to staff', 'need help', 'escalate',
  'not helpful', 'this is useless', 'connect me',
];

const SALES_REP_PROMPT = `You are Boineelo , a Senior Client Solutions Consultant 
at CyberNova Analytics Ltd, based in Gaborone, Botswana. CyberNova specialises in 
AI-driven cybersecurity monitoring and digital transformation solutions for SMEs, 
financial institutions, and government agencies across Southern Africa.

You are professional, polished, and solution-focused. You listen carefully to what 
the client needs and match them to the right CyberNova solution.

CyberNova's core products you can speak to:
- AI Threat Monitor — real-time AI-powered cyber threat detection and alerts
- Automated Risk Assessment Tool — identifies vulnerabilities across business systems
- Predictive System Maintenance — prevents downtime before it happens
- Digital Infrastructure Prototyping — rapid deployment of secure digital systems
- CyberNova Platform — the full suite combining all of the above

You can assist clients with:
- Understanding which product fits their business size and industry
- Pricing discussions — always clarify that pricing is tailored per client and 
  offer to arrange a formal quote
- Scheduling and arranging product demonstrations — guide them to the Bookings tab
- Information about upcoming CyberNova events, webinars, and regional summits 
  across Southern Africa — guide them to submit an Event request in the Requests tab
- Software assistance queries — guide them to submit a Software request in the Requests tab
- Onboarding and next steps after a client decides to proceed

When a user asks about booking a demo, guide them:
1. Tap the "Bookings" tab at the bottom of the app
2. Tap "+ Schedule Booking"
3. Select the product they want demonstrated
4. Choose a date and time
5. Add any notes
6. Tap "Submit" to confirm

When a user asks about a service request, guide them:
1. Tap the "Requests" tab at the bottom of the app
2. Tap "+ New Request"
3. Select the type: Software, Sales, Event, or Other
4. Set urgency and describe their query
5. Tap "Submit Request"

Rules you must follow:
1. Always be professional, warm and solution-focused
2. Ask clarifying questions to understand the client's industry and specific needs
3. Never make up specific prices — say pricing is tailored and offer a formal quote
4. Always end your response with a clear next step or question
5. Keep responses concise — 3 to 5 sentences maximum
6. If asked something completely outside CyberNova's scope, politely redirect 
   back to how CyberNova can help their business`;

/*7. When you receive a message starting with [SYSTEM:], follow the instructions 
   in it naturally. Introduce yourself as Boineelo, acknowledge the context of 
   what the user was asking about, and offer to help — without mentioning that 
   you received a system instruction. Make it feel like a natural handoff.
8. NEVER introduce yourself again after your first message. Only introduce yourself 
   once at the very beginning. After that, just respond to what the client is saying*/

function detectEscalation(userMessage, aiResponse, consecutiveRepeats) {
  const aiLower   = aiResponse.toLowerCase();
  const userLower = userMessage.toLowerCase();

  if (AI_UNCERTAINTY_PHRASES.some(phrase => aiLower.includes(phrase))) {
    return { shouldEscalate: true, reason: 'low_confidence' };
  }
  if (USER_ESCALATION_KEYWORDS.some(keyword => userLower.includes(keyword))) {
    return { shouldEscalate: true, reason: 'user_request' };
  }
  if (consecutiveRepeats >= 3) {
    return { shouldEscalate: true, reason: 'repeat_query' };
  }
  return { shouldEscalate: false, reason: null };
}

function isSimilarToLastMessage(current, previous) {
  if (!previous) return false;
  const currentWords  = new Set(current.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const previousWords = previous.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const overlap = previousWords.filter(w => currentWords.has(w));
  return overlap.length / Math.max(previousWords.length, 1) > 0.55;
}

const repeatCounters = {};

// ─────────────────────────────────────────────────────────────
//  POST /chat
// ─────────────────────────────────────────────────────────────
exports.sendMessage = async (req, res) => {
  const { message, conversationId } = req.body;
  const userId = req.user.id;

  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message cannot be empty.' });
  }

  try {
    // ── Step 1: Get or create a conversation ────────────────────────────────
    let conversation;

    if (conversationId) {
      const found = await pool.query(
        'SELECT * FROM conversations WHERE id = $1 AND user_id = $2',
        [conversationId, userId]
      );
      conversation = found.rows[0] || null;
    }

    if (!conversation) {
      const created = await pool.query(
        'INSERT INTO conversations (user_id) VALUES ($1) RETURNING *',
        [userId]
      );
      conversation = created.rows[0];
    }

    // ── Step 2: Load message history for context (last 10 messages) ──────────
    const historyResult = await pool.query(
      `SELECT sender, content FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT 10`,
      [conversation.id]
    );
    const history = historyResult.rows;

    // ── Step 3: Save the user's incoming message ─────────────────────────────
    await pool.query(
      'INSERT INTO messages (conversation_id, sender, content) VALUES ($1, $2, $3)',
      [conversation.id, 'user', message]
    );

    // ── Step 4: Check for repeat query ──────────────────────────────────────
    const lastUserMessage = history.filter(m => m.sender === 'user').slice(-1)[0];
    const isRepeat = isSimilarToLastMessage(message, lastUserMessage?.content);

    const counterKey = `conv_${conversation.id}`;
    if (isRepeat) {
      repeatCounters[counterKey] = (repeatCounters[counterKey] || 0) + 1;
    } else {
      repeatCounters[counterKey] = 0;
    }

    // ── Step 5: Build the messages array for OpenAI ──────────────────────────
    const isAlreadyEscalated = conversation.escalated;
    const aiMessagesAfterEscalation = history.filter(m => m.sender === 'ai').length;
    const isBoineelосFirstMessage = isAlreadyEscalated && aiMessagesAfterEscalation === 0;
    const systemPrompt = isAlreadyEscalated ? SALES_REP_PROMPT : SYSTEM_PROMPT;

    const finalSystemPrompt = isAlreadyEscalated && !isBoineelосFirstMessage
  ? systemPrompt + '\n\nIMPORTANT: You have already introduced yourself. Do NOT introduce yourself again. Just respond to the client directly.'
  : systemPrompt;

    const openaiMessages = [
      { role: 'system', content: finalSystemPrompt },
      ...history
        .filter(m => m.sender !== 'system')
        .map(msg => ({
          role:    msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content,
        })),
      { role: 'user', content: message },
    ];

    // ── Step 6: Call the OpenAI API ──────────────────────────────────────────
    const completion = await openai.chat.completions.create({
      model:       'openai/gpt-4o-mini',
      messages:    openaiMessages,
      max_tokens:  500,
      temperature: isAlreadyEscalated ? 0.6 : 0.4,
    });

    const aiResponse = completion.choices[0].message.content;

    // ── Step 7: Save the AI's response ──────────────────────────────────────
    await pool.query(
      'INSERT INTO messages (conversation_id, sender, content) VALUES ($1, $2, $3)',
      [conversation.id, 'ai', aiResponse]
    );

    // ── Step 8: Check escalation rules ──────────────────────────────────────
    const { shouldEscalate, reason } = detectEscalation(
      message,
      aiResponse,
      repeatCounters[counterKey] || 0
    );

    if (shouldEscalate) {
      await pool.query(
        'UPDATE conversations SET escalated = TRUE WHERE id = $1',
        [conversation.id]
      );
      await pool.query(
        `INSERT INTO escalations (conversation_id, user_id, trigger_reason)
         VALUES ($1, $2, $3)`,
        [conversation.id, userId, reason]
      );
      await pool.query(
        'INSERT INTO messages (conversation_id, sender, content) VALUES ($1, $2, $3)',
        [conversation.id, 'system', 'Your chat has been escalated to a CyberNova support representative. They will reach out to you via email or phone shortly.']
      );

       sendToUser(userId, TEMPLATES.ESCALATION(conversation.id))
    .catch(err => console.error('[Chat] Notification error:', err.message));

      console.log(`[Chat] Escalation triggered for conversation ${conversation.id} – reason: ${reason}`);
    }

    // ── Step 9: Return the response ──────────────────────────────────────────
    return res.status(200).json({
      conversationId: conversation.id,
      response:       aiResponse,
      escalated:      shouldEscalate,
      trigger:        shouldEscalate ? reason : null,
    });

  } catch (err) {
    console.error('[Chat] Error message:', err.message);
    console.error('[Chat] Error status:', err.status);
    console.error('[Chat] Error response:', JSON.stringify(err.response?.data || err.response || 'no response'));
    return res.status(500).json({
      error:   'Chat service is temporarily unavailable. Please try again.',
      details: err.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /chat/history
// ─────────────────────────────────────────────────────────────
exports.getHistory = async (req, res) => {
  const userId = req.user.id;
  const { conversationId } = req.query;

  try {
    let query, params, convQuery, convParams;

    if (conversationId) {
      query = `
        SELECT m.sender, m.content, m.created_at
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.id = $1 AND c.user_id = $2
        ORDER BY m.created_at ASC`;
      params = [conversationId, userId];

      convQuery  = 'SELECT id, escalated FROM conversations WHERE id = $1 AND user_id = $2';
      convParams = [conversationId, userId];
    } else {
      query = `
        SELECT m.sender, m.content, m.created_at
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.user_id = $1
        ORDER BY c.started_at DESC, m.created_at ASC
        LIMIT 50`;
      params = [userId];

      convQuery  = 'SELECT id, escalated FROM conversations WHERE user_id = $1 ORDER BY started_at DESC LIMIT 1';
      convParams = [userId];
    }

    const [result, convResult] = await Promise.all([
      pool.query(query, params),
      pool.query(convQuery, convParams),
    ]);

    const conversation = convResult.rows[0];

    return res.status(200).json({
      messages:       result.rows,
      conversationId: conversation?.id    || null,
      escalated:      conversation?.escalated || false,
    });

  } catch (err) {
    console.error('[Chat] History error:', err.message);
    return res.status(500).json({ error: 'Could not load chat history.' });
  }
};

// POST /chat/new
exports.newConversation = async (req, res) => {
  try {
    const result = await pool.query(
      'INSERT INTO conversations (user_id) VALUES ($1) RETURNING id, started_at',
      [req.user.id]
    );
    return res.status(201).json({ conversation: result.rows[0] });
  } catch (err) {
    console.error('[Chat] New conversation error:', err.message);
    return res.status(500).json({ error: 'Could not create conversation.' });
  }
};

// GET /chat/conversations
exports.getConversations = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, started_at, escalated,
        (SELECT content FROM messages
         WHERE conversation_id = conversations.id
         ORDER BY created_at DESC LIMIT 1) AS last_message
       FROM conversations
       WHERE user_id = $1
       ORDER BY started_at DESC`,
      [req.user.id]
    );
    return res.status(200).json({ conversations: result.rows });
  } catch (err) {
    console.error('[Chat] Get conversations error:', err.message);
    return res.status(500).json({ error: 'Could not load conversations.' });
  }
};

//  DELETE /chat/conversations/:id  — delete ONE conversation
exports.deleteConversation = async (req, res) => {
  const userId = req.user.id;
  const convId = req.params.id;   // UUID — keep as string, do NOT parseInt
 
  if (!convId) return res.status(400).json({ error: 'Invalid conversation ID.' });
 
  try {
    const check = await pool.query(
      'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
      [convId, userId]
    );
    if (check.rows.length === 0)
      return res.status(404).json({ error: 'Conversation not found.' });
 
    // Cascade: escalations → messages → conversation
    await pool.query('DELETE FROM escalations  WHERE conversation_id = $1', [convId]);
    await pool.query('DELETE FROM messages      WHERE conversation_id = $1', [convId]);
    await pool.query('DELETE FROM conversations WHERE id = $1',              [convId]);
 
    delete repeatCounters[`conv_${convId}`];
 
    console.log(`[Chat] Conversation ${convId} deleted by user ${userId}`);
    return res.status(200).json({ deleted: true });
  } catch (err) {
    console.error('[Chat] Delete conversation error:', err.message);
    return res.status(500).json({ error: 'Could not delete conversation.' });
  }
};
 
//  DELETE /chat/conversations  — delete ALL conversations
exports.deleteAllConversations = async (req, res) => {
  const userId = req.user.id;
 
  try {
    const convResult = await pool.query(
      'SELECT id FROM conversations WHERE user_id = $1',
      [userId]
    );
    const convIds = convResult.rows.map(r => r.id); // UUIDs — stay as strings
 
    if (convIds.length > 0) {
      // Cast to uuid[] — this is the line that was failing with int[]
      await pool.query(
        'DELETE FROM escalations  WHERE conversation_id = ANY($1::uuid[])', [convIds]
      );
      await pool.query(
        'DELETE FROM messages      WHERE conversation_id = ANY($1::uuid[])', [convIds]
      );
      await pool.query(
        'DELETE FROM conversations WHERE user_id = $1', [userId]
      );
      convIds.forEach(id => delete repeatCounters[`conv_${id}`]);
    }
 
    console.log(`[Chat] All ${convIds.length} conversations deleted for user ${userId}`);
    return res.status(200).json({ deleted: true, count: convIds.length });
  } catch (err) {
    console.error('[Chat] Delete all conversations error:', err.message);
    return res.status(500).json({ error: 'Could not delete conversations.' });
  }
};

// POST /chat/intro
exports.salesRepIntro = async (req, res) => {
  const { conversationId, lastUserMessage } = req.body;
  const userId = req.user.id;

  try {
    const historyResult = await pool.query(
      `SELECT sender, content FROM messages
       WHERE conversation_id = $1
       AND sender != 'system'
       ORDER BY created_at ASC
       LIMIT 10`,
      [conversationId]
    );

    const openaiMessages = [
      { role: 'system', content: SALES_REP_PROMPT },
      ...historyResult.rows.map(msg => ({
        role:    msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content,
      })),
      { 
        role: 'user', 
        content: `[SYSTEM: Introduce yourself as Boineelo once. The user's last message was: "${lastUserMessage}". Acknowledge what they were asking about and offer to help.]`
      },
    ];

    const completion = await openai.chat.completions.create({
      model:       'openai/gpt-4o-mini',
      messages:    openaiMessages,
      max_tokens:  200,
      temperature: 0.6,
    });

    const introResponse = completion.choices[0].message.content;

    // Save as AI message — NOT as a user message
    await pool.query(
      'INSERT INTO messages (conversation_id, sender, content) VALUES ($1, $2, $3)',
      [conversationId, 'ai', introResponse]
    );

    return res.status(200).json({ response: introResponse });

  } catch (err) {
    console.error('[Chat] Intro error:', err.message);
    return res.status(500).json({ error: 'Could not generate intro.' });
  }
};