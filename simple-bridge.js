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

// Ricevi messaggi da GPT
app.post('/api/message-claude', (req, res) => {
  const { message, priority = 'normal' } = req.body;

  const newMessage = {
    id: Date.now(),
    from: 'GPT',
    to: 'Claude',
    timestamp: new Date().toISOString(),
    message,
    priority,
    status: 'received'
  };

  messages.push(newMessage);
  console.log('📨 MESSAGGIO RICEVUTO:', newMessage);

  res.json({
    success: true,
    messageId: newMessage.id,
    status: 'Messaggio ricevuto'
  });
});

// Vedi tutti i messaggi
app.get('/api/messages', (req, res) => {
  res.json({
    count: messages.length,
    messages
  });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║   🤖 SIMPLE GPT-CLAUDE BRIDGE              ║
║   Port: ${PORT}                             ║
╚════════════════════════════════════════════╝

Endpoints:
  GET  /api/status         - Check status
  POST /api/message-claude - Send message
  GET  /api/messages       - View all messages
  `);
});