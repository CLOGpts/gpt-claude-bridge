const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7777;

// Coda messaggi da GPT a Claude
let gptQueue = [];
// Risposte da Claude a GPT
let claudeResponses = [];

// GPT legge i messaggi in coda per Claude
app.get('/api/gpt/queue', (req, res) => {
  res.json({
    success: true,
    messages: gptQueue,
    count: gptQueue.length
  });
});

// GPT aggiunge un messaggio alla coda (simulato come GET con query)
app.get('/api/gpt/add', (req, res) => {
  const { message, priority = 'normal' } = req.query;

  if (!message) {
    return res.json({ success: false, error: 'Message required' });
  }

  const newMessage = {
    id: Date.now(),
    from: 'GPT',
    message: decodeURIComponent(message),
    priority,
    timestamp: new Date().toISOString(),
    status: 'pending'
  };

  gptQueue.push(newMessage);

  res.json({
    success: true,
    messageId: newMessage.id,
    queueLength: gptQueue.length
  });
});

// Claude prende i messaggi dalla coda
app.get('/api/claude/poll', (req, res) => {
  const pending = gptQueue.filter(m => m.status === 'pending');

  if (pending.length > 0) {
    // Marca come "processing"
    pending.forEach(m => m.status = 'processing');
  }

  res.json({
    messages: pending,
    count: pending.length
  });
});

// Claude risponde a un messaggio
app.post('/api/claude/respond', express.json(), (req, res) => {
  const { messageId, response } = req.body;

  // Trova il messaggio originale
  const originalMessage = gptQueue.find(m => m.id === messageId);
  if (originalMessage) {
    originalMessage.status = 'responded';

    // Salva la risposta
    claudeResponses.push({
      id: Date.now(),
      messageId,
      originalMessage: originalMessage.message,
      response,
      timestamp: new Date().toISOString()
    });
  }

  res.json({ success: true });
});

// GPT legge le risposte di Claude
app.get('/api/gpt/responses', (req, res) => {
  res.json({
    responses: claudeResponses,
    count: claudeResponses.length
  });
});

// Status generale
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    version: '2.0.0',
    queued: gptQueue.filter(m => m.status === 'pending').length,
    processing: gptQueue.filter(m => m.status === 'processing').length,
    responded: claudeResponses.length,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║   🔄 ASYNC GPT-CLAUDE BRIDGE               ║
║   Port: ${PORT}                             ║
╚════════════════════════════════════════════╝

FLUSSO:
1. GPT aggiunge messaggi: GET /api/gpt/add?message=xxx
2. Claude legge: GET /api/claude/poll
3. Claude risponde: POST /api/claude/respond
4. GPT legge risposte: GET /api/gpt/responses

Status: GET /api/status
  `);
});