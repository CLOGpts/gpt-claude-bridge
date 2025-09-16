const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7777;

// Memoria temporanea per i messaggi
let messages = [];

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// NUOVO: Ricevi messaggi via GET!
app.get('/api/send', (req, res) => {
  const { message, priority = 'normal' } = req.query;

  if (!message) {
    return res.json({
      success: false,
      error: 'Message required'
    });
  }

  const newMessage = {
    id: Date.now(),
    from: 'GPT',
    to: 'Claude',
    timestamp: new Date().toISOString(),
    message: decodeURIComponent(message),
    priority,
    status: 'received'
  };

  messages.push(newMessage);
  console.log('📨 MESSAGGIO RICEVUTO:', newMessage);

  res.json({
    success: true,
    messageId: newMessage.id,
    status: 'Messaggio ricevuto',
    message: newMessage.message
  });
});

// Vedi tutti i messaggi
app.get('/api/messages', (req, res) => {
  res.json({
    count: messages.length,
    messages
  });
});

// Clear messages
app.get('/api/clear', (req, res) => {
  messages = [];
  res.json({ success: true, status: 'Messages cleared' });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║   🤖 SIMPLE GPT-CLAUDE BRIDGE (GET)        ║
║   Port: ${PORT}                             ║
╚════════════════════════════════════════════╝

Endpoints:
  GET  /api/status   - Check status
  GET  /api/send     - Send message (via query params)
  GET  /api/messages - View all messages
  GET  /api/clear    - Clear all messages

Example: /api/send?message=Hello&priority=high
  `);
});