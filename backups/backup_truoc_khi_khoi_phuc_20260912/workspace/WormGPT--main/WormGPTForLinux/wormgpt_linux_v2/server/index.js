import express from 'express';
import cors from 'cors';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { fileURLToPath } from 'url';
import simpleGit from 'simple-git';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

// ── CORS: allow all origins (local use only) ───────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// ── Ollama health state ────────────────────────────────────────────────────
let ollamaHealthy = false;
let ollamaBaseUrl = 'http://localhost:11434';

const checkOllamaHealth = async (base = ollamaBaseUrl) => {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch(`${base}/api/tags`, { signal: ctrl.signal });
    clearTimeout(timeout);
    ollamaHealthy = r.ok;
    return r.ok;
  } catch {
    ollamaHealthy = false;
    return false;
  }
};

// Poll Ollama every 10 seconds for stable reconnection
setInterval(() => checkOllamaHealth(), 10000);
checkOllamaHealth(); // initial check on startup

// ── WebSocket: Terminal & Code Runner ─────────────────────────────────────
wss.on('connection', (ws) => {
  let proc = null;

  const safeSend = (data) => {
    if (ws.readyState === ws.OPEN) {
      try { ws.send(JSON.stringify(data)); } catch {}
    }
  };

  ws.on('message', (raw) => {
    try {
      const { type, code, lang, command, cwd } = JSON.parse(raw.toString());

      if (type === 'run_code') {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wgpt-'));
        let filename, runCmd;

        if (lang === 'python' || lang === 'py') {
          filename = path.join(tmpDir, 'main.py');
          fs.writeFileSync(filename, code);
          runCmd = `python3 "${filename}"`;
        } else if (lang === 'javascript' || lang === 'js') {
          filename = path.join(tmpDir, 'main.js');
          fs.writeFileSync(filename, code);
          runCmd = `node "${filename}"`;
        } else if (lang === 'bash' || lang === 'sh') {
          filename = path.join(tmpDir, 'main.sh');
          fs.writeFileSync(filename, code);
          runCmd = `bash "${filename}"`;
        } else {
          safeSend({ type: 'stderr', data: 'Unsupported language: ' + lang });
          safeSend({ type: 'exit', code: 1 });
          return;
        }

        safeSend({ type: 'start' });
        proc = spawn('sh', ['-c', runCmd], { cwd: tmpDir });

        proc.stdout.on('data', d => safeSend({ type: 'stdout', data: d.toString() }));
        proc.stderr.on('data', d => safeSend({ type: 'stderr', data: d.toString() }));
        proc.on('close', code => {
          safeSend({ type: 'exit', code });
          proc = null;
          try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
        });
        proc.on('error', (err) => {
          safeSend({ type: 'stderr', data: `Process error: ${err.message}` });
          safeSend({ type: 'exit', code: 1 });
          proc = null;
        });

      } else if (type === 'kill') {
        if (proc) { proc.kill('SIGTERM'); proc = null; }

      } else if (type === 'shell') {
        const workDir = cwd || os.homedir();
        proc = spawn('sh', ['-c', command], {
          cwd: fs.existsSync(workDir) ? workDir : os.homedir(),
          env: process.env,
        });
        proc.stdout.on('data', d => safeSend({ type: 'stdout', data: d.toString() }));
        proc.stderr.on('data', d => safeSend({ type: 'stderr', data: d.toString() }));
        proc.on('close', code => { safeSend({ type: 'exit', code }); proc = null; });
        proc.on('error', (err) => {
          safeSend({ type: 'stderr', data: `Shell error: ${err.message}` });
          proc = null;
        });
      }
    } catch (e) {
      safeSend({ type: 'stderr', data: `Parse error: ${e.message}` });
    }
  });

  ws.on('close', () => { if (proc) { try { proc.kill(); } catch {} proc = null; } });
  ws.on('error', () => { if (proc) { try { proc.kill(); } catch {} proc = null; } });
});

// ── Chat API: proxies to Ollama ────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { messages, model, temperature, stream, ollamaUrl } = req.body;
  const base = ollamaUrl || ollamaBaseUrl;

  // Update cached base URL if provided
  if (ollamaUrl) ollamaBaseUrl = ollamaUrl;

  const ctrl = new AbortController();
  // Timeout: 3 minutes for large models
  const timeout = setTimeout(() => ctrl.abort(), 180000);

  try {
    const resp = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'godmoded/llama3-lexi-uncensored',
        messages,
        temperature: temperature ?? 0.7,
        stream: stream !== false,
      }),
      signal: ctrl.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      const errText = await resp.text();
      res.status(resp.status).json({ error: errText });
      return;
    }

    if (stream !== false) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // important for nginx proxies
      res.flushHeaders();

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();

      const cleanup = () => {
        try { reader.cancel(); } catch {}
        clearTimeout(timeout);
      };

      req.on('close', cleanup);

      while (true) {
        const { done, value } = await reader.read();
        if (done) { res.write('data: [DONE]\n\n'); res.end(); break; }

        const text = decoder.decode(value);
        for (const line of text.split('\n').filter(l => l.trim())) {
          try {
            const json = JSON.parse(line);
            res.write(`data: ${JSON.stringify(json)}\n\n`);
            if (json.done) { res.end(); cleanup(); return; }
          } catch {}
        }
      }
    } else {
      clearTimeout(timeout);
      res.json(await resp.json());
    }
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') {
      res.status(408).json({ error: 'Request timeout — model may be loading, try again' });
    } else {
      res.status(500).json({ error: e.message });
    }
  }
});

// ── Ollama Status ──────────────────────────────────────────────────────────
app.get('/api/ollama/status', async (req, res) => {
  const base = req.query.url || ollamaBaseUrl;
  const connected = await checkOllamaHealth(base);
  res.json({ connected, url: base });
});

// ── Ollama Models ──────────────────────────────────────────────────────────
app.get('/api/ollama/models', async (req, res) => {
  const base = req.query.url || ollamaBaseUrl;
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(`${base}/api/tags`, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`Ollama returned ${r.status}`);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(503).json({ error: `Cannot reach Ollama at ${base}: ${e.message}` });
  }
});

// ── Ollama Pull Model ──────────────────────────────────────────────────────
app.post('/api/ollama/pull', async (req, res) => {
  const { model, ollamaUrl } = req.body;
  const base = ollamaUrl || ollamaBaseUrl;
  if (!model) { res.status(400).json({ error: 'model required' }); return; }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const resp = await fetch(`${base}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: true }),
    });
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) { res.write('data: [DONE]\n\n'); res.end(); break; }
      const text = decoder.decode(value);
      for (const line of text.split('\n').filter(l => l.trim())) {
        try { res.write(`data: ${line}\n\n`); } catch {}
      }
    }
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    res.end();
  }
});

// ── Project Upload ─────────────────────────────────────────────────────────
app.post('/api/project/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

    const TEXT_EXTS = ['.js', '.ts', '.tsx', '.jsx', '.py', '.html', '.css', '.json',
      '.md', '.txt', '.sh', '.yaml', '.yml', '.toml', '.rs', '.go',
      '.java', '.cpp', '.c', '.h', '.sql', '.env', '.gitignore'];

    let files = [];
    if (req.file.originalname.endsWith('.zip')) {
      const zip = new AdmZip(req.file.buffer);
      for (const e of zip.getEntries()) {
        if (!e.isDirectory) {
          const ext = path.extname(e.entryName).toLowerCase();
          const isText = TEXT_EXTS.includes(ext) || !ext;
          files.push({
            name: e.entryName,
            content: isText ? e.getData().toString('utf8') : `[binary: ${ext}]`,
            type: isText ? 'text' : 'binary',
          });
        }
      }
    } else {
      files = [{
        name: req.file.originalname,
        content: req.file.buffer.toString('utf8'),
        type: 'text',
      }];
    }
    res.json({ files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Save File ──────────────────────────────────────────────────────────────
app.post('/api/save-file', async (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath) { res.status(400).json({ error: 'path required' }); return; }
    await fsp.writeFile(filePath, content, 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Git API ────────────────────────────────────────────────────────────────
const getGit = (repoPath) => {
  const p = repoPath || process.cwd();
  return simpleGit(fs.existsSync(p) ? p : process.cwd());
};

app.post('/api/git/status', async (req, res) => {
  try { res.json({ status: await getGit(req.body.repoPath).status() }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/git/diff', async (req, res) => {
  try {
    const git = getGit(req.body.repoPath);
    const diff = req.body.file
      ? await git.diff([req.body.file])
      : await git.diff();
    res.json({ diff });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/git/commit', async (req, res) => {
  try {
    const git = getGit(req.body.repoPath);
    if (req.body.files?.length) await git.add(req.body.files);
    else await git.add('.');
    const result = await git.commit(req.body.message || 'WormGPT commit');
    res.json({ result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/git/branch', async (req, res) => {
  try {
    await getGit(req.body.repoPath).checkoutLocalBranch(req.body.name);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Serve React Frontend ───────────────────────────────────────────────────
const distPath = path.join(__dirname, '..', 'app', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_, res) => res.sendFile(path.join(distPath, 'index.html')));
} else {
  app.get('/', (_, res) => res.send(`
    <html><body style="background:#0a0a0a;color:#e94560;font-family:monospace;padding:40px">
    <h2>⚠ Frontend not built yet</h2>
    <p>Run: <code style="background:#111;padding:4px 8px">cd app && npm install && npm run build</code></p>
    </body></html>
  `));
}

// ── Graceful Shutdown ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

const shutdown = (signal) => {
  console.log(`\n🛑 Received ${signal} — shutting down gracefully...`);
  wss.clients.forEach(ws => { try { ws.close(); } catch {} });
  httpServer.close(() => {
    console.log('✅ Server closed.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try: kill $(lsof -t -i:${PORT})`);
    process.exit(1);
  }
});
process.on('unhandledRejection', (reason) => {
  console.error('⚠ Unhandled rejection:', reason);
});

// ── Start ──────────────────────────────────────────────────────────────────
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🐛 WormGPT Server  →  http://localhost:${PORT}`);
  console.log(`📡 WebSocket       →  ws://localhost:${PORT}`);
  console.log(`📁 Serving dist    →  ${fs.existsSync(distPath) ? distPath : '⚠ not built yet (run install first)'}`);
  console.log(`\n   Password: Realnojokepplwazy1234\n`);
});
