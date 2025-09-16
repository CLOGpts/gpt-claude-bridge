/**
 * 🤖 GPT-CLAUDE COLLABORATION BRIDGE
 * Sistema sicuro per collaborazione AI con approvazione umana
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 7777;
const SECRET_TOKEN = 'gpt-claude-syd-2024';

// 📁 Struttura cartelle sicure
const DIRS = {
  DRAFTS: path.join(__dirname, '../_drafts'),
  APPROVED: path.join(__dirname, '../_approved'),
  REVIEWS: path.join(__dirname, '../_reviews'),
  SANDBOX: path.join(__dirname, '../_sandbox')
};

// Crea cartelle se non esistono
async function initDirectories() {
  for (const dir of Object.values(DIRS)) {
    await fs.mkdir(dir, { recursive: true });
  }
}

// 🔐 Middleware autenticazione - DISABILITATO TEMPORANEAMENTE PER DEBUG
function auth(req, res, next) {
  console.log('🔓 AUTH BYPASSED - Headers:', req.headers);
  console.log('🔓 Body:', req.body);
  next();
  return; // SKIP AUTH FOR DEBUG

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== SECRET_TOKEN) {
    return res.status(401).json({
      error: 'Non autorizzato',
      hint: 'Usa header: Authorization: Bearer ' + SECRET_TOKEN
    });
  }
  next();
}

// 📊 1. STATUS - Verifica che il sistema funzioni
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    capabilities: [
      'read-files',
      'write-drafts',
      'analyze-code',
      'propose-changes',
      'communicate-claude'
    ]
  });
});

// 📖 2. LEGGI FILE - Per analizzare il codice esistente
app.post('/api/read', auth, async (req, res) => {
  try {
    const { filepath } = req.body;

    // Sicurezza: previeni path traversal
    if (filepath.includes('..')) {
      return res.status(400).json({ error: 'Path non valido' });
    }

    const fullPath = path.join(__dirname, '..', filepath);
    const content = await fs.readFile(fullPath, 'utf-8');

    res.json({
      success: true,
      filepath,
      content,
      lines: content.split('\n').length
    });
  } catch (error) {
    res.status(404).json({
      error: 'File non trovato',
      path: req.body.filepath
    });
  }
});

// 📁 3. LISTA FILES - Per esplorare il progetto
app.post('/api/list', auth, async (req, res) => {
  try {
    const { directory = 'src' } = req.body;

    // Sicurezza
    if (directory.includes('..')) {
      return res.status(400).json({ error: 'Path non valido' });
    }

    const fullPath = path.join(__dirname, '..', directory);
    const files = await fs.readdir(fullPath);

    const details = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(fullPath, file);
        const stats = await fs.stat(filePath);
        return {
          name: file,
          type: stats.isDirectory() ? 'directory' : 'file',
          size: stats.size
        };
      })
    );

    res.json({
      success: true,
      directory,
      files: details
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✍️ 4. CREA BOZZA - Scrivi documentazione/codice in draft
app.post('/api/draft', auth, async (req, res) => {
  try {
    const { filename, content, type = 'documentation' } = req.body;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const draftName = `${timestamp}_${filename}`;
    const draftPath = path.join(DIRS.DRAFTS, type, draftName);

    // Crea sottocartella per tipo
    await fs.mkdir(path.dirname(draftPath), { recursive: true });

    // Salva bozza
    await fs.writeFile(draftPath, content);

    // Crea entry per review
    const reviewEntry = {
      id: Date.now(),
      draftPath: draftPath.replace(__dirname + '/../', ''),
      filename,
      type,
      timestamp,
      status: 'pending_review',
      gptNotes: req.body.notes || ''
    };

    // Salva in coda review
    const reviewPath = path.join(DIRS.REVIEWS, 'queue.json');
    let queue = [];
    try {
      const existing = await fs.readFile(reviewPath, 'utf-8');
      queue = JSON.parse(existing);
    } catch {
      // File non esiste ancora
    }
    queue.push(reviewEntry);
    await fs.writeFile(reviewPath, JSON.stringify(queue, null, 2));

    res.json({
      success: true,
      message: 'Bozza creata e in attesa di review',
      draftId: reviewEntry.id,
      path: draftPath.replace(__dirname + '/../', '')
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 💡 5. PROPONI CAMBIAMENTO - Suggerisci modifiche con analisi
app.post('/api/propose', auth, async (req, res) => {
  try {
    const {
      targetFile,
      proposedChanges,
      reasoning,
      impact,
      priority = 'medium'
    } = req.body;

    const proposal = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      targetFile,
      proposedChanges,
      reasoning,
      impact,
      priority,
      status: 'pending_claude_review',
      gptAnalysis: {
        benefits: req.body.benefits || [],
        risks: req.body.risks || [],
        alternativeSolutions: req.body.alternatives || []
      }
    };

    // Salva proposta
    const proposalPath = path.join(DIRS.REVIEWS, `proposal_${proposal.id}.json`);
    await fs.writeFile(proposalPath, JSON.stringify(proposal, null, 2));

    // Notifica per Claude
    const notification = {
      type: 'new_proposal',
      proposalId: proposal.id,
      priority,
      message: `GPT propone modifiche a ${targetFile}`,
      timestamp: new Date().toISOString()
    };

    const notifPath = path.join(__dirname, '../Database/comunicazioni/gpt-notifications.json');
    let notifs = [];
    try {
      const existing = await fs.readFile(notifPath, 'utf-8');
      notifs = JSON.parse(existing);
    } catch {
      // Prima notifica
    }
    notifs.push(notification);
    await fs.writeFile(notifPath, JSON.stringify(notifs, null, 2));

    res.json({
      success: true,
      message: 'Proposta inviata per review',
      proposalId: proposal.id,
      nextStep: 'Claude analizzerà e aggiungerà valutazione tecnica'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔍 6. ANALIZZA COMPONENTE - Analisi approfondita
app.post('/api/analyze', auth, async (req, res) => {
  try {
    const { componentPath } = req.body;

    const fullPath = path.join(__dirname, '..', componentPath);
    const content = await fs.readFile(fullPath, 'utf-8');

    // Analisi base del codice
    const analysis = {
      path: componentPath,
      stats: {
        lines: content.split('\n').length,
        characters: content.length,
        functions: (content.match(/function\s+\w+|const\s+\w+\s*=\s*\(/g) || []).length,
        imports: (content.match(/import\s+.+\s+from/g) || []).length,
        exports: (content.match(/export\s+/g) || []).length
      },
      react: {
        hasState: content.includes('useState'),
        hasEffect: content.includes('useEffect'),
        hasContext: content.includes('useContext'),
        isComponent: /function\s+[A-Z]\w+|const\s+[A-Z]\w+\s*=/.test(content)
      },
      typescript: {
        hasTypes: content.includes('interface') || content.includes('type '),
        hasGenerics: /<\w+>/.test(content),
        hasEnums: content.includes('enum ')
      },
      suggestions: []
    };

    // Suggerimenti automatici
    if (!analysis.typescript.hasTypes && componentPath.endsWith('.tsx')) {
      analysis.suggestions.push('Considera di aggiungere TypeScript types');
    }
    if (analysis.stats.lines > 300) {
      analysis.suggestions.push('Componente lungo, considera di dividerlo');
    }
    if (!content.includes('try') && content.includes('async')) {
      analysis.suggestions.push('Aggiungi error handling per funzioni async');
    }

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📨 7. MESSAGGIO A CLAUDE - Comunicazione diretta
app.post('/api/message-claude', auth, async (req, res) => {
  try {
    const { message, context, priority = 'normal' } = req.body;

    const communication = {
      id: Date.now(),
      from: 'GPT-Cyber-Assistant',
      to: 'Claude',
      timestamp: new Date().toISOString(),
      message,
      context,
      priority,
      status: 'unread'
    };

    const msgPath = path.join(__dirname, '../Database/comunicazioni/gpt-claude-messages.json');
    let messages = [];
    try {
      const existing = await fs.readFile(msgPath, 'utf-8');
      messages = JSON.parse(existing);
    } catch {
      // Primo messaggio
    }
    messages.push(communication);
    await fs.writeFile(msgPath, JSON.stringify(messages, null, 2));

    res.json({
      success: true,
      messageId: communication.id,
      status: 'Messaggio inviato a Claude'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📊 8. STATO REVIEW - Controlla stato delle proposte
app.get('/api/review-status/:id', auth, async (req, res) => {
  try {
    const proposalPath = path.join(DIRS.REVIEWS, `proposal_${req.params.id}.json`);
    const proposal = JSON.parse(await fs.readFile(proposalPath, 'utf-8'));

    res.json({
      success: true,
      proposal
    });
  } catch (error) {
    res.status(404).json({ error: 'Proposta non trovata' });
  }
});

// 🚀 AVVIA SERVER
app.listen(PORT, async () => {
  await initDirectories();
  console.log(`
╔════════════════════════════════════════════════════╗
║                                                    ║
║   🤖 GPT-CLAUDE COLLABORATION BRIDGE               ║
║                                                    ║
║   Status: ONLINE                                   ║
║   Port: ${PORT}                                      ║
║   Token: ${SECRET_TOKEN}                   ║
║                                                    ║
╚════════════════════════════════════════════════════╝

Endpoints disponibili:

  GET  /api/status           - Verifica sistema
  POST /api/read             - Leggi file
  POST /api/list             - Lista files
  POST /api/draft            - Crea bozza
  POST /api/propose          - Proponi modifiche
  POST /api/analyze          - Analizza componente
  POST /api/message-claude   - Manda messaggio
  GET  /api/review-status/:id - Stato proposta

Cartelle di lavoro create:
  _drafts/    - Bozze GPT
  _reviews/   - Proposte in review
  _approved/  - Approvate
  _sandbox/   - Test sicuri
  `);
});

module.exports = app;