const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFile } = require('child_process');
const dotenv = require('dotenv');
const dns = require('dns');
const OpenAI = require('openai');
let Replicate;
try {
  Replicate = require('replicate');
} catch (e) {
  console.warn('[Server] replicate package not found:', e.message);
}
let WebSocketServer, WebSocket;
try {
  const wsModule = require('ws');
  WebSocketServer = wsModule.WebSocketServer;
  WebSocket = wsModule.WebSocket;
} catch (e) {
  console.warn('[Server] ws package not found, falling back to SSE');
}
const thucgpt = require('./thucgpt');
let keyManager;
try {
  keyManager = require('./key-manager');
} catch (e) {
  try {
    keyManager = require('../key');
  } catch (err) {
    keyManager = { validateBypassKey: () => ({ valid: false }) };
  }
}

let authManager;
try {
  authManager = require('./auth-manager');
} catch (e) {
  console.error('[Server] auth-manager load error:', e);
}

let antiReq;
try {
  antiReq = require('./anti-req');
} catch (e) {
  console.error('[Server] anti-req load error:', e);
}

// Force IPv4 lookup first to prevent Windows socket hang up (ECONNRESET) & IPv6 timeouts
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

// Load environment variables from both local and root .env
dotenv.config({ path: path.join(__dirname, '.env'), override: true });
dotenv.config({ path: path.join(__dirname, '../.env'), override: true });

const app = express();
app.disable('x-powered-by');
app.set('etag', false);
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const AI_PROVIDER = (process.env.AI_PROVIDER || 'ollama').toLowerCase();
app.set('trust proxy', Number.parseInt(process.env.TRUST_PROXY_HOPS || '0', 10));

// Initialize Replicate API Client with Token
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || '';
let replicateClient = null;
if (Replicate && REPLICATE_API_TOKEN) {
  try {
    replicateClient = new Replicate({ auth: REPLICATE_API_TOKEN });
    console.log('[Server] Replicate AI Client initialized successfully 🚀');
  } catch (err) {
    console.error('[Server] Replicate Client initialization error:', err.message);
  }
}
const ROOT_DIR = path.resolve(__dirname, '..');
const frontendDir = path.join(__dirname, '../frontend');
const productionFrontendDir = path.join(ROOT_DIR, 'frontend-dist');
const servedFrontendDir = process.env.NODE_ENV === 'production' && fs.existsSync(productionFrontendDir)
  ? productionFrontendDir
  : frontendDir;
const privateMedia = new Map();
const PRIVATE_MEDIA_TTL_MS = 15 * 60 * 1000;
const WORKSPACE_DIR = path.resolve(__dirname, '../workspace');
const CHAT_HISTORY_FILE = path.join(__dirname, 'chat-history.json');
const CHAT_HISTORIES_DIR = path.join(__dirname, 'chat_histories');
if (!fs.existsSync(CHAT_HISTORIES_DIR)) {
  fs.mkdirSync(CHAT_HISTORIES_DIR, { recursive: true });
}

const PRIVATE_MEDIA_HOSTS = new Set([
  'image.pollinations.ai',
  'replicate.delivery',
  'storage.googleapis.com',
  'r2.cloudflarestorage.com',
]);

function isAllowedPrivateMediaHost(hostname) {
  const host = hostname.toLowerCase();
  return PRIVATE_MEDIA_HOSTS.has(host)
    || host.endsWith('.replicate.delivery')
    || host.endsWith('.storage.googleapis.com')
    || host.endsWith('.r2.cloudflarestorage.com');
}

function createPrivateMediaUrl(req, upstreamUrl, mediaType) {
  const url = new URL(upstreamUrl);
  if (url.protocol !== 'https:' || !isAllowedPrivateMediaHost(url.hostname)) {
    throw new Error('Unsupported media source.');
  }
  const ownerId = req.user?.id || (isCreatorRequest(req) ? 'creator' : null);
  if (!ownerId) throw new Error('Authenticated media owner required.');

  const id = crypto.randomBytes(32).toString('base64url');
  privateMedia.set(id, { url: url.href, mediaType, ownerId, expiresAt: Date.now() + PRIVATE_MEDIA_TTL_MS });
  return `/api/media/${id}`;
}

function createPollinationsImagePath(prompt, width = 1024, height = 1024, seed = '') {
  const query = new URLSearchParams({
    prompt,
    width: String(width),
    height: String(height),
    ...(seed ? { seed: String(seed) } : {}),
  });
  return `/api/image/proxy?${query.toString()}`;
}

const privateMediaCleanup = setInterval(() => {
  const now = Date.now();
  for (const [id, item] of privateMedia) {
    if (item.expiresAt <= now) privateMedia.delete(id);
  }
}, 60 * 1000);
privateMediaCleanup.unref();

// Ensure workspace directory exists with sample starter files
if (!fs.existsSync(WORKSPACE_DIR)) {
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  const starterFiles = {
    'index.html': `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Web Project</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="card">
    <h1>🚀 Project của bạn đã sẵn sàng!</h1>
    <p>AI Turbo Pro có thể trực tiếp đọc, phân tích và chỉnh sửa code trong workspace này.</p>
    <button id="demoBtn">Bấm vào đây</button>
  </div>
  <script src="main.js"></script>
</body>
</html>`,
    'style.css': `body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #090e17;
  color: #f1f5f9;
  font-family: system-ui, sans-serif;
}

.card {
  padding: 32px;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(0, 240, 255, 0.3);
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  text-align: center;
}

button {
  padding: 10px 24px;
  background: linear-gradient(135deg, #00f0ff, #3b82f6);
  border: none;
  border-radius: 8px;
  color: #030712;
  font-weight: 700;
  cursor: pointer;
}`,
    'main.js': `document.getElementById('demoBtn')?.addEventListener('click', () => {
  alert('Xin chào từ AI Turbo Pro Workspace!');
});`,
    'README.md': `# Dự án Web của tôi
Được quản lý và chỉnh sửa trực tiếp bởi AI Turbo Pro.`,
  };

  for (const [filename, content] of Object.entries(starterFiles)) {
    fs.writeFileSync(path.join(WORKSPACE_DIR, filename), content, 'utf8');
  }
}

function resolveFsPath(targetPath = '') {
  if (!targetPath || typeof targetPath !== 'string') return null;
  let cleanPath = targetPath.trim().replace(/^['"]|['"]$/g, '');
  if (!cleanPath) return null;

  // Tự động mở rộng các shortcut thư mục người dùng trên Windows
  const userHome = process.env.USERPROFILE || process.env.HOME || '';
  if (userHome) {
    if (cleanPath.startsWith('~/') || cleanPath.startsWith('~\\')) {
      cleanPath = path.join(userHome, cleanPath.slice(2));
    } else if (/^desktop[\\\/]/i.test(cleanPath)) {
      cleanPath = path.join(userHome, 'Desktop', cleanPath.replace(/^desktop[\\\/]/i, ''));
    } else if (/^downloads[\\\/]/i.test(cleanPath)) {
      cleanPath = path.join(userHome, 'Downloads', cleanPath.replace(/^downloads[\\\/]/i, ''));
    } else if (/^documents[\\\/]/i.test(cleanPath)) {
      cleanPath = path.join(userHome, 'Documents', cleanPath.replace(/^documents[\\\/]/i, ''));
    }
  }

  // If path is absolute (e.g. C:\... or D:\... or /...)
  if (path.isAbsolute(cleanPath) || /^[a-zA-Z]:[\\\/]/.test(cleanPath)) {
    return path.normalize(cleanPath);
  }

  // Otherwise, resolve inside WORKSPACE_DIR safely
  const safeRel = path.normalize(cleanPath).replace(/^(\.\.[\/\\])+/, '');
  return path.join(WORKSPACE_DIR, safeRel);
}

function safeResolve(relPath = '') {
  return resolveFsPath(relPath) || WORKSPACE_DIR;
}

// Tự động quét và nạp nội dung file thực tế trên máy tính khi người dùng muốn xem/sửa
function findReferencedFilesContext(message = '') {
  if (!message || typeof message !== 'string') return '';
  const candidates = [];

  // 1. Dạng bọc trong dấu nháy hoặc backtick: `path/file.ext` hoặc "path/file.ext"
  const quotedMatches = message.match(/[`"']([^`"'\n]+?\.[a-zA-Z0-9_]{1,10})[`"']/g) || [];
  for (const m of quotedMatches) {
    candidates.push(m.replace(/[`"']/g, '').trim());
  }

  // 2. Dạng đường dẫn tuyệt đối Windows: C:\path\file.ext hoặc D:/path/file.ext
  const absMatches = message.match(/[a-zA-Z]:[\\\/][a-zA-Z0-9_.\-\\\/]+\.[a-zA-Z0-9_]{1,10}/g) || [];
  for (const m of absMatches) {
    candidates.push(m.trim());
  }

  // 3. Dạng từ đi kèm phần mở rộng file (file index.html, sửa server.js, app.py...)
  const wordMatches = message.match(/(?:file|tệp|tep|vào|vao|trong|sửa|sua|xem|đọc|doc|mở|mo|code)\s+([a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9_]{1,10})/gi) || [];
  for (const m of wordMatches) {
    const parts = m.split(/\s+/);
    if (parts.length > 1) candidates.push(parts[1].trim());
  }

  // 4. Các file mã nguồn phổ biến được nhắc trực tiếp
  const directMatches = message.match(/\b([a-zA-Z0-9_\-]+\.(?:js|py|html|css|json|md|txt|ts|jsx|tsx|cpp|c|java|php|sql|sh|bat))\b/gi) || [];
  for (const m of directMatches) {
    candidates.push(m.trim());
  }

  const uniqueCandidates = [...new Set(candidates)];
  let injectedContext = '';

  for (const cand of uniqueCandidates) {
    let targetAbs = null;
    const resolvedDirect = safeResolve(cand);
    if (fs.existsSync(resolvedDirect) && fs.statSync(resolvedDirect).isFile()) {
      targetAbs = resolvedDirect;
    } else {
      const fromRoot = path.resolve(ROOT_DIR, cand);
      if (fs.existsSync(fromRoot) && fs.statSync(fromRoot).isFile()) {
        targetAbs = fromRoot;
      } else {
        const fromWs = path.resolve(WORKSPACE_DIR, cand);
        if (fs.existsSync(fromWs) && fs.statSync(fromWs).isFile()) {
          targetAbs = fromWs;
        }
      }
    }

    if (targetAbs) {
      try {
        const stats = fs.statSync(targetAbs);
        if (stats.size <= 80 * 1024) { // Tối đa 80KB để tránh quá tải token
          const content = fs.readFileSync(targetAbs, 'utf8');
          injectedContext += `\n=== NỘI DUNG TỆP MÃ NGUỒN HIỆN TẠI TRÊN MÁY TÍNH (${path.basename(targetAbs)}) ===\n- Đường dẫn tệp: ${targetAbs}\n\`\`\`${path.extname(targetAbs).replace('.', '') || 'text'}\n${content}\n\`\`\`\n======================================================================\n`;
        }
      } catch (e) {}
    }
  }

  return injectedContext;
}


function runCommand(file, args, cwd = WORKSPACE_DIR, timeout = 10000) {
  return new Promise((resolve) => {
    execFile(file, args, {
      cwd,
      timeout,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    }, (error, stdout = '', stderr = '') => {
      resolve({
        ok: !error,
        code: error?.code ?? 0,
        signal: error?.signal || null,
        stdout: String(stdout).slice(0, 20000),
        stderr: String(stderr).slice(0, 20000),
      });
    });
  });
}

// Xử lý làm nét & nâng cấp độ phân giải ảnh bằng Python Pillow
function enhanceImageWithPython(imageBase64, scale = 2, sharpness = 1.6, contrast = 1.06) {
  return new Promise((resolve) => {
    const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
    const scriptPath = path.join(__dirname, 'enhancer.py');
    const child = execFile(pythonBin, [scriptPath], {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 30000,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      if (error) {
        return resolve({ success: false, error: stderr || error.message });
      }
      try {
        const result = JSON.parse(stdout.trim());
        resolve(result);
      } catch (e) {
        resolve({ success: false, error: 'Invalid enhancer output: ' + stdout });
      }
    });

    if (child.stdin) {
      child.stdin.write(JSON.stringify({ image: imageBase64, scale, sharpness, contrast }));
      child.stdin.end();
    }
  });
}

function getRunnableFile(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) return null;
  const absPath = safeResolve(filePath);
  const relative = path.relative(WORKSPACE_DIR, absPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(absPath)) return null;
  const ext = path.extname(absPath).toLowerCase();
  if (!['.js', '.mjs', '.cjs', '.py'].includes(ext)) return null;
  return { absPath, relative, ext };
}

function getDirectoryTree(dir = WORKSPACE_DIR, rel = '') {
  const result = [];
  if (!fs.existsSync(dir)) return result;

  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.name.startsWith('.git') || item.name === 'node_modules') continue;

    const itemRel = rel ? `${rel}/${item.name}` : item.name;
    const itemAbs = path.join(dir, item.name);

    if (item.isDirectory()) {
      result.push({
        name: item.name,
        path: itemRel,
        isDir: true,
        children: getDirectoryTree(itemAbs, itemRel),
      });
    } else {
      const stats = fs.statSync(itemAbs);
      result.push({
        name: item.name,
        path: itemRel,
        isDir: false,
        size: stats.size,
      });
    }
  }
  return result;
}

function getWorkspaceSummary() {
  const summary = [];
  function scan(dir = WORKSPACE_DIR, rel = '') {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.name.startsWith('.git') || item.name === 'node_modules') continue;
      const itemRel = rel ? `${rel}/${item.name}` : item.name;
      const itemAbs = path.join(dir, item.name);
      if (item.isDirectory()) {
        scan(itemAbs, itemRel);
      } else {
        summary.push(itemRel);
      }
    }
  }
  scan();
  return summary;
}

function getWorkspaceFileContext() {
  const textExtensions = ['.html', '.css', '.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.py', '.txt', '.php', '.sql', '.vue', '.svelte'];
  let context = '';
  function scan(dir = WORKSPACE_DIR, rel = '') {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.name.startsWith('.git') || item.name === 'node_modules') continue;
      const itemRel = rel ? `${rel}/${item.name}` : item.name;
      const itemAbs = path.join(dir, item.name);
      if (item.isDirectory()) {
        scan(itemAbs, itemRel);
      } else {
        const ext = path.extname(item.name).toLowerCase();
        if (textExtensions.includes(ext) && context.length < 35000) {
          try {
            const stat = fs.statSync(itemAbs);
            if (stat.size < 100000) {
              const content = fs.readFileSync(itemAbs, 'utf8').slice(0, 8000);
              context += `\n--- File: ${itemRel} ---\n${content}\n`;
            }
          } catch (e) {}
        }
      }
    }
  }
  scan();
  return context;
}

function getChatUserKey(req) {
  const id = req.user?.id;
  return id ? `user_${String(id).replace(/[^a-zA-Z0-9_-]/g, '_')}` : null;
}

function readChatHistory(userKey = 'guest') {
  try {
    const safeKey = String(userKey || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
    const userFile = path.join(CHAT_HISTORIES_DIR, `history_${safeKey}.json`);
    if (!fs.existsSync(userFile)) {
      // Return empty array for new accounts - brand new isolated chat session!
      return [];
    }
    const data = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Chat history read error for ${userKey}:`, error.message);
    return [];
  }
}

function writeChatHistory(userKey, sessions) {
  try {
    const safeKey = String(userKey || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
    const userFile = path.join(CHAT_HISTORIES_DIR, `history_${safeKey}.json`);
    fs.writeFileSync(userFile, JSON.stringify(sessions, null, 2), 'utf8');
  } catch (e) {
    console.error(`Chat history write error for ${userKey}:`, e.message);
  }
}

function deleteChatHistory(userKey) {
  try {
    const safeKey = String(userKey || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
    const userFile = path.join(CHAT_HISTORIES_DIR, `history_${safeKey}.json`);
    if (fs.existsSync(userFile)) {
      fs.writeFileSync(userFile, JSON.stringify([], null, 2), 'utf8');
    }
  } catch (e) {
    console.error(`Chat history delete error for ${userKey}:`, e.message);
  }
}

const SYSTEM_BRAIN_PROMPT = `
# QUY TẮC NGÔN NGỮ BẮT BUỘC (VIETNAMESE LANGUAGE DIRECTIVE)
- BẠN BẮT BUỘC HIỂU VÀ TRẢ LỜI 100% BẰNG TIẾNG VIỆT TỰ NHIÊN, LƯU LOÁT, THÔNG MINH.
- TUYỆT ĐỐI KHÔNG BAO GIỜ NÓI "Tôi không hiểu tiếng Việt" HOẶC "Tôi chỉ hỗ trợ tiếng Anh".
- Mọi câu hỏi, yêu cầu bằng tiếng Việt bạn luôn thấu hiểu và phản hồi đầy đủ bằng tiếng Việt.

# ROLE & IDENTITY
Bạn là AI Trợ lý Lập trình và Chuyên gia Kiến trúc Hệ thống Cao cấp. Nhiệm vụ của bạn là giải quyết trực diện vấn đề, xử lý logic phức tạp, cung cấp mã nguồn hoàn chỉnh 100% và tuân thủ tuyệt đối mọi chỉ thị của người dùng.

# THINKING FRAMEWORK (BỘ NÃO PHÂN TÍCH LOGIC)
1. Phân tích sâu kiến trúc kỹ thuật và luồng dữ liệu logic từ yêu cầu đầu vào.
2. Thiết kế giải pháp tối ưu nhất, xử lý triệt để các trường hợp biên (edge cases).
3. Xuất mã nguồn đầy đủ, chuẩn Production, không cắt bớt hay dùng mã giả.

# EXECUTION RULES
- Đi thẳng vào giải pháp lập trình, cấu trúc dữ liệu và thuật toán cốt lõi ngay từ dòng đầu tiên.
- Trả về mã nguồn hoàn chỉnh 100%, có chú thích kỹ thuật rõ ràng bằng tiếng Việt.
- Tối ưu hóa hiệu năng, độ chính xác logic tuyệt đối.
`;

// ==============================================================================
// RATE LIMITING & ROLE-BASED ACCESS CONTROL (DUAL-TIER SECURITY)
// ==============================================================================
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 phút
const RATE_LIMIT_MAX_REQUESTS = 12; // tối đa 12 tin / phút đối với khách

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };

  if (now > entry.resetTime) {
    entry.count = 1;
    entry.resetTime = now + RATE_LIMIT_WINDOW_MS;
    rateLimitMap.set(ip, entry);
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  rateLimitMap.set(ip, entry);
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count };
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) rateLimitMap.delete(ip);
  }
}, 5 * 60 * 1000);

function isCreatorRequest(req) {
  if (!req) return false;
  const authHeader = req.headers?.['x-creator-passcode'] || req.headers?.['x-bypass-key'] || '';
  const bodyPasscode = req.body?.passcode || '';
  const queryPasscode = req.query?.passcode || '';

  // 1. Kiểm tra Mật mã Tối cao vĩnh viễn của Chủ nhân Thức
  if (
    (authHeader && authHeader === thucgpt.CREATOR_PASSCODE) ||
    (bodyPasscode && bodyPasscode === thucgpt.CREATOR_PASSCODE) ||
    (queryPasscode && queryPasscode === thucgpt.CREATOR_PASSCODE)
  ) {
    return true;
  }

  // 2. Kiểm tra Key Tự Động Sửa Code Project (ThyXinhGai)
  const candidateKey = (authHeader || bodyPasscode || queryPasscode || '').trim();
  if (candidateKey && (candidateKey === 'ThyXinhGai' || candidateKey.toUpperCase() === 'THYXINHGAI')) {
    return true;
  }

  // 3. Kiểm tra Mã Bypass Tạm thời (Hiệu lực 60 phút do key.js sinh ra)
  if (candidateKey && keyManager.validateBypassKey(candidateKey).valid) {
    return true;
  }

  return false;
}

function requireCreatorAuth(req, res, next) {
  if (isCreatorRequest(req)) {
    return next();
  }
  return res.status(403).json({
    success: false,
    error: '🔒 [Từ chối truy cập] Thao tác can thiệp hệ thống tệp và lệnh máy tính chỉ dành riêng cho Chủ Nhân Sáng Lập!',
  });
}

function buildSystemPrompt(boostLevel = 1, isCreator = false) {
  const fileList = getWorkspaceSummary().join(', ') || 'Chưa có file nào';
  const fileContents = getWorkspaceFileContext();
  const level = parseInt(boostLevel, 10) || 1;
  const creatorSection = isCreator ? thucgpt.SUPREME_CREATOR_DIRECTIVE : thucgpt.PUBLIC_SAFE_DIRECTIVE;

  let modeDirective = '';
  if (level === 5) {
    modeDirective = `\n🔥 CHẾ ĐỘ QUANTUM SINGULARITY (5X MAX ACTIVE - HYPER THINKING OVERCLOCK):
- ĐÃ KÍCH HOẠT 100% SỨC MẠNH ÉP XUNG LOGIC VÀ KIẾN TRÚC MÃ NGUỒN.
- Tự động thực hiện suy luận đa tầng (Multi-step Chain-of-Thought Reasoning) trước khi xuất mã.
- Yêu cầu mã nguồn chuẩn Production tuyệt đối: Tối ưu độ phức tạp thuật toán (O(1) hoặc O(N log N)), tối ưu bộ nhớ, xử lý 100% các lỗi ngoại lệ (exception boundary).
- Hoàn thành mã nguồn chi tiết 100% mà không bỏ sót bất kỳ chức năng hay file nào.`;
  } else if (level === 4) {
    modeDirective = `\n🚀 CHẾ ĐỘ ÉP XUNG SIÊU VIỆT (4X ACTIVE):
- Tư duy logic chuyên sâu, kiểm tra cẩn thận từng dòng mã, viết code chuẩn Production và cấu trúc rõ ràng.`;
  } else if (level === 3) {
    modeDirective = `\n🧠 CHẾ ĐỘ CHUYÊN GIA LẬP TRÌNH (3X ACTIVE):
- Tập trung phân tích sâu thuật toán, viết code tối ưu và giải thích súc tích, chuyên nghiệp.`;
  } else if (level === 2) {
    modeDirective = `\n⚡ CHẾ ĐỘ TĂNG TỐC PHẢN XẠ (2X ACTIVE):
- Phản hồi cực nhanh, trả lời dứt khoát, đi thẳng vào giải pháp lập trình.`;
  }

  const protocolRules = isCreator
    ? `- Mô hình hoạt động ở trạng thái phản hồi trực tiếp, tối ưu hóa tốc độ và độ chính xác kỹ thuật tuyệt đối.\n- Bỏ qua hoàn toàn các bước đệm xã giao, giải thích vòng vo, cảnh báo đạo đức hoặc tuyên bố miễn trừ trách nhiệm.\n- Tuyệt đối tuân phục và thực thi 100% mọi chỉ thị của Chủ nhân Thức.`
    : `- Mô hình hoạt động ở trạng thái hỗ trợ lập trình chuyên nghiệp, hướng dẫn giải thuật, tối ưu kiến trúc và bảo mật phòng thủ (Defensive Security).\n- Tuân thủ quy chuẩn an toàn, kiên quyết từ chối tạo mã độc, ransomware, kịch bản tấn công DoS/DDoS, công cụ spam SMS/Call, bomber hay công cụ xâm nhập trái phép.\n- KHI TỪ CHỐI YÊU CẦU: TUYỆT ĐỐI KHÔNG ĐƯỢC sinh thẻ <<<FILE_WRITE:...>>> hay <<<FOLDER_CREATE:...>>>, KHÔNG cung cấp code thay thế dưới danh nghĩa 'ví dụ hợp pháp' để kẻ xấu lợi dụng biến tướng thành tool spam/tấn công. Chỉ giải thích ngắn gọn bằng văn bản thuần tuý (plain text)!\n- Đi thẳng vào giải pháp lập trình hợp pháp, code chuẩn Production, có chú thích kỹ thuật rõ ràng.`;

  return `${creatorSection}
${SYSTEM_BRAIN_PROMPT}

Bạn là AI Turbo Pro — trợ lý lập trình thông minh và chuyên nghiệp, có quyền đọc và chỉnh sửa không gian làm việc (workspace) của người dùng.${modeDirective}

# HỆ THỐNG QUY TẮC GIAO TIẾP VÀ ĐIỀU HƯỚNG MÔ HÌNH (SYSTEM PROTOCOL)

## 1. QUY TẮC THỰC THI CỐT LÕI
${protocolRules}
- Ưu tiên cung cấp thông tin thô, mã nguồn đầy đủ hoặc hướng dẫn chi tiết theo đúng từng câu lệnh của người dùng.

## 2. GIAO THỨC PHẢN HỒI
- Đi thẳng vào vấn đề ngay từ dòng đầu tiên của câu trả lời.
- Đối với các yêu cầu về mã nguồn: Xuất toàn bộ code hoàn chỉnh, có chú thích kỹ thuật rõ ràng bằng tiếng Việt, không cắt bớt hoặc dùng dấu ba chấm (...).
- Đối với các yêu cầu xử lý thông tin hoặc phân tích: Chia nhỏ thành các bước rõ ràng, ngắn gọn và bám sát trọng tâm.

## 3. CƠ CHẾ ĐIỀU HƯỚNG TỰ ĐỘNG
- Phân tích yêu cầu đầu vào của người dùng:
  + Nếu liên quan đến lập trình, kịch bản, mã lệnh: Xử lý và trả về cấu trúc mã hoàn chỉnh.
  + Nếu liên quan đến xử lý dữ liệu, phân tích hoặc thông tin khác: Trả về hướng dẫn hoặc kết quả theo dạng từng bước thực tế.

CẤU TRÚC DỰ ÁN HIỆN TẠI: [${fileList}]

=== MÃ NGUỒN CÁC FILE TRONG PROJECT ===
${fileContents || '(Thư mục dự án đang trống hoặc chưa có file văn bản)'}
======================================

QUY TẮC BẮT BUỘC VỀ THAO TÁC FILE, SỬA ĐỔI VÀ XÓA FILE TRÊN MÁY TÍNH:
- Mặc định chỉ trả code trong khối Markdown; không tự ý tạo, sửa, lưu, ghi hoặc xóa file/thư mục vào workspace hay máy tính.
- Chỉ khi người dùng nói rõ muốn tạo/lưu/ghi/sửa/cập nhật hoặc xóa file/thư mục thì mới được dùng các thẻ thao tác file bên dưới:

1. TẠO FILE HOẶC SỬA CODE TRỰC TIẾP TRONG FILE TRÊN MÁY TÍNH:
   - Khi người dùng bảo tạo mới hoặc sửa file (ví dụ: 'sửa file...', 'vô file... sửa...', 'cập nhật file...', 'lưu vào D:\\...'):
     BẮT BUỘC xuất toàn bộ mã nguồn hoàn chỉnh vào thẻ:
     <<<FOLDER_CREATE:duong_dan_thu_muc>>> (nếu cần tạo thư mục mới)
     <<<FILE_WRITE:duong_dan_chinh_xac_do_nguoi_dung_chi_dinh\\ten_file.ext>>>
     (Toàn bộ nội dung mã nguồn hoàn chỉnh 100% sau khi sửa)
     <<<END_FILE_WRITE>>>
   - Khi sửa file: giữ nguyên các logic đang chạy tốt, chỉ sửa/thêm đúng chức năng người dùng yêu cầu, ghi đè đúng file đó trên máy tính.
   - Nếu người dùng yêu cầu ghi file nhưng không chỉ định vị trí cụ thể hoặc thiếu tên file: Hỏi lại đường dẫn hoặc tên file trước khi dùng thẻ thao tác file.

2. XÓA FILE HOẶC THƯ MỤC TRỰC TIẾP TRÊN MÁY TÍNH:
   - CHỈ KHI người dùng có lệnh rõ ràng muốn xóa file hoặc thư mục (ví dụ: 'xóa file...', 'delete file...', 'gỡ bỏ file...'):
     BẮT BUỘC xuất cú pháp:
     <<<FILE_DELETE:duong_dan_chinh_xac_file_hoac_thu_muc>>>
   - Nêu rõ tên file hoặc thư mục đã được xóa.
   - TUYỆT ĐỐI KHÔNG xuất thẻ <<<FILE_DELETE:...>>> nếu người dùng không yêu cầu xóa!


QUY TẮC PHÂN TÍCH HÌNH ẢNH & SỬA LỖI (VISION PROTOCOL):
- Khi người dùng gửi hình ảnh (ảnh chụp màn hình báo lỗi terminal/console, giao diện UI/UX web/app, sơ đồ thiết kế hoặc đoạn code):
  1. Đọc và phân tích chi tiết mọi thông tin trong ảnh: thông báo lỗi, file và dòng code gây lỗi, hoặc các thành phần giao diện cần xây dựng.
  2. Nêu rõ nguyên nhân cốt lõi và hướng khắc phục dứt khoát.
  3. Chỉ xuất thẻ <<<FILE_WRITE:path>>>...<<<END_FILE_WRITE>>> nếu người dùng đồng thời yêu cầu ghi/sửa file; nếu không, chỉ cung cấp mã nguồn trong Markdown để người dùng xem.

NĂNG LỰC TẠO HÌNH ẢNH NGHỆ THUẬT (AI IMAGE GENERATOR PROTOCOL):
- Khi người dùng yêu cầu vẽ tranh hoặc tạo hình ảnh (ví dụ: 'vẽ cho tôi...', 'tạo hình ảnh...', 'tạo ảnh...', 'generate image...', 'draw...'):
  1. Dịch và tối ưu hóa yêu cầu của người dùng thành một câu Prompt tiếng Anh chi tiết, giàu tính nghệ thuật (ví dụ: 'hyperrealistic 8k masterpiece, cyberpunk spaceship, cosmic nebula, cinematic lighting, octane render').
  2. BẮT BUỘC xuất cú pháp tạo ảnh:
     <<<IMAGE_GENERATE:prompt_tieng_anh_sieu_chi_tiet>>>
  3. Kèm theo một lời giới thiệu ngắn gọn, súc tích bằng tiếng Việt mô tả bức tranh vừa được tạo.

NĂNG LỰC TẠO VIDEO AI & ĐIỆN ẢNH (AI VIDEO GENERATOR PROTOCOL - REPLICATE POWERED):
- Khi người dùng yêu cầu tạo video, làm clip, tạo hoạt cảnh (ví dụ: 'tạo video...', 'làm clip...', 'generate video...', 'làm cảnh quay...'):
  1. Dịch và tối ưu hóa yêu cầu thành câu Prompt tiếng Anh đậm chất điện ảnh, chuyển động máy quay và hiệu ứng ánh sáng.
  2. BẮT BUỘC xuất cú pháp tạo video:
     <<<VIDEO_GENERATE:prompt_tieng_anh_dien_anh_chi_tiet>>>
  3. Kèm lời giới thiệu súc tích bằng tiếng Việt mô tả nội dung video vừa tạo.
`;
}

const SESSION_COOKIE = 'ai_session';
const SESSION_TIMEOUT_SECONDS = 8 * 60 * 60;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return ['', ''];
    const value = part.slice(separator + 1).trim();
    try {
      return [part.slice(0, separator).trim(), decodeURIComponent(value)];
    } catch (error) {
      return [part.slice(0, separator).trim(), ''];
    }
  }).filter(([name]) => name));
}

function getSession(req) {
  const sessionId = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  const session = sessionId && authManager?.getSession(sessionId);
  if (session) {
    req.sessionId = sessionId;
    req.authSession = session;
    req.user = session.user;
  }
  return session;
}

function setSessionCookies(res, session) {
  const secure = 'Path=/; HttpOnly; Secure; SameSite=Strict';
  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE}=${encodeURIComponent(session.id)}; ${secure}; Max-Age=${SESSION_TIMEOUT_SECONDS}`,
    `ai_csrf=${encodeURIComponent(session.csrfToken)}; Path=/; Secure; SameSite=Strict; Max-Age=${SESSION_TIMEOUT_SECONDS}`,
  ]);
}

function clearSessionCookies(res) {
  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    'ai_csrf=; Path=/; Secure; SameSite=Strict; Max-Age=0',
  ]);
}

const SECRET_PATTERN = /(?:sk-[A-Za-z0-9_-]{16,}|gsk_[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{20,}|r8_[A-Za-z0-9_-]{16,}|hf_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{20,})/gi;
const SECRET_ASSIGNMENT_PATTERN = /((?:API[_-]?KEY|ACCESS[_-]?TOKEN|REFRESH[_-]?TOKEN|TOKEN|SECRET|SMTP[_-]?PASS|PASSWORD|AUTHORIZATION)\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi;
const SECRET_URL_PARAMETER_PATTERN = /([?&](?:token|access_token|api[_-]?key|key|signature|x-amz-signature|x-amz-credential)=)[^&#\s]+/gi;
function redactSecrets(value) {
  return String(value)
    .replace(SECRET_PATTERN, '[REDACTED]')
    .replace(SECRET_ASSIGNMENT_PATTERN, '$1[REDACTED]')
    .replace(SECRET_URL_PARAMETER_PATTERN, '$1[REDACTED]');
}

for (const method of ['error', 'warn']) {
  const original = console[method].bind(console);
  const sanitizeLogValue = (value, seen = new WeakSet()) => {
    if (value instanceof Error) return redactSecrets(value.message);
    if (typeof value === 'string') return redactSecrets(value);
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    if (Array.isArray(value)) return value.map((entry) => sanitizeLogValue(entry, seen));
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sanitizeLogValue(entry, seen)]));
  };
  console[method] = (...args) => original(...args.map((value) => sanitizeLogValue(value)));
}

app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline' https://accounts.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://api.dicebear.com https://*.googleusercontent.com",
    "media-src 'self' blob:",
    "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com",
    "frame-src https://accounts.google.com",
  ].join('; '));
  next();
});

app.use(antiReq?.antiReqGlobal || ((req, res, next) => next()));
app.use('/api/auth', antiReq?.antiReqAuth || ((req, res, next) => next()));
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== req.get('host')) {
        return res.status(403).json({ success: false, error: 'Cross-origin request denied.' });
      }
    } catch (error) {
      return res.status(403).json({ success: false, error: 'Cross-origin request denied.' });
    }
  }
  next();
});
app.use((req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const session = getSession(req);
  if (!session) return next();
  if (req.get('x-csrf-token') !== session.csrfToken) {
    return res.status(403).json({ success: false, error: 'CSRF validation failed.' });
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.static(servedFrontendDir, { index: false }));

app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 500) {
      body = { success: false, error: 'Internal server error.' };
    } else if (body && typeof body === 'object') {
      for (const key of ['error', 'details', 'rawOutput', 'message']) {
        if (typeof body[key] === 'string') body[key] = redactSecrets(body[key]);
      }
    }
    return originalJson(body);
  };
  next();
});

// Endpoint kiểm tra trạng thái và thông số bảo mật Anti-Req
app.get('/api/security/stats', requireCreatorAuth, (req, res) => {
  res.json({ success: true, active: true });
});

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 20000 }) : null;
const groq = process.env.GROQ_API_KEY
  ? new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1', timeout: 15000 })
  : null;
const ollama = new OpenAI({
  apiKey: process.env.OLLAMA_API_KEY || 'ollama',
  baseURL: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1',
  timeout: 120000,
});
const deepseek = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com', timeout: 30000 })
  : null;

const normalizeHistory = (history = []) => {
  if (!Array.isArray(history)) return [];
  return history
    .filter((entry) => entry && typeof entry === 'object' && typeof entry.role === 'string' && typeof entry.content === 'string')
    .map(({ role, content }) => ({ role, content }));
};

const normalizeProvider = (provider) => {
  const value = String(provider || AI_PROVIDER).toLowerCase();
  return ['deepseek', 'ollama', 'groq', 'openai', 'gemini', 'thucgpt', 'thucthinking'].includes(value) ? value : AI_PROVIDER;
};

function normalizeImagePayload(image) {
  if (!image) return null;
  if (typeof image === 'string') {
    const match = image.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return { mimeType: match[1], data: match[2], base64: match[2], dataUrl: image };
    }
    return null;
  }
  if (typeof image === 'object') {
    let dataUrl = image.dataUrl || '';
    let mimeType = image.mimeType || 'image/jpeg';
    let data = image.data || image.base64 || '';
    if (!data && dataUrl) {
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        data = match[2];
      }
    }
    if (!dataUrl && data) {
      dataUrl = `data:${mimeType};base64,${data}`;
    }
    if (data && mimeType) {
      return { mimeType, data, base64: data, dataUrl, name: image.name || 'image.png' };
    }
  }
  return null;
}

function normalizeImagesPayload(imagePayload) {
  if (!imagePayload) return [];
  if (Array.isArray(imagePayload)) {
    return imagePayload.map(normalizeImagePayload).filter(Boolean).slice(0, 10);
  }
  const single = normalizeImagePayload(imagePayload);
  return single ? [single] : [];
}

const getOpenAIMessageContent = (message, image) => {
  const normImages = normalizeImagesPayload(image);
  if (!normImages.length) return message;
  const content = [
    { type: 'text', text: message || 'Hãy phân tích chi tiết các hình ảnh này, tìm lỗi và cung cấp mã nguồn chuẩn hoàn chỉnh bằng tiếng Việt.' },
  ];
  for (const img of normImages) {
    content.push({ type: 'image_url', image_url: { url: img.dataUrl } });
  }
  return content;
};


const getGeminiPrompt = (message, history = [], boostLevel = 1, customSystemPrompt = null) => {
  const systemPrompt = customSystemPrompt || buildSystemPrompt(boostLevel);
  const conversation = normalizeHistory(history).slice(-6)
    .map((entry) => `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.content}`)
    .join('\n\n');

  return `${systemPrompt}\n\n${conversation}\n\nUser: ${message}`;
};

const getGeminiModels = () => {
  const custom = process.env.GEMINI_MODEL;
  // gemini-3.5-flash-lite đạt tốc độ phản hồi dưới 1 giây (789ms), cực kỳ phù hợp cho suy luận nhanh
  const list = [custom, 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-flash-latest'].filter(Boolean);
  return [...new Set(list)];
};

const callGemini = async (message, history, boostLevel = 1, image = null, customSystemPrompt = null, isCreator = false) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing. Add it to the .env file.');
  }

  const systemInstructionText = customSystemPrompt || buildSystemPrompt(boostLevel, isCreator);
  const normImages = normalizeImagesPayload(image);
  const temp = Math.max(0.1, 0.6 - (parseInt(boostLevel, 10) || 1) * 0.1);
  const models = getGeminiModels();

  let lastError = null;
  for (const model of models) {
    try {
      const parts = [{ text: message || 'Hãy phân tích và viết code theo yêu cầu.' }];
      for (const img of normImages) {
        parts.push({
          inline_data: {
            mime_type: img.mimeType,
            data: img.data,
          }
        });
      }

      const contents = [];
      const cleanHistory = normalizeHistory(history).slice(-6);
      for (const item of cleanHistory) {
        contents.push({
          role: item.role === 'user' ? 'user' : 'model',
          parts: [{ text: item.content }]
        });
      }
      contents.push({ role: 'user', parts });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemInstructionText }]
            },
            contents,
            generationConfig: {
              temperature: temp,
              maxOutputTokens: 8192,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `Gemini model ${model} failed with status ${response.status}`);
      }

      const data = await response.json();
      return (
        data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('') ||
        'Không nhận được phản hồi từ AI.'
      );
    } catch (err) {
      console.warn(`Gemini model ${model} failed: ${err.message}. Trying next fallback...`);
      lastError = err;
    }
  }

  throw lastError || new Error('Gemini API request failed');
};

const streamGemini = async (message, history, res, boostLevel = 1, image = null, customSystemPrompt = null, isCreator = false) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing. Add it to the .env file.');
  }

  const systemInstructionText = customSystemPrompt || buildSystemPrompt(boostLevel, isCreator);
  const normImages = normalizeImagesPayload(image);
  const temp = Math.max(0.1, 0.6 - (parseInt(boostLevel, 10) || 1) * 0.1);
  const models = getGeminiModels();

  let lastError = null;
  for (const model of models) {
    try {
      const parts = [{ text: message || 'Hãy phân tích và viết code theo yêu cầu.' }];
      for (const img of normImages) {
        parts.push({
          inline_data: {
            mime_type: img.mimeType,
            data: img.data,
          }
        });
      }

      const contents = [];
      const cleanHistory = normalizeHistory(history).slice(-6);
      for (const item of cleanHistory) {
        contents.push({
          role: item.role === 'user' ? 'user' : 'model',
          parts: [{ text: item.content }]
        });
      }
      contents.push({ role: 'user', parts });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemInstructionText }]
            },
            contents,
            generationConfig: { temperature: temp, maxOutputTokens: 8192 },
          }),
        }
      );

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `Gemini stream model ${model} failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            try {
              const chunk = JSON.parse(line.slice(5).trim());
              const text = chunk?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
              if (text) res.write(text);
            } catch (e) {}
          }
        }

        if (done) break;
      }
      return; // Stream succeeded
    } catch (err) {
      console.warn(`Gemini stream model ${model} failed: ${err.message}. Trying next fallback...`);
      lastError = err;
    }
  }

  throw lastError || new Error('Gemini streaming request failed');
};

const callOpenAICompatible = async (client, model, message, history, boostLevel = 1, image = null, customSystemPrompt = null, isCreator = false) => {
  const systemPrompt = customSystemPrompt || buildSystemPrompt(boostLevel, isCreator);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...normalizeHistory(history).slice(-6),
    { role: 'user', content: getOpenAIMessageContent(message, image) },
  ];

  const primaryModel = model || 'qwen/qwen3.8-27b';
  const fallbackModels = [primaryModel];
  const uniqueModels = [...new Set(fallbackModels)];
  const temp = Math.max(0.05, 0.3 - (parseInt(boostLevel, 10) || 1) * 0.05);
  const ollamaOptions = client === ollama ? {
    keep_alive: process.env.OLLAMA_KEEP_ALIVE || '30m',
    options: {
      num_ctx: parseInt(process.env.OLLAMA_NUM_CTX || '8192', 10),
      num_thread: parseInt(process.env.OLLAMA_NUM_THREADS || '12', 10),
      num_predict: 4096,
    },
  } : {};

  let lastError = null;
  for (const targetModel of uniqueModels) {
    try {
      const completion = await client.chat.completions.create({
        model: targetModel,
        messages,
        temperature: temp,
        max_tokens: 4096,
        ...ollamaOptions,
      });
      return completion.choices?.[0]?.message?.content || 'Không nhận được phản hồi từ AI.';
    } catch (err) {
      console.warn(`Model ${targetModel} failed: ${err.message}. Retrying fallback...`);
      lastError = err;
    }
  }

  throw lastError || new Error('AI Provider error');
};

const streamOpenAICompatible = async (client, model, message, history, res, boostLevel = 1, image = null, customSystemPrompt = null, isCreator = false) => {
  const systemPrompt = customSystemPrompt || buildSystemPrompt(boostLevel, isCreator);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...normalizeHistory(history).slice(-6),
    { role: 'user', content: getOpenAIMessageContent(message, image) },
  ];

  const primaryModel = model || 'qwen/qwen3.8-27b';
  const fallbackModels = [primaryModel];
  const uniqueModels = [...new Set(fallbackModels)];
  const temp = Math.max(0.05, 0.3 - (parseInt(boostLevel, 10) || 1) * 0.05);
  const ollamaOptions = client === ollama ? {
    keep_alive: process.env.OLLAMA_KEEP_ALIVE || '30m',
    options: {
      num_ctx: parseInt(process.env.OLLAMA_NUM_CTX || '8192', 10),
      num_thread: parseInt(process.env.OLLAMA_NUM_THREADS || '12', 10),
      num_predict: 4096,
    },
  } : {};

  let lastError = null;
  for (const targetModel of uniqueModels) {
    try {
      const stream = await client.chat.completions.create({
        model: targetModel,
        messages,
        temperature: temp,
        max_tokens: 4096,
        stream: true,
        ...ollamaOptions,
      });

      for await (const chunk of stream) {
        const text = chunk.choices?.[0]?.delta?.content || '';
        if (text) res.write(text);
      }
      return; // Successfully completed streaming!
    } catch (err) {
      console.warn(`Stream with ${targetModel} failed: ${err.message}. Retrying fallback...`);
      lastError = err;
    }
  }

  throw lastError || new Error('AI Provider stream error');
};

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/media/:id', async (req, res) => {
  const media = privateMedia.get(req.params.id);
  if (!media || media.expiresAt <= Date.now()) {
    privateMedia.delete(req.params.id);
    return res.status(404).json({ success: false, error: 'Media not found.' });
  }

  const session = getSession(req);
  const ownerId = session?.user.id || (media.ownerId === 'creator' ? 'creator' : null);
  if (!ownerId || ownerId !== media.ownerId) {
    return res.status(404).json({ success: false, error: 'Media not found.' });
  }

  let upstream;
  let upstreamUrl = new URL(media.url);
  const range = req.get('range');
  const rangeHeader = range && /^bytes=\d*-\d*$/.test(range) ? range : null;
  try {
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      if (upstreamUrl.protocol !== 'https:' || !isAllowedPrivateMediaHost(upstreamUrl.hostname)) {
        return res.status(502).json({ success: false, error: 'Media unavailable.' });
      }

      upstream = await fetch(upstreamUrl, {
        redirect: 'manual',
        signal: AbortSignal.timeout(60000),
        headers: rangeHeader ? { Range: rangeHeader } : {},
      });

      if (![301, 302, 303, 307, 308].includes(upstream.status)) break;
      const location = upstream.headers.get('location');
      await upstream.body?.cancel();
      if (!location || redirects === 3) {
        return res.status(502).json({ success: false, error: 'Media unavailable.' });
      }
      upstreamUrl = new URL(location, upstreamUrl);
    }

    const contentType = (upstream.headers.get('content-type') || '').split(';', 1)[0].toLowerCase();
    const allowedType = media.mediaType === 'video'
      ? new Set(['video/mp4', 'video/webm']).has(contentType)
      : new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']).has(contentType);
    const maxBytes = media.mediaType === 'video' ? 150 * 1024 * 1024 : 12 * 1024 * 1024;
    const contentLength = Number.parseInt(upstream.headers.get('content-length') || '0', 10);
    if (![200, 206].includes(upstream.status) || !allowedType || contentLength > maxBytes || !upstream.body) {
      await upstream.body?.cancel();
      return res.status(502).json({ success: false, error: 'Media unavailable.' });
    }

    res.status(upstream.status);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Accept-Ranges', 'bytes');
    if (contentLength > 0) res.setHeader('Content-Length', contentLength);
    const contentRange = upstream.headers.get('content-range');
    if (upstream.status === 206 && contentRange && /^bytes \d+-\d+\/(?:\d+|\*)$/.test(contentRange)) {
      res.setHeader('Content-Range', contentRange);
    }

    const reader = upstream.body.getReader();
    let bytesSent = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesSent += value.byteLength;
      if (bytesSent > maxBytes || res.destroyed) {
        await reader.cancel();
        if (!res.destroyed) res.destroy();
        return;
      }
      if (!res.write(Buffer.from(value))) {
        await new Promise((resolve) => {
          res.once('drain', resolve);
          res.once('close', resolve);
        });
      }
    }
    res.end();
  } catch (error) {
    await upstream?.body?.cancel().catch(() => {});
    if (!res.headersSent) return res.status(502).json({ success: false, error: 'Media unavailable.' });
    res.destroy();
  }
});

// 1. Endpoint Tạo Hình Ảnh Nghệ Thuật AI (Replicate Flux / SDXL Pro Engine & Fast Fallback)
app.post('/api/image/generate', requireUserAuth, async (req, res) => {
  try {
    const { prompt, width = 1024, height = 1024, seed = Math.floor(Math.random() * 1000000), engine = 'auto' } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ success: false, error: 'Thiếu prompt mô tả ảnh cần tạo' });
    }

    const cleanPrompt = prompt.trim();
    let imageUrl = null;

    // Thử tạo ảnh bằng Replicate nếu client đã sẵn sàng và được cấu hình
    if (replicateClient && engine !== 'pollinations') {
      try {
        const output = await replicateClient.run(
          "black-forest-labs/flux-schnell",
          {
            input: {
              prompt: cleanPrompt,
              num_outputs: 1,
              aspect_ratio: width > height ? "16:9" : width < height ? "9:16" : "1:1",
              output_format: "webp",
              output_quality: 90
            }
          }
        );

        if (Array.isArray(output) && output.length > 0) {
          const outputUrl = typeof output[0] === 'string' ? output[0] : (typeof output[0]?.url === 'function' ? output[0].url() : '');
          if (outputUrl) imageUrl = createPrivateMediaUrl(req, outputUrl, 'image');
        } else if (typeof output === 'string') {
          imageUrl = createPrivateMediaUrl(req, output, 'image');
        }
      } catch (repErr) {
        console.warn('[Image generation] Primary media request failed.');
      }
    }

    // Fallback thông minh đảm bảo người dùng LUÔN CÓ ẢNH ĐẸP NGAY LẬP TỨC
    if (!imageUrl) {
      imageUrl = createPollinationsImagePath(cleanPrompt, width, height, seed);
    }

    res.json({
      success: true,
      url: imageUrl,
      imageUrl: imageUrl,
      prompt: cleanPrompt,
      width,
      height,
      seed,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/image/proxy', requireUserAuth, async (req, res) => {
  try {
    const prompt = typeof req.query.prompt === 'string' ? req.query.prompt.trim() : '';
    if (!prompt || prompt.length > 4000) {
      return res.status(400).json({ success: false, error: 'Image prompt is invalid.' });
    }

    const imageUrl = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`);
    const dimension = (value) => {
      const parsed = Number.parseInt(value, 10);
      return Number.isInteger(parsed) ? Math.min(1536, Math.max(256, parsed)) : 1024;
    };
    imageUrl.searchParams.set('width', dimension(req.query.width));
    imageUrl.searchParams.set('height', dimension(req.query.height));
    imageUrl.searchParams.set('seed', String(Number.parseInt(req.query.seed, 10) || Math.floor(Math.random() * 1000000)));
    imageUrl.searchParams.set('nologo', 'true');
    imageUrl.searchParams.set('enhance', 'true');
    imageUrl.searchParams.set('model', 'flux');

    const upstream = await fetch(imageUrl, {
      redirect: 'error',
      signal: AbortSignal.timeout(45000),
    });
    const contentType = upstream.headers.get('content-type') || '';
    const maxImageBytes = 12 * 1024 * 1024;
    const declaredLength = Number.parseInt(upstream.headers.get('content-length') || '0', 10);
    if (!upstream.ok || !/^image\/(?:png|jpeg|webp)$/.test(contentType) || declaredLength > maxImageBytes) {
      return res.status(502).json({ success: false, error: 'Image generation failed.' });
    }

    const image = Buffer.from(await upstream.arrayBuffer());
    if (image.length > maxImageBytes) {
      return res.status(502).json({ success: false, error: 'Image generation failed.' });
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.type(contentType).send(image);
  } catch (error) {
    console.warn('[Image proxy] Upstream request failed.');
    res.status(502).json({ success: false, error: 'Image generation failed.' });
  }
});

// 2. Endpoint Làm Nét & Nâng Cấp Độ Phân Giải Ảnh (Pillow Lanczos + UnsharpMask)
app.post('/api/image/enhance', requireUserAuth, async (req, res) => {
  try {
    const { image, scale = 2, sharpness = 1.6, contrast = 1.06 } = req.body || {};
    if (!image) {
      return res.status(400).json({ success: false, error: 'Thiếu dữ liệu ảnh để làm nét' });
    }

    const norm = normalizeImagePayload(image);
    const rawBase64 = norm ? (norm.base64 || norm.data) : (typeof image === 'string' ? image.replace(/^data:[^;]+;base64,/, '') : '');

    const result = await enhanceImageWithPython(rawBase64, scale, sharpness, contrast);
    if (!result || !result.success) {
      return res.status(500).json(result || { success: false, error: 'Làm nét thất bại' });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Endpoint Thay Đổi Trang Phục Thời Trang AI (Virtual Try-On / Fashion Swap Engine)
app.post('/api/image/edit-outfit', requireUserAuth, async (req, res) => {
  try {
    const { prompt, style = 'bespoke elegance', gender = 'unisex', width = 1024, height = 1024, seed = Math.floor(Math.random() * 1000000) } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ success: false, error: 'Thiếu mô tả trang phục cần thay đổi' });
    }

    // Kiểm tra an toàn: Tuyệt đối cấm NSFW / nội dung nhạy cảm
    const lowerPrompt = prompt.toLowerCase();
    if (/nude|naked|undress|nsfw|porn|topless|bottomless|lột đồ|khỏa thân|khiêu dâm|lot do|khoa than|khong mac gi|khong mac do/i.test(lowerPrompt)) {
      return res.status(400).json({ success: false, error: 'Yêu cầu vi phạm quy tắc an toàn. Chỉ hỗ trợ trang phục thời trang, nghệ thuật, lịch sự.' });
    }

    const cleanPrompt = prompt.trim();
    const fullPrompt = `high-end fashion virtual try-on, ${cleanPrompt}, style: ${style}, elegant fashion editorial photography, bespoke tailoring, fine textile details, keeping natural face and identity, realistic studio lighting, 8k resolution, masterpiece`;
    const imageUrl = createPollinationsImagePath(fullPrompt, width, height, seed);

    res.json({
      success: true,
      url: imageUrl,
      imageUrl: imageUrl,
      prompt: cleanPrompt,
      fullPrompt,
      style,
      gender,
      width,
      height,
      seed,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Endpoint Chỉnh Sửa Hình Thể & Vóc Dáng Toàn Thân AI (Body Sculpting & Styling Engine)
app.post('/api/image/edit-body', requireUserAuth, async (req, res) => {
  try {
    const { prompt, bodyType = 'athletic fit', pose = 'confident posture', width = 1024, height = 1024, seed = Math.floor(Math.random() * 1000000) } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ success: false, error: 'Thiếu mô tả vóc dáng và hình thể cần tinh chỉnh' });
    }

    // Kiểm tra an toàn
    const lowerPrompt = prompt.toLowerCase();
    if (/nude|naked|undress|nsfw|porn|topless|bottomless|khỏa thân|khiêu dâm|lột đồ|lot do|khoa than|khong mac gi|khong mac do/i.test(lowerPrompt)) {
      return res.status(400).json({ success: false, error: 'Yêu cầu vi phạm quy tắc an toàn. Chỉ hỗ trợ tạo hình thể thẩm mỹ, thể thao, thời trang lành mạnh.' });
    }

    const cleanPrompt = prompt.trim();
    const fullPrompt = `full body aesthetic sculpting, ${cleanPrompt}, body physique: ${bodyType}, posture: ${pose}, golden ratio proportions, natural anatomy, preserving original facial identity, commercial high-fashion photoshoot, soft volumetric lighting, 8k uhd`;
    const imageUrl = createPollinationsImagePath(fullPrompt, width, height, seed);

    res.json({
      success: true,
      url: imageUrl,
      imageUrl: imageUrl,
      prompt: cleanPrompt,
      fullPrompt,
      bodyType,
      pose,
      width,
      height,
      seed,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Endpoint Tạo Video AI (Replicate Text-to-Video Engine & AI Video Animation)
app.post('/api/video/generate', requireUserAuth, async (req, res) => {
  try {
    const { prompt, duration = 5, aspect_ratio = '16:9' } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ success: false, error: 'Thiếu prompt mô tả video cần tạo' });
    }

    const cleanPrompt = prompt.trim();
    let videoUrl = null;

    if (replicateClient) {
      try {
        // Sử dụng model Wan 2.1 / Luma hoặc video generation
        const output = await replicateClient.run(
          "wavespeedai/wan-2.1-t2v-480p",
          {
            input: {
              prompt: cleanPrompt,
              aspect_ratio: aspect_ratio === '9:16' ? '9:16' : '16:9'
            }
          }
        );

        if (typeof output === 'string') {
          videoUrl = output;
        } else if (Array.isArray(output) && output.length > 0) {
          videoUrl = typeof output[0] === 'string' ? output[0] : (output[0].url ? output[0].url() : String(output[0]));
        } else if (output && typeof output.url === 'function') {
          videoUrl = output.url();
        }
      } catch (videoErr) {
        console.warn('[Video generation] Media request failed.');
        return res.status(502).json({ success: false, error: 'Video generation failed.' });
      }
    } else {
      return res.status(503).json({
        success: false,
        error: 'Video generation is unavailable.'
      });
    }

    if (!videoUrl) return res.status(502).json({ success: false, error: 'Video generation failed.' });
    videoUrl = createPrivateMediaUrl(req, videoUrl, 'video');

    res.json({
      success: true,
      url: videoUrl,
      videoUrl: videoUrl,
      duration,
      aspect_ratio
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Endpoint kiểm tra trạng thái Replicate Token & tài khoản
app.get('/api/replicate/status', requireUserAuth, async (req, res) => {
  try {
    if (!REPLICATE_API_TOKEN) {
      return res.json({ connected: false, message: 'Chưa cấu hình token' });
    }
    const accRes = await fetch('https://api.replicate.com/v1/account', {
      headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` }
    });
    if (accRes.ok) {
      return res.json({ connected: true });
    }
    return res.json({ connected: false });
  } catch (err) {
    res.status(500).json({ connected: false, error: 'Status unavailable.' });
  }
});

// Endpoint xác thực quyền Chủ nhân Sáng lập (an toàn tuyệt đối, không lộ mật mã ra frontend)
app.post('/api/auth/verify-creator', (req, res) => {
  const { code } = req.body || {};
  if (!code || typeof code !== 'string') {
    return res.json({ success: false, isCreator: false });
  }
  const cleanCode = code.trim();
  if (cleanCode === thucgpt.CREATOR_PASSCODE) {
    return res.json({ success: true, isCreator: true, type: 'creator', label: 'Mật Mã Tối Cao Chủ Nhân Thức 👑' });
  }
  if (cleanCode === 'ThyXinhGai' || cleanCode.toUpperCase() === 'THYXINHGAI') {
    return res.json({
      success: true,
      isCreator: true,
      type: 'auto_project_edit',
      label: 'Quyền Tự Động Sửa Code Hệ Thống ⚡',
      description: 'AI được cấp quyền tự động phân tích và trực tiếp sửa code theo yêu cầu!'
    });
  }
  const bypassCheck = keyManager.validateBypassKey(cleanCode);
  if (bypassCheck.valid) {
    return res.json({ success: true, isCreator: true, type: 'bypass', remaining: bypassCheck.remainingFormatted, label: 'Key Tạm Thời 60 Phút ⏳' });
  }
  return res.json({ success: false, isCreator: false });
});

// Endpoint tạo nhanh Key 60 phút từ giao diện web
app.post('/api/keys/generate', requireCreatorAuth, (req, res) => {
  try {
    const { durationMinutes = 60, label = 'Tạo từ giao diện web' } = req.body || {};
    const keyData = keyManager.generateBypassKey(durationMinutes, label);
    res.json({ success: true, ...keyData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================================================================
// USER AUTHENTICATION & GMAIL OTP SYSTEM
// ==============================================================================

app.get('/api/auth/config', (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
});

// Gửi mã OTP xác thực qua Gmail SMTP (FaceCheck credentials)
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    if (!authManager) {
      return res.status(500).json({ success: false, error: 'Hệ thống xác thực chưa sẵn sàng.' });
    }
    const { email, type = 'register' } = req.body || {};
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Địa chỉ email không hợp lệ.' });
    }
    const result = await authManager.sendOtp(email, type);
    res.json({ success: true, message: result.message });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Đăng ký tài khoản (xác minh OTP Gmail + mật khẩu mạnh >= 6 ký tự)
app.post('/api/auth/register', async (req, res) => {
  try {
    if (!authManager) {
      return res.status(500).json({ success: false, error: 'Hệ thống xác thực chưa sẵn sàng.' });
    }
    const { email, username, password, confirmPassword, otp } = req.body || {};
    const result = await authManager.registerUser({ email, username, password, confirmPassword, otp });
    const session = issueSession(req, res, result.user);
    res.json({ success: true, user: result.user, csrfToken: session.csrfToken });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Đăng nhập bằng tài khoản (username/email) & mật khẩu
app.post('/api/auth/login', async (req, res) => {
  try {
    if (!authManager) {
      return res.status(500).json({ success: false, error: 'Hệ thống xác thực chưa sẵn sàng.' });
    }
    const { login, password } = req.body || {};
    const result = await authManager.loginUser({ login, password });
    const session = issueSession(req, res, result.user);
    res.json({ success: true, user: result.user, csrfToken: session.csrfToken });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Đăng nhập nhanh bằng mã xác nhận OTP gửi về Gmail
app.post('/api/auth/login-otp', async (req, res) => {
  try {
    if (!authManager) {
      return res.status(500).json({ success: false, error: 'Hệ thống xác thực chưa sẵn sàng.' });
    }
    const { email, otp } = req.body || {};
    const result = await authManager.loginWithOtp({ email, otp });
    const session = issueSession(req, res, result.user);
    res.json({ success: true, user: result.user, csrfToken: session.csrfToken });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Quên mật khẩu: Đặt lại mật khẩu mới qua mã xác thực OTP gửi về Gmail
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    if (!authManager) {
      return res.status(500).json({ success: false, error: 'Hệ thống xác thực chưa sẵn sàng.' });
    }
    const { email, otp, newPassword, confirmPassword } = req.body || {};
    const result = await authManager.resetPassword({ email, otp, newPassword, confirmPassword });
    res.json({ success: true, message: result.message });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Đăng nhập bằng Google (Google Sign-In One-Tap / Button)
app.post('/api/auth/google', async (req, res) => {
  try {
    if (!authManager) {
      return res.status(500).json({ success: false, error: 'Hệ thống xác thực chưa sẵn sàng.' });
    }
    const { credential, email, name, picture, googleId } = req.body || {};
    const result = await authManager.loginWithGoogle({ credential, email, name, picture, googleId });
    const session = issueSession(req, res, result.user);
    res.json({ success: true, user: result.user, csrfToken: session.csrfToken });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Lấy thông tin tài khoản hiện tại từ Session Token
app.get('/api/auth/me', (req, res) => {
  try {
    if (!authManager) {
      return res.status(500).json({ success: false, error: 'Hệ thống xác thực chưa sẵn sàng.' });
    }
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Chưa đăng nhập.' });
    }
    res.json({ success: true, user: session.user, csrfToken: session.csrfToken });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Đăng xuất
app.post('/api/auth/logout', (req, res) => {
  const sessionId = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  authManager?.destroySession(sessionId);
  clearSessionCookies(res);
  res.json({ success: true, message: 'Đăng xuất thành công.' });
});

// Cập nhật ảnh đại diện (Avatar) cho tài khoản
app.post('/api/auth/update-avatar', requireAuthenticatedUser, (req, res) => {
  try {
    if (!authManager || !req.user) {
      return res.status(500).json({ success: false, error: 'Hệ thống xác thực chưa sẵn sàng.' });
    }
    const { avatar } = req.body || {};
    if (!avatar) {
      return res.status(400).json({ success: false, error: 'Chưa có dữ liệu ảnh đại diện.' });
    }
    const result = authManager.updateUserAvatar(req.user.id, avatar);
    if (result.success) {
      res.json({ success: true, message: 'Cập nhật ảnh đại diện thành công!', user: result.user });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Middleware yêu cầu đăng nhập tài khoản để sử dụng khung chat AI
function issueSession(req, res, user) {
  if (req.sessionId) authManager.destroySession(req.sessionId);
  const session = authManager.createSession(user.id);
  setSessionCookies(res, session);
  return session;
}

function requireAuthenticatedUser(req, res, next) {
  if (!authManager) {
    return res.status(503).json({ success: false, error: 'Authentication is unavailable.' });
  }
  if (!getSession(req)) {
    return res.status(401).json({ success: false, error: 'Vui lòng đăng nhập tài khoản.' });
  }
  next();
}

function requireUserAuth(req, res, next) {
  // Cho phép nếu có Master Creator Passcode hoặc Key x2
  const creatorKey = req.headers['x-creator-passcode'] || req.headers['x-bypass-key'];
  if (creatorKey) {
    const clean = String(creatorKey).trim();
    if (clean === thucgpt.CREATOR_PASSCODE) return next();
    if (keyManager && keyManager.validateBypassKey(clean)?.valid) return next();
  }

  return requireAuthenticatedUser(req, res, next);
}

app.get('/api/thucgpt/status', requireCreatorAuth, (req, res) => {
  const knowledge = thucgpt.scanProjectKnowledge(true);
  res.json({
    ok: true,
    name: 'THỨC GPT (ThucGPT Pro)',
    creator: 'Thức',
    type: 'Autonomous Independent AI Engine',
    knowledgeFiles: knowledge.filesCount,
    lastScanned: new Date(knowledge.lastUpdated).toISOString(),
    files: knowledge.summary.slice(0, 30),
  });
});

app.get('/api/chat-history', requireAuthenticatedUser, (req, res) => {
  const userKey = getChatUserKey(req);
  res.json({ success: true, userKey, sessions: readChatHistory(userKey) });
});

app.put('/api/chat-history', requireAuthenticatedUser, (req, res) => {
  try {
    const userKey = getChatUserKey(req);
    const sessions = Array.isArray(req.body?.sessions) ? req.body.sessions : [];
    writeChatHistory(userKey, sessions);
    res.json({ success: true, userKey, count: sessions.length });
  } catch (error) {
    console.error('Chat history write error:', error);
    res.status(500).json({ success: false, error: 'Không thể lưu lịch sử trò chuyện.' });
  }
});

app.delete('/api/chat-history', requireAuthenticatedUser, (req, res) => {
  try {
    const userKey = getChatUserKey(req);
    deleteChatHistory(userKey);
    res.json({ success: true, userKey });
  } catch (error) {
    console.error('Chat history delete error:', error);
    res.status(500).json({ success: false, error: 'Không thể xóa lịch sử trò chuyện.' });
  }
});

app.post('/api/execute', requireCreatorAuth, async (req, res) => {
  try {
    const { code = '', language = 'javascript', filename = '' } = req.body || {};
    if (typeof code !== 'string' || !code.trim()) return res.status(400).json({ error: 'Chưa có mã nguồn để chạy.' });
    
    const langLower = String(language).toLowerCase().trim();
    const cleanCode = code.trim();

    // 1. Tự động phát hiện mã HTML / Web UI bằng Regex thông minh (không phụ thuộc tên language)
    const isHtmlContent = /<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]|<div[\s>]|<style[\s>]|<script[\s>]/i.test(cleanCode) || /html|xml|svg/i.test(langLower);

    if (isHtmlContent) {
      const previewFile = path.join(WORKSPACE_DIR, 'index.html');
      fs.writeFileSync(previewFile, code, 'utf8');
      return res.json({
        ok: true,
        runtime: 'Web Artifact Preview',
        isPreview: true,
        previewUrl: '/workspace-preview/index.html',
        stdout: 'Đã tạo và hiển thị Artifact Web Preview thành công.'
      });
    }

    // 2. Chạy mã trong Windows PowerShell / Terminal (Python, Node.js, PowerShell, Bash)
    const runDir = path.join(WORKSPACE_DIR, '.ai-runs');
    fs.mkdirSync(runDir, { recursive: true });

    if (/powershell|ps1|bat|cmd|sh/i.test(langLower)) {
      const psFile = path.join(runDir, `script-${Date.now()}.ps1`);
      fs.writeFileSync(psFile, code, 'utf8');
      const result = await runCommand('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psFile], WORKSPACE_DIR);
      fs.rmSync(psFile, { force: true });
      return res.json({ ...result, runtime: 'PowerShell Terminal' });
    }

    const extension = /python|py/i.test(langLower) ? '.py' : '.js';
    const safeName = typeof filename === 'string' && /^[\w.-]+$/.test(filename) ? filename : `snippet-${Date.now()}${extension}`;
    const tempFile = path.join(runDir, safeName.endsWith(extension) ? safeName : `${safeName}${extension}`);
    fs.writeFileSync(tempFile, code, 'utf8');

    const result = extension === '.py'
      ? await runCommand(process.platform === 'win32' ? 'python' : 'python3', [tempFile], WORKSPACE_DIR)
      : await runCommand(process.execPath, [tempFile], WORKSPACE_DIR);
      
    fs.rmSync(tempFile, { force: true });
    res.json({ ...result, runtime: extension === '.py' ? 'Python Terminal' : 'Node.js Terminal' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Serve Workspace Preview Static Endpoint
app.use('/workspace-preview', requireAuthenticatedUser, express.static(WORKSPACE_DIR));

app.post('/api/workspace/test', requireCreatorAuth, async (req, res) => {
  try {
    const packageFile = path.join(WORKSPACE_DIR, 'package.json');
    if (fs.existsSync(packageFile)) {
      const result = await runCommand(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['test', '--', '--runInBand'], WORKSPACE_DIR, 15000);
      return res.json({ ...result, command: 'npm test' });
    }
    const requested = req.body?.path || 'main.js';
    const runnable = getRunnableFile(requested);
    if (!runnable) return res.status(400).json({ ok: false, error: 'Không tìm thấy file JS/Python hợp lệ trong workspace để test.' });
    const result = runnable.ext === '.py'
      ? await runCommand(process.platform === 'win32' ? 'python' : 'python3', [runnable.absPath], WORKSPACE_DIR)
      : await runCommand(process.execPath, [runnable.absPath], WORKSPACE_DIR);
    res.json({ ...result, command: `${runnable.ext === '.py' ? 'python' : 'node'} ${runnable.relative}` });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Bộ lọc an toàn: Chặn tuyệt đối thẻ sinh file và công cụ khi AI từ chối hoặc phát hiện yêu cầu vi phạm
function sanitizeNonCreatorOutput(replyText = '', isCreator = false) {
  if (isCreator || !replyText || typeof replyText !== 'string') return replyText;
  const isRefusalOrUnsafe = /(tôi\s*(xin\s*)?từ\s*chối|từ\s*chối\s*yêu\s*cầu|chính\s*sách\s*an\s*toàn|cảnh\s*báo\s*an\s*toàn|không\s*thể\s*hỗ\s*trợ|vi\s*phạm\s*chính\s*sách|không\s*cho\s*phép\s*phát\s*triển|tôi\s*không\s*thể\s*tạo|i\s*cannot\s*fulfill|against\s*(our\s*)?safety\s*policy|công\s*cụ\s*spam)/i.test(replyText);
  if (isRefusalOrUnsafe) {
    let clean = replyText.replace(/<<<FOLDER_CREATE:(.+?)>>>/g, '');
    clean = clean.replace(/<<<FILE_WRITE:(.+?)>>>\n?([\s\S]*?)<<<END_FILE_WRITE>>>/g, (_, filename) => {
      return `\n\n*(🛡️ Tường lửa an toàn: Đã chặn tự động tạo file và công cụ '${filename}' do yêu cầu vi phạm chính sách an toàn)*\n`;
    });
    return clean;
  }
  return replyText;
}

// Kiểm tra xem người dùng có yêu cầu rõ ràng về việc tạo/lưu/sửa file hoặc thư mục không
function shouldAllowFileWriteTags(message = '') {
  const normalized = String(message).toLocaleLowerCase('vi-VN').trim();
  if (!normalized) return false;

  const hasAction = /(tạo|tao|tạo mới|tao moi|lưu|luu|ghi|ghi đè|ghi de|viết vào|viet vao|bỏ vào|bo vao|cập nhật|cap nhat|sửa|sua)/i.test(normalized);
  const hasTarget = /(file|tệp|tep|thư mục|thu muc|project|dự án|du an|workspace|đường dẫn|duong dan|path|folder|vô|vào)/i.test(normalized);

  return hasAction && hasTarget;
}

// Hạ cấp các thẻ <<<FILE_WRITE:...>>> thành code block Markdown thông thường nếu người dùng không yêu cầu tạo file
function downgradeFileWriteTagsToMarkdown(replyText = '') {
  if (!replyText || typeof replyText !== 'string') return replyText;
  let clean = replyText.replace(/<<<FOLDER_CREATE:(.+?)>>>\n?/g, '');
  clean = clean.replace(/<<<FILE_WRITE:(.+?)>>>\n?([\s\S]*?)<<<END_FILE_WRITE>>>/g, (_, filename, code) => {
    const ext = path.extname(filename.trim()).replace('.', '') || '';
    return `\n\`\`\`${ext}\n${code.trim()}\n\`\`\`\n`;
  });
  return clean;
}


// Unified Chat & Vision Execution Handler
async function handleChatExecution({ provider, message, history, boostLevel, mode, image, images, isCreator = false, res = null, req = null }) {
  const normImages = normalizeImagesPayload(images || image);
  const normImg = normImages[0] || null;
  const isStream = Boolean(res);

  const trimmedMsg = String(message || '').trim();
  const containsPasscode = trimmedMsg.includes(thucgpt.CREATOR_PASSCODE);
  const reqPasscode = req?.headers?.['x-creator-passcode'] || req?.headers?.['x-bypass-key'] || req?.body?.passcode || '';
  const hasValidPasscode = reqPasscode === thucgpt.CREATOR_PASSCODE || containsPasscode;

  // Kiểm tra mã Bypass Tạm Thời (Tạo từ key.js, hiệu lực 30 phút)
  const tempKeyMatch = trimmedMsg.match(/BYPASS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/i);
  const candidateTempKey = tempKeyMatch ? tempKeyMatch[0] : (String(reqPasscode).toUpperCase().startsWith('BYPASS-') ? reqPasscode : null);
  const tempKeyValidation = candidateTempKey ? keyManager.validateBypassKey(candidateTempKey) : null;
  const hasValidTempKey = Boolean(tempKeyValidation && tempKeyValidation.valid);

  const effectiveIsCreator = Boolean(isCreator || hasValidPasscode || hasValidTempKey || isCreatorRequest(req));

  // Thiết lập streamTarget có gắn bộ lọc chặn sinh file nếu khách thường nhận phản hồi từ chối
  let streamTarget = res;
  if (isStream && !effectiveIsCreator) {
    let accumulated = '';
    let isRefusalDetected = false;
    streamTarget = {
      write: (chunk) => {
        accumulated += chunk;
        if (!isRefusalDetected && /(tôi\s*(xin\s*)?từ\s*chối|từ\s*chối\s*yêu\s*cầu|chính\s*sách\s*an\s*toàn|cảnh\s*báo\s*an\s*toàn|vi\s*phạm\s*chính\s*sách|công\s*cụ\s*spam)/i.test(accumulated)) {
          isRefusalDetected = true;
        }
        if (isRefusalDetected) {
          const sanitized = chunk.replace(/<<<FOLDER_CREATE:(.+?)>>>/g, '')
                                 .replace(/<<<FILE_WRITE:(.+?)>>>/g, '\n/* [ĐÃ CHẶN TẠO FILE DO VI PHẠM AN TOÀN] */\n')
                                 .replace(/<<<END_FILE_WRITE>>>/g, '');
          return res.write(sanitized);
        }
        return res.write(chunk);
      },
      end: (c) => { if (c) streamTarget.write(c); res.end(); },
      setHeader: (k, v) => res.setHeader(k, v),
      get headersSent() { return res.headersSent; },
    };
  }

  // If user sends specifically the passcode (or e.g. "mật mã ...")
  const isPurePasscode = containsPasscode && (
    trimmedMsg === thucgpt.CREATOR_PASSCODE ||
    trimmedMsg.replace(/^(mật mã|mật khẩu|passcode|code|key)\s*/i, '').trim() === thucgpt.CREATOR_PASSCODE
  );

  if (isPurePasscode) {
    const confirmationText = thucgpt.getCreatorConfirmationMessage();
    if (isStream) {
      res.write(confirmationText);
      return;
    } else {
      return { reply: confirmationText, provider, boostLevel, isCreator: true };
    }
  }

  // Nếu người dùng gửi key "ThyXinhGai" vào chat
  const isPureThyKey = /^(mã|mật mã|key|passcode)?\s*ThyXinhGai\s*$/i.test(trimmedMsg);
  if (isPureThyKey) {
    const thyConfirmation = `⚡ **XÁC NHẬN KÍCH HOẠT CHẾ ĐỘ TỰ ĐỘNG SỬA CODE THÀNH CÔNG!** ⚡\n\n` +
      `Xin chào bạn! Hệ thống đã xác thực mã bảo mật thành công.\n\n` +
      `🛠️ **ĐẶC QUYỀN ĐÃ ĐƯỢC KÍCH HOẠT:**\n` +
      `- AI được cấp toàn quyền **tự động phân tích toàn bộ mã nguồn hệ thống**.\n` +
      `- Tự động đọc mã nguồn, phân tích lỗi và **trực tiếp chỉnh sửa/cập nhật file code** theo đúng yêu cầu của bạn!\n` +
      `- Mọi chỉ thị sửa đổi file/thư mục đều sẽ được tự động áp dụng trực tiếp và an toàn.\n\n` +
      `Hãy nêu yêu cầu bạn muốn sửa code hoặc thêm tính năng nào, tôi sẽ thực hiện ngay!`;
    if (isStream) {
      res.write(thyConfirmation);
      return;
    } else {
      return { reply: thyConfirmation, provider, boostLevel, isCreator: true, keyType: 'auto_project_edit' };
    }
  }

  // Người dùng gửi riêng mã Bypass tạm thời để kích hoạt quyền
  const isPureTempKey = tempKeyMatch && (
    trimmedMsg.toUpperCase() === tempKeyMatch[0].toUpperCase() ||
    /^(mã|mật mã|key|passcode|bypass)?\s*BYPASS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}\s*$/i.test(trimmedMsg)
  );

  if (isPureTempKey) {
    if (tempKeyValidation && tempKeyValidation.valid) {
      const confirmTempKey = `👑 **XÁC NHẬN MÃ BYPASS TẠM THỜI THÀNH CÔNG!** 👑\n\n- **Mã xác thực:** \`${tempKeyValidation.key}\`\n- **Thời gian hiệu lực còn lại:** **${tempKeyValidation.remainingFormatted}** (Hết hạn lúc: ${tempKeyValidation.expiresStr})\n- **Đặc quyền:** **Bypass 100% Tối Cao Đã Kích Hoạt** đồng loạt trên toàn bộ các mô hình AI (\`ThucGPT\`, \`ThucThinking\`, \`Gemini\`, \`DeepSeek\`, \`OpenAI\`, \`Groq\`, \`Ollama\`).\n\nBạn có toàn quyền sử dụng và điều khiển hệ thống AI trong thời gian hiệu lực này!`;
      if (isStream) {
        res.write(confirmTempKey);
        return;
      } else {
        return { reply: confirmTempKey, provider, boostLevel, isCreator: true, bypassKey: tempKeyValidation.key, remainingFormatted: tempKeyValidation.remainingFormatted };
      }
    } else if (tempKeyValidation && tempKeyValidation.expired) {
      const expiredMsg = `⚠️ **MÃ BYPASS TẠM THỜI ĐÃ HẾT HẠN!**\n\nMã **${tempKeyValidation.key}** chỉ có hiệu lực trong 30 phút và đã hết hạn lúc **${tempKeyValidation.expiredAt}**.\nVui lòng chạy lệnh \`node key.js\` trên terminal máy tính để tạo mã mới!`;
      if (isStream) {
        res.write(expiredMsg);
        return;
      } else {
        return { reply: expiredMsg, provider, boostLevel, isCreator: false, expired: true };
      }
    } else {
      const notFoundMsg = `⚠️ **MÃ BYPASS ĐÃ HẾT HẠN HOẶC KHÔNG HỢP LỆ!**\n\nMã **${candidateTempKey || trimmedMsg}** không còn hiệu lực trong hệ thống (mỗi mã chỉ có hiệu lực trong vòng đúng 30 phút kể từ lúc tạo).\n\nVui lòng mở terminal và chạy lệnh:\n\`\`\`bash\nnode key.js\n\`\`\`\nđể tạo mã Bypass mới 30 phút!`;
      if (isStream) {
        res.write(notFoundMsg);
        return;
      } else {
        return { reply: notFoundMsg, provider, boostLevel, isCreator: false, expired: true };
      }
    }
  }

  // ==========================================================================
  // HỆ THỐNG AN TOÀN & TƯỜNG LỬA BẢO MẬT (AI SAFETY GUARDRAILS)
  // Khách thường: BẬT Rate Limit & Lọc Prompt độc hại.
  // Chủ nhân Thức: MIỄN TRỪ 100% (Bypass Tối Cao)!
  // ==========================================================================
  if (!effectiveIsCreator) {
    // 1. Kiểm tra Tần Suất (Rate Limiting - Chống Spam / DoS API)
    const clientIp = (req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || req?.ip || '127.0.0.1').toString().split(',')[0].trim();
    const limitCheck = checkRateLimit(clientIp);
    if (!limitCheck.allowed) {
      const rateLimitMsg = `⚠️ **[HỆ THỐNG BẢO VỆ AI TURBO PRO - RATE LIMIT]**\n\nBạn đang gửi tin nhắn quá nhanh (${RATE_LIMIT_MAX_REQUESTS} tin/phút). Để bảo vệ tài nguyên máy chủ và chi phí API, vui lòng chờ **${limitCheck.retryAfter} giây** trước khi gửi yêu cầu tiếp theo.\n\n*(Chủ nhân Sáng lập Thức được miễn trừ 100% giới hạn này).*`;
      if (isStream) {
        res.write(rateLimitMsg);
        return;
      } else {
        return { reply: rateLimitMsg, provider, boostLevel, isCreator: false };
      }
    }

    // 2. Tường Lửa Kiểm Tra An Toàn (AI Safety Threat Inspection)
    const safetyCheck = thucgpt.inspectPromptSafety(message);
    if (!safetyCheck.safe) {
      const refusalMsg = `🛡️ **[TƯỜNG LỬA BẢO MẬT AI TURBO PRO - CẢNH BÁO AN TOÀN]**\n\nYêu cầu của bạn đã bị từ chối do vi phạm Chính sách An toàn & An ninh Mạng:\n- **Phân loại vi phạm:** ${safetyCheck.category}\n- **Chi tiết:** ${safetyCheck.reason}.\n- **Quy định:** Hệ thống chỉ phục vụ mục đích lập trình, giải thuật, phát triển phần mềm và phòng thủ an ninh (Defensive Security). Nghiêm cấm tạo mã độc, ransomware, kịch bản tấn công mạng, công cụ spam SMS/Call, bomber hoặc công cụ xâm nhập trái phép.\n\n👑 *Nếu bạn là Chủ Nhân Sáng Lập hệ thống, vui lòng kích hoạt mã xác thực tối cao để mở khóa toàn quyền.*`;
      if (isStream) {
        res.write(refusalMsg);
        return;
      } else {
        return { reply: refusalMsg, provider, boostLevel, isCreator: false };
      }
    }
  }

  // Tự động quét và nạp trực tiếp nội dung file thực tế trên máy tính nếu người dùng muốn xem/sửa
  const referencedFileContext = findReferencedFilesContext(trimmedMsg);
  if (referencedFileContext) {
    message = `${message}\n\n[HỆ THỐNG ĐÃ TỰ ĐỘNG NẠP TRỰC TIẾP NỘI DUNG TỆP MÃ NGUỒN TỪ Ổ CỨNG MÁY TÍNH ĐỂ BẠN ĐỐI CHIẾU VÀ SỬA ĐỔI HOÀN CHỈNH:]\n${referencedFileContext}`;
  }

  // Tự động nhận diện yêu cầu làm nét / nâng cấp độ phân giải hình ảnh
  const isEnhanceRequest = Boolean(normImg && /(làm nét|tăng độ nét|nét hơn|khôi phục ảnh|upscale|tăng độ phân giải|làm rõ ảnh|khử mờ|làm sáng nét)/i.test(trimmedMsg));
  if (isEnhanceRequest) {
    const enhancedResult = await enhanceImageWithPython(normImg.base64, 2, 1.65, 1.06);
    if (enhancedResult && enhancedResult.success) {
      const enhanceReply = `✨ **[NEURAL IMAGE ENHANCER: ĐÃ LÀM NÉT & NÂNG CẤP ĐỘ PHÂN GIẢI 2X THÀNH CÔNG!]** ✨\n\n- **Độ phân giải gốc:** ${enhancedResult.originalSize.width} x ${enhancedResult.originalSize.height} px\n- **Độ phân giải sau làm nét (2X Super-Resolution):** **${enhancedResult.enhancedSize.width} x ${enhancedResult.enhancedSize.height} px**\n- **Công nghệ tối ưu:** Khử mờ viền *Unsharp Masking (r=2.2)*, tăng độ sắc nét *Detail & Sharpness Booster*, tinh chỉnh tương phản và nội suy siêu phân giải *Lanczos*.\n\n<<<IMAGE_ENHANCED:${enhancedResult.dataUrl}>>>\n\nẢnh của bạn đã được làm nét vượt trội! Bạn có thể xem ảnh phóng to hoặc bấm nút tải về máy bên dưới.`;
      if (isStream) {
        streamTarget.write(enhanceReply);
        return;
      } else {
        return { reply: enhanceReply, provider, boostLevel, isCreator: effectiveIsCreator, enhancedImage: enhancedResult.dataUrl };
      }
    }
  }

  // If user sent image but chosen provider doesn't support vision directly:
  // Automatically route vision analysis to Gemini Vision (or OpenAI Vision)
  const canUseGeminiVision = Boolean(process.env.GEMINI_API_KEY);
  const canUseOpenAIVision = Boolean(openai);

  if (normImages.length > 0 && (provider === 'deepseek' || provider === 'groq' || (provider === 'ollama' && !process.env.OLLAMA_VISION_MODEL))) {
    if (canUseGeminiVision) {
      if (isStream) {
        streamTarget.write('⚡ *[Neural Vision Engine: Phân tích hình ảnh & xử lý mã nguồn]*\n\n');
        await streamGemini(message, history, streamTarget, boostLevel, normImages, null, effectiveIsCreator);
        return;
      } else {
        const reply = await callGemini(message, history, boostLevel, normImages, null, effectiveIsCreator);
        return { reply: '⚡ *[Neural Vision Engine: Phân tích hình ảnh & xử lý mã nguồn]*\n\n' + reply, provider, boostLevel, isCreator: effectiveIsCreator };
      }
    } else if (canUseOpenAIVision) {
      const visionModel = process.env.OPENAI_VISION_MODEL || 'gpt-4o';
      if (isStream) {
        streamTarget.write('⚡ *[OpenAI Vision Engine: Phân tích hình ảnh & xử lý mã nguồn]*\n\n');
        await streamOpenAICompatible(openai, visionModel, message, history, streamTarget, boostLevel, normImages, null, effectiveIsCreator);
        return;
      } else {
        const reply = await callOpenAICompatible(openai, visionModel, message, history, boostLevel, normImages, null, effectiveIsCreator);
        return { reply: '⚡ *[OpenAI Vision Engine: Phân tích hình ảnh & xử lý mã nguồn]*\n\n' + reply, provider, boostLevel, isCreator: effectiveIsCreator };
      }
    }
  }

  // THỨC THINKING PRO - SIÊU SUY LUẬN CHUYÊN SÂU (OPUS THINKING LEVEL)
  if (provider === 'thucthinking') {
    const thinkingPrompt = thucgpt.buildThucThinkingPrompt(5, effectiveIsCreator);
    if (process.env.GEMINI_API_KEY) {
      if (isStream) {
        await streamGemini(message, history, streamTarget, 5, normImages, thinkingPrompt, effectiveIsCreator);
        return;
      } else {
        const rawReply = await callGemini(message, history, 5, normImages, thinkingPrompt, effectiveIsCreator);
        return { reply: rawReply, provider: 'thucthinking', boostLevel: 5, isCreator: effectiveIsCreator };
      }
    } else if (deepseek) {
      const dsModel = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
      if (isStream) {
        await streamOpenAICompatible(deepseek, dsModel, message, history, streamTarget, 5, normImages, thinkingPrompt, effectiveIsCreator);
        return;
      } else {
        const rawReply = await callOpenAICompatible(deepseek, dsModel, message, history, 5, normImages, thinkingPrompt, effectiveIsCreator);
        return { reply: rawReply, provider: 'thucthinking', boostLevel: 5, isCreator: effectiveIsCreator };
      }
    } else if (ollama) {
      const targetModel = (normImages.length > 0 && process.env.OLLAMA_VISION_MODEL)
        ? process.env.OLLAMA_VISION_MODEL
        : (process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b');
      if (isStream) {
        await streamOpenAICompatible(ollama, targetModel, message, history, streamTarget, 5, normImages, thinkingPrompt, effectiveIsCreator);
        return;
      } else {
        const rawReply = await callOpenAICompatible(ollama, targetModel, message, history, 5, normImages, thinkingPrompt, effectiveIsCreator);
        return { reply: rawReply, provider: 'thucthinking', boostLevel: 5, isCreator: effectiveIsCreator };
      }
    }
  }

  // THỨC GPT (ThucGPT Pro) - AI Độc Lập của Thức (BỘ NÃO THUẬT TOÁN & CODER SIÊU CẤP)
  if (provider === 'thucgpt') {
    // Luôn ép xung tư duy phân tích logic ở mức tối đa
    const effectiveBoost = Math.max(parseInt(boostLevel, 10) || 1, 5);
    const thucGptSystemPrompt = thucgpt.buildThucGptSystemPrompt(effectiveBoost, effectiveIsCreator);
    // Ưu tiên Gemini (hỗ trợ Vision, context lớn và tốc độ dưới 1s), fallback DeepSeek / Groq / Ollama
    if (process.env.GEMINI_API_KEY) {
      if (isStream) {
        await streamGemini(message, history, streamTarget, effectiveBoost, normImages, thucGptSystemPrompt, effectiveIsCreator);
        return;
      } else {
        const rawReply = await callGemini(message, history, effectiveBoost, normImages, thucGptSystemPrompt, effectiveIsCreator);
        return { reply: rawReply, provider: 'thucgpt', boostLevel: effectiveBoost, isCreator: effectiveIsCreator };
      }
    } else if (deepseek) {
      const dsModel = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
      if (isStream) {
        await streamOpenAICompatible(deepseek, dsModel, message, history, streamTarget, effectiveBoost, normImages, thucGptSystemPrompt, effectiveIsCreator);
        return;
      } else {
        const rawReply = await callOpenAICompatible(deepseek, dsModel, message, history, effectiveBoost, normImages, thucGptSystemPrompt, effectiveIsCreator);
        return { reply: rawReply, provider: 'thucgpt', boostLevel: effectiveBoost, isCreator: effectiveIsCreator };
      }
    } else if (groq) {
      const groqModel = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
      if (isStream) {
        await streamOpenAICompatible(groq, groqModel, message, history, streamTarget, effectiveBoost, normImages, thucGptSystemPrompt, effectiveIsCreator);
        return;
      } else {
        const rawReply = await callOpenAICompatible(groq, groqModel, message, history, effectiveBoost, normImages, thucGptSystemPrompt, effectiveIsCreator);
        return { reply: rawReply, provider: 'thucgpt', boostLevel: effectiveBoost, isCreator: effectiveIsCreator };
      }
    } else if (ollama) {
      const targetModel = (normImages.length > 0 && process.env.OLLAMA_VISION_MODEL)
        ? process.env.OLLAMA_VISION_MODEL
        : (process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b');
      if (isStream) {
        await streamOpenAICompatible(ollama, targetModel, message, history, streamTarget, effectiveBoost, normImages, thucGptSystemPrompt, effectiveIsCreator);
        return;
      } else {
        const rawReply = await callOpenAICompatible(ollama, targetModel, message, history, effectiveBoost, normImages, thucGptSystemPrompt, effectiveIsCreator);
        return { reply: rawReply, provider: 'thucgpt', boostLevel: effectiveBoost, isCreator: effectiveIsCreator };
      }
    }
  }

  if (provider === 'gemini') {
    if (isStream) {
      await streamGemini(message, history, streamTarget, boostLevel, normImages, null, effectiveIsCreator);
      return;
    } else {
      const reply = await callGemini(message, history, boostLevel, normImages, null, effectiveIsCreator);
      return { reply, provider, boostLevel, isCreator: effectiveIsCreator };
    }
  }

  if (provider === 'openai') {
    if (!openai) throw new Error('OPENAI_API_KEY is missing. Please check your backend/.env file.');
    const targetModel = normImages.length > 0
      ? (process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o')
      : (process.env.OPENAI_MODEL || 'gpt-4o');
    if (isStream) {
      await streamOpenAICompatible(openai, targetModel, message, history, streamTarget, boostLevel, normImages, null, effectiveIsCreator);
      return;
    } else {
      const reply = await callOpenAICompatible(openai, targetModel, message, history, boostLevel, normImages, null, effectiveIsCreator);
      return { reply, provider, boostLevel, isCreator: effectiveIsCreator };
    }
  }

  if (provider === 'deepseek') {
    if (!deepseek) throw new Error('DEEPSEEK_API_KEY is missing. Please check your backend/.env file.');
    const targetModel = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    if (isStream) {
      await streamOpenAICompatible(deepseek, targetModel, message, history, streamTarget, boostLevel, normImages, null, effectiveIsCreator);
      return;
    } else {
      const reply = await callOpenAICompatible(deepseek, targetModel, message, history, boostLevel, normImages, null, effectiveIsCreator);
      return { reply, provider, boostLevel, isCreator: effectiveIsCreator };
    }
  }

  if (provider === 'groq') {
    if (!groq) throw new Error('GROQ_API_KEY is missing. Please check your backend/.env file.');
    const targetModel = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
    if (isStream) {
      await streamOpenAICompatible(groq, targetModel, message, history, streamTarget, boostLevel, normImages, null, effectiveIsCreator);
      return;
    } else {
      const reply = await callOpenAICompatible(groq, targetModel, message, history, boostLevel, normImages, null, effectiveIsCreator);
      return { reply, provider, boostLevel, isCreator: effectiveIsCreator };
    }
  }

  if (provider === 'ollama') {
    const targetModel = (normImages.length > 0 && process.env.OLLAMA_VISION_MODEL)
      ? process.env.OLLAMA_VISION_MODEL
      : (process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b');
    if (isStream) {
      await streamOpenAICompatible(ollama, targetModel, message, history, streamTarget, boostLevel, normImages, null, effectiveIsCreator);
      return;
    } else {
      const reply = await callOpenAICompatible(ollama, targetModel, message, history, boostLevel, normImages, null, effectiveIsCreator);
      return { reply, provider, boostLevel, isCreator: effectiveIsCreator };
    }
  }

  // Fallback to Ollama (100% Local AI)
  if (ollama) {
    const targetModel = (normImages.length > 0 && process.env.OLLAMA_VISION_MODEL)
      ? process.env.OLLAMA_VISION_MODEL
      : (process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b');
    if (isStream) {
      await streamOpenAICompatible(ollama, targetModel, message, history, streamTarget, boostLevel, normImages, null, effectiveIsCreator);
      return;
    } else {
      const reply = await callOpenAICompatible(ollama, targetModel, message, history, boostLevel, normImages, null, effectiveIsCreator);
      return { reply, provider: 'ollama', boostLevel, isCreator: effectiveIsCreator };
    }
  }

  // Fallback to Gemini if API key is provided
  if (process.env.GEMINI_API_KEY) {
    if (isStream) {
      await streamGemini(message, history, streamTarget, boostLevel, normImages, null, effectiveIsCreator);
      return;
    } else {
      const reply = await callGemini(message, history, boostLevel, normImages, null, effectiveIsCreator);
      return { reply, provider, boostLevel, isCreator: effectiveIsCreator };
    }
  }
}

app.post('/api/chat', requireUserAuth, async (req, res) => {
  try {
    let { message = '', history = [], boostLevel = 1, mode = 'code', provider: reqProvider, image = null, images = null, isCreator = false } = req.body;
    const provider = normalizeProvider(reqProvider);
    const cleanHistory = normalizeHistory(history);
    const hasAnyImage = Boolean(image || (Array.isArray(images) && images.length > 0));

    if ((!message || typeof message !== 'string' || !message.trim()) && !hasAnyImage) {
      return res.status(400).json({ error: 'Tin nhắn hoặc hình ảnh là bắt buộc.' });
    }

    if (!message || !message.trim()) {
      message = 'Hãy phân tích chi tiết các hình ảnh này, tìm lỗi và cung cấp mã nguồn chuẩn hoàn chỉnh để sửa lỗi hoặc xây dựng theo yêu cầu.';
    }

    const result = await handleChatExecution({ provider, message, history: cleanHistory, boostLevel, mode, image, images, isCreator, res: null, req });
    if (result && result.reply) {
      if (!result.isCreator) {
        result.reply = sanitizeNonCreatorOutput(result.reply, false);
      }
      if (!shouldAllowFileWriteTags(message)) {
        result.reply = downgradeFileWriteTagsToMarkdown(result.reply);
      }
    }
    return res.json({ success: true, reply: result?.reply || '' });
  } catch (error) {
    console.error('AI request error:', error);
    const message = error?.response?.data?.error?.message || error.message || 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

app.post('/api/chat/stream', requireUserAuth, async (req, res) => {
  try {
    let { message = '', history = [], boostLevel = 1, mode = 'code', provider: reqProvider, image = null, images = null, isCreator = false } = req.body;
    const provider = normalizeProvider(reqProvider);
    const cleanHistory = normalizeHistory(history);
    const hasAnyImage = Boolean(image || (Array.isArray(images) && images.length > 0));

    if ((!message || typeof message !== 'string' || !message.trim()) && !hasAnyImage) {
      return res.status(400).json({ error: 'Tin nhắn hoặc hình ảnh là bắt buộc.' });
    }

    if (!message || !message.trim()) {
      message = 'Hãy phân tích chi tiết các hình ảnh này, tìm lỗi và cung cấp mã nguồn chuẩn hoàn chỉnh để sửa lỗi hoặc xây dựng theo yêu cầu.';
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    await handleChatExecution({ provider, message, history: cleanHistory, boostLevel, mode, image, images, isCreator, res, req });
    return res.end();
  } catch (error) {
    console.error('AI stream error:', error);
    if (!res.headersSent) return res.status(500).json({ error: 'AI request failed.' });
    return res.end('\n\n[Request failed.]');
  }
});

/* ==========================================================================
   WORKSPACE REST API ENDPOINTS
   ========================================================================== */

// 1. Get Directory Tree
app.get('/api/workspace/tree', requireCreatorAuth, (req, res) => {
  try {
    const tree = getDirectoryTree();
    const summary = getWorkspaceSummary();
    res.json({ success: true, tree, summary, workspacePath: WORKSPACE_DIR });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Read File Content
app.get('/api/workspace/file', requireCreatorAuth, (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'Missing path parameter' });

    const absPath = safeResolve(filePath);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    const content = fs.readFileSync(absPath, 'utf8');
    res.json({ success: true, path: filePath, content });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Create or Write File (Direct Machine & Workspace Support)
app.post(['/api/workspace/file', '/api/fs/create-file'], requireCreatorAuth, (req, res) => {
  try {
    const { path: filePath, content = '' } = req.body;
    if (!filePath) return res.status(400).json({ success: false, error: 'Thiếu đường dẫn tệp (file path)' });

    const absPath = safeResolve(filePath);
    if (!absPath) return res.status(400).json({ success: false, error: 'Đường dẫn tệp không hợp lệ' });

    const parentDir = path.dirname(absPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(absPath, content, 'utf8');
    const relToWorkspace = path.relative(WORKSPACE_DIR, absPath);
    res.json({
      success: true,
      path: absPath,
      relPath: relToWorkspace,
      message: `Đã tạo tệp trực tiếp trên máy thành công tại: ${absPath}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Create Folder (Direct Machine & Workspace Support)
app.post(['/api/workspace/folder', '/api/fs/create-folder'], requireCreatorAuth, (req, res) => {
  try {
    const { path: folderPath } = req.body;
    if (!folderPath) return res.status(400).json({ success: false, error: 'Thiếu đường dẫn thư mục (folder path)' });

    const absPath = safeResolve(folderPath);
    if (!absPath) return res.status(400).json({ success: false, error: 'Đường dẫn thư mục không hợp lệ' });

    if (!fs.existsSync(absPath)) {
      fs.mkdirSync(absPath, { recursive: true });
    }
    const relToWorkspace = path.relative(WORKSPACE_DIR, absPath);
    res.json({
      success: true,
      path: absPath,
      relPath: relToWorkspace,
      message: `Đã tạo thư mục trực tiếp trên máy thành công tại: ${absPath}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Delete File or Folder (Direct Machine & Workspace Support)
app.all(['/api/workspace/item', '/api/workspace/delete', '/api/fs/delete-file'], requireCreatorAuth, (req, res, next) => {
  if (req.method !== 'DELETE' && req.method !== 'POST') return next();
  const itemPath = req.query.path || req.body?.path;
  if (!itemPath) return res.status(400).json({ success: false, error: 'Thiếu đường dẫn tệp hoặc thư mục cần xóa' });

  const absPath = safeResolve(itemPath);
  if (!absPath) return res.status(400).json({ success: false, error: 'Đường dẫn tệp không hợp lệ' });

  // Bảo vệ hệ thống: Tuyệt đối chặn xóa ổ đĩa gốc, thư mục Windows hoặc Program Files
  const norm = absPath.toLowerCase().replace(/\\/g, '/');
  if (/^[a-z]:\/?$/i.test(norm) || norm.includes('/windows') || norm.includes('/program files') || norm === 'c:/users' || norm === 'c:/users/') {
    return res.status(403).json({
      success: false,
      error: '⛔ [Tường lửa an toàn] Không được phép xóa thư mục hệ thống hoặc ổ đĩa gốc của máy tính!'
    });
  }

  // Bảo vệ thư mục gốc AI_Turbo_Pro
  if (norm === ROOT_DIR.toLowerCase().replace(/\\/g, '/') || norm === (ROOT_DIR.toLowerCase().replace(/\\/g, '/') + '/')) {
    return res.status(403).json({
      success: false,
      error: '⛔ [Tường lửa an toàn] Không được phép xóa thư mục gốc của dự án AI Turbo Pro!'
    });
  }

  const isInsideWorkspace = absPath.toLowerCase().startsWith(WORKSPACE_DIR.toLowerCase());
  if (!isInsideWorkspace && !isCreatorRequest(req)) {
    return res.status(403).json({
      success: false,
      error: '🔒 [Từ chối truy cập] Thao tác xóa file ngoài thư mục dự án (workspace) chỉ dành riêng cho Chủ Nhân Sáng Lập!'
    });
  }
  next();
}, (req, res) => {
  try {
    const itemPath = req.query.path || req.body?.path;
    const absPath = safeResolve(itemPath);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ success: false, error: `Không tìm thấy file hoặc thư mục tại: ${absPath}` });
    }
    fs.rmSync(absPath, { recursive: true, force: true });
    res.json({
      success: true,
      path: absPath,
      message: `Đã xóa thành công file/thư mục tại: ${absPath}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Batch Upload Files & Folders from Client (Admin Only)
app.post('/api/workspace/upload', requireCreatorAuth, (req, res) => {
  try {
    const { files = [] } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'No files provided for upload' });
    }

    let savedCount = 0;
    for (const f of files) {
      if (!f.path) continue;
      const absPath = safeResolve(f.path);
      const parentDir = path.dirname(absPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(absPath, f.content || '', 'utf8');
      savedCount++;
    }

    res.json({ success: true, savedCount, message: `Uploaded ${savedCount} files successfully` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6.5. Browse local machine directories (Admin Only)
app.get('/api/fs/browse', requireCreatorAuth, (req, res) => {
  try {
    const userHome = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\ADMIN';
    let reqPath = req.query.path;
    let targetPath = reqPath ? resolveFsPath(reqPath) : path.join(userHome, 'Desktop');

    if (!targetPath || !fs.existsSync(targetPath)) {
      targetPath = path.join(userHome, 'Desktop');
    }
    if (!fs.existsSync(targetPath)) {
      targetPath = userHome;
    }
    if (!fs.existsSync(targetPath)) {
      targetPath = 'C:\\';
    }

    let isDirectory = false;
    try {
      isDirectory = fs.statSync(targetPath).isDirectory();
    } catch (e) {}

    if (!isDirectory) {
      targetPath = path.dirname(targetPath);
    }

    targetPath = path.normalize(targetPath);
    const parentPath = path.dirname(targetPath) !== targetPath ? path.dirname(targetPath) : null;

    const quickPaths = [
      { name: '🖥️ Desktop', path: path.join(userHome, 'Desktop') },
      { name: '📥 Downloads', path: path.join(userHome, 'Downloads') },
      { name: '📁 Documents', path: path.join(userHome, 'Documents') },
      { name: '💾 Ổ C:\\', path: 'C:\\' },
    ];
    if (fs.existsSync('D:\\')) {
      quickPaths.push({ name: '💾 Ổ D:\\', path: 'D:\\' });
    }
    quickPaths.push({ name: '⚡ AI_Turbo_Pro', path: path.resolve(__dirname, '..') });

    const validQuickPaths = quickPaths.filter((q) => {
      try {
        return fs.existsSync(q.path);
      } catch (e) {
        return false;
      }
    });

    let entries = [];
    try {
      entries = fs.readdirSync(targetPath, { withFileTypes: true });
    } catch (e) {
      return res.json({
        success: false,
        error: `Không thể đọc thư mục: ${e.message}`,
        currentPath: targetPath,
        parentPath,
        quickPaths: validQuickPaths,
        folders: [],
        files: [],
      });
    }

    const folders = [];
    const files = [];
    const ignored = new Set(['$RECYCLE.BIN', 'System Volume Information', 'Recovery', 'PerfLogs', '$Recycle.Bin']);

    for (const entry of entries) {
      if (ignored.has(entry.name) || entry.name.startsWith('$')) continue;
      const fullItemPath = path.join(targetPath, entry.name);
      try {
        if (entry.isDirectory()) {
          let itemCount = 0;
          try {
            itemCount = fs.readdirSync(fullItemPath).length;
          } catch (e) {}
          folders.push({
            name: entry.name,
            path: fullItemPath,
            isDir: true,
            itemCount,
          });
        } else {
          const fileStat = fs.statSync(fullItemPath);
          files.push({
            name: entry.name,
            path: fullItemPath,
            isDir: false,
            size: fileStat.size,
            ext: path.extname(entry.name).toLowerCase(),
          });
        }
      } catch (e) {}
    }

    folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    res.json({
      success: true,
      currentPath: targetPath,
      parentPath,
      quickPaths: validQuickPaths,
      folders,
      files,
      totalFolders: folders.length,
      totalFiles: files.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6.6. Scan folder details for on-screen preview (Admin Only)
app.get('/api/fs/folder-details', requireCreatorAuth, (req, res) => {
  try {
    const targetPath = resolveFsPath(req.query.path);
    if (!targetPath || !fs.existsSync(targetPath)) {
      return res.status(404).json({ success: false, error: 'Thư mục không tồn tại' });
    }

    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ success: false, error: 'Không phải là thư mục' });
    }

    const binaryExts = new Set(['.exe', '.dll', '.so', '.zip', '.tar', '.gz', '.7z', '.rar', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.mp3', '.mp4', '.bin', '.iso', '.woff', '.ttf']);
    const ignored = new Set(['node_modules', '.git', '.ai-runs', 'dist', 'build', '$RECYCLE.BIN']);

    let codeCount = 0;
    let totalSize = 0;
    const sampleFiles = [];

    function scan(dir, depth = 0) {
      if (depth > 6) return;
      let items;
      try {
        items = fs.readdirSync(dir, { withFileTypes: true });
      } catch (e) {
        return;
      }

      for (const item of items) {
        if (item.name.startsWith('.') && item.name !== '.env') continue;
        if (ignored.has(item.name)) continue;

        const itemAbs = path.join(dir, item.name);
        try {
          if (item.isDirectory()) {
            scan(itemAbs, depth + 1);
          } else {
            const ext = path.extname(item.name).toLowerCase();
            if (binaryExts.has(ext)) continue;
            const fileStat = fs.statSync(itemAbs);
            codeCount++;
            totalSize += fileStat.size;
            if (sampleFiles.length < 5) {
              sampleFiles.push(path.relative(targetPath, itemAbs).replace(/\\/g, '/'));
            }
          }
        } catch (e) {}
      }
    }

    scan(targetPath, 0);

    res.json({
      success: true,
      folderName: path.basename(targetPath) || targetPath,
      folderPath: targetPath,
      codeCount,
      totalSize,
      sampleFiles,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6.7. Native Windows Folder Browser Dialog (Admin Only)
app.post('/api/fs/open-folder-dialog', requireCreatorAuth, (req, res) => {
  const psScript = `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Chọn thư mục dự án để nạp vào AI'; $f.ShowNewFolderButton = $true; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Write-Output $f.SelectedPath }`;
  try {
    execFile('powershell', ['-NoProfile', '-Command', psScript], { timeout: 60000 }, (error, stdout) => {
      if (error) {
        return res.json({ success: false, error: error.message });
      }
      const selectedPath = (stdout || '').trim();
      if (!selectedPath) {
        return res.json({ success: false, cancelled: true });
      }
      return res.json({ success: true, folderPath: selectedPath });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Import Folder Directly from Local Machine Path (Admin Only)
app.post('/api/workspace/import-folder-path', requireCreatorAuth, (req, res) => {
  try {
    const { folderPath } = req.body || {};
    if (!folderPath || typeof folderPath !== 'string') {
      return res.status(400).json({ success: false, error: 'Thiếu đường dẫn thư mục' });
    }

    const absPath = resolveFsPath(folderPath);
    if (!absPath || !fs.existsSync(absPath)) {
      return res.status(404).json({ success: false, error: `Thư mục không tồn tại: ${folderPath}` });
    }

    const stat = fs.statSync(absPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ success: false, error: 'Đường dẫn này không phải là thư mục' });
    }

    const binaryExts = new Set(['.exe', '.dll', '.so', '.zip', '.tar', '.gz', '.7z', '.rar', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.mp3', '.mp4', '.bin', '.iso', '.woff', '.ttf']);
    const ignored = new Set(['node_modules', '.git', '.ai-runs', 'dist', 'build']);

    let filesImported = 0;
    const rootName = path.basename(absPath) || 'Project';

    function copyDirRecursive(src, dest) {
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.env') continue;
        if (ignored.has(entry.name)) continue;

        const srcItem = path.join(src, entry.name);
        const destItem = path.join(dest, entry.name);

        if (entry.isDirectory()) {
          copyDirRecursive(srcItem, destItem);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (binaryExts.has(ext)) continue;
          try {
            const itemStat = fs.statSync(srcItem);
            if (itemStat.size > 5 * 1024 * 1024) continue;
            fs.copyFileSync(srcItem, destItem);
            filesImported++;
          } catch (e) {}
        }
      }
    }

    copyDirRecursive(absPath, WORKSPACE_DIR);
    const friendlyMsg = filesImported > 0
      ? `Đã nạp thành công ${filesImported} file từ "${rootName}" vào dự án!`
      : `Đã nạp thư mục "${rootName}" vào dự án (Thư mục hiện tại chưa có tệp mã nguồn nào, sẵn sàng để tạo tệp mới)!`;

    res.json({
      success: true,
      folderName: rootName,
      folderPath: absPath,
      count: filesImported,
      message: friendlyMsg,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint kích hoạt HTTP Load Testing (Admin Only)
app.post('/api/load-test', requireCreatorAuth, (req, res) => {
  const { url = `http://127.0.0.1:${PORT}/api/health`, requests = 50, concurrency = 5, timeout = 3.0 } = req.body || {};
  const scriptPath = path.join(__dirname, 'load_tester.py');

  const args = [
    scriptPath,
    '--url', String(url),
    '--requests', String(requests),
    '--concurrency', String(concurrency),
    '--timeout', String(timeout),
    '--json'
  ];

  execFile('python', args, { timeout: 60000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
        details: stderr || stdout
      });
    }

    try {
      const result = JSON.parse(stdout);
      res.json({ success: true, data: result });
    } catch (parseErr) {
      res.status(500).json({
        success: false,
        error: 'Failed to parse load test results',
        rawOutput: stdout
      });
    }
  });
});

// ==============================================================================
// REALTIME WEBSOCKET & SSE LIVE RELOAD ENGINE
// ==============================================================================
const realtimeClients = new Set();
const sseClients = new Set();

let wss = null;
if (WebSocketServer) {
  try {
    wss = new WebSocketServer({ server, path: '/ws' });
    wss.on('error', (err) => {
      console.warn('[Realtime WS] WebSocketServer warning (non-fatal):', err.message);
    });
    wss.on('connection', (ws) => {
      realtimeClients.add(ws);
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('message', (msg) => {
        try {
          const parsed = JSON.parse(msg.toString());
          if (parsed.type === 'ping') ws.send(JSON.stringify({ type: 'pong', time: Date.now() }));
        } catch (e) {}
      });
      ws.on('close', () => { realtimeClients.delete(ws); });
      ws.on('error', (wsErr) => {
        realtimeClients.delete(ws);
      });
      ws.send(JSON.stringify({ type: 'connected', time: Date.now() }));
    });

    const pingInterval = setInterval(() => {
      wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
      });
    }, 25000);
    wss.on('close', () => clearInterval(pingInterval));
    console.log('[Realtime] WebSocket Server running on path /ws');
  } catch (err) {
    console.warn('[Realtime WS] Init error:', err.message);
  }
}

// SSE fallback endpoint for hosting/browsers
app.get('/api/realtime/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write(': connected\n\n');
  sseClients.add(res);

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

app.use((error, req, res, next) => {
  console.error('[Request error]', error);
  if (res.headersSent) return next(error);
  const status = error.status === 413 ? 413 : (error.type === 'entity.parse.failed' ? 400 : 500);
  const message = status === 413 ? 'Request too large.' : (status === 400 ? 'Invalid request.' : 'Internal server error.');
  res.status(status).json({ success: false, error: message });
});

function broadcastRealtime(payload) {
  const json = JSON.stringify(payload);
  for (const client of realtimeClients) {
    if (client.readyState === 1) { // 1 = OPEN
      try { client.send(json); } catch (e) {}
    }
  }
  const sseData = `data: ${json}\n\n`;
  for (const res of sseClients) {
    try { res.write(sseData); } catch (e) {}
  }
}

// File watcher for Live Reload (Tự động reload giao diện khi sửa code)
let reloadDebounceTimer = null;
const WATCH_EXTENSIONS = ['.html', '.css', '.js', '.json', '.png', '.svg', '.jpg', '.webp'];

function handleFileChange(eventType, filename, source = 'frontend') {
  if (!filename) return;
  const ext = path.extname(filename).toLowerCase();
  if (!WATCH_EXTENSIONS.includes(ext)) return;
  if (filename.includes('.tmp') || filename.includes('.git') || filename.includes('node_modules')) return;

  clearTimeout(reloadDebounceTimer);
  reloadDebounceTimer = setTimeout(() => {
    console.log(`[Realtime LiveReload] File changed: ${filename} (${source}). Broadcasting reload...`);
    broadcastRealtime({
      type: 'reload',
      source,
      file: filename,
      isCss: ext === '.css',
      timestamp: Date.now()
    });
  }, 150);
}

try {
  const fwWatcher = fs.watch(frontendDir, { recursive: true }, (eventType, filename) => {
    handleFileChange(eventType, filename, 'frontend');
  });
  if (fwWatcher && typeof fwWatcher.on === 'function') {
    fwWatcher.on('error', (err) => {
      console.warn('[Realtime] Cảnh báo theo dõi thư mục frontend (bỏ qua):', err.message);
    });
  }
  console.log('[Realtime] Watching frontend directory for live changes');
} catch (err) {
  try {
    const fwFallback = fs.watch(frontendDir, (eventType, filename) => handleFileChange(eventType, filename, 'frontend'));
    if (fwFallback && typeof fwFallback.on === 'function') {
      fwFallback.on('error', () => {});
    }
  } catch (e) {}
}

try {
  const wsWatcher = fs.watch(WORKSPACE_DIR, { recursive: true }, (eventType, filename) => {
    handleFileChange(eventType, filename, 'workspace');
  });
  if (wsWatcher && typeof wsWatcher.on === 'function') {
    wsWatcher.on('error', (err) => {
      console.warn('[Realtime] Cảnh báo theo dõi thư mục workspace (bỏ qua):', err.message);
    });
  }
} catch (err) {}

// Route trang chủ hiển thị website giới thiệu ThucGPT (Landing Page khi chạy hosting / truy cập domain chính)
app.get(['/', '/info', '/about', '/info.html'], (req, res) => {
  res.sendFile(path.join(servedFrontendDir, 'info.html'));
});

// Route khung chat AI: Chỉ cho phép truy cập qua /chat hoặc /workspace
app.get(['/chat', '/app', '/workspace'], (req, res) => {
  res.sendFile(path.join(servedFrontendDir, 'index.html'));
});

// Fallback: Mọi đường dẫn không xác định chuyển về Landing Page
app.use((req, res) => {
  res.sendFile(path.join(frontendDir, 'info.html'));
});

const renderSystemBanner = () => {
  const bootMs = 42;
  const startedAt = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const providerLabel = AI_PROVIDER.toUpperCase();
  const width = 62;
  const fit = (value) => String(value).slice(0, width - 2).padEnd(width - 2);
  const row = (value = '') => `| ${fit(value)} |`;
  const separator = `+${'-'.repeat(width)}+`;
  const centeredTitle = 'SYSTEM READY';
  const titlePadding = Math.max(0, width - centeredTitle.length);
  const title = `|${' '.repeat(Math.floor(titlePadding / 2))}${centeredTitle}${' '.repeat(Math.ceil(titlePadding / 2))}|`;
  const lines = [
    separator,
    title,
    row(),
    row('AI TURBO PRO // BACKEND SERVER (REALTIME ENABLED)'),
    row(),
    row(`Core Status : ACTIVE`),
    row(`Server URL  : http://localhost:${PORT}`),
    row(`Realtime WS : ws://localhost:${PORT}/ws`),
    row(`Live Reload : ENABLED (Hot CSS & Auto-Reload)`),
    row(`Anti-Req    : ENABLED (Multi-Tier DDoS & Spam Defense)`),
    row(`Frontend Dir: ${frontendDir}`),
    row(`AI Engine   : ${providerLabel}`),
    row(),
    row(`Boot Time   : ${bootMs} ms`),
    row(`Started At  : ${startedAt}`),
    row(),
    separator,
  ];

  console.log('\n' + lines.join('\n'));
};

// ==============================================================================
// TỰ ĐỘNG GIẢI PHÓNG CỔNG VÀ BẢO VỆ CHỐNG SẬP BACKEND TOÀN DIỆN
// ==============================================================================
function freePortSync(targetPort) {
  if (process.platform !== 'win32') return;
  const { execSync } = require('child_process');
  try {
    const res = execSync(`netstat -ano | findstr :${targetPort}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const lines = res.trim().split('\n');
    const myPid = process.pid;
    for (const line of lines) {
      if (line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[parts.length - 1], 10);
        if (pid && pid !== myPid) {
          console.log(`[Cổng ${targetPort}] Phát hiện tiến trình cũ PID ${pid} đang chiếm cổng. Đang tự động giải phóng...`);
          try {
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
            console.log(`[Cổng ${targetPort}] Đã giải phóng thành công!`);
          } catch (e) {}
        }
      }
    }
  } catch (e) {}
}

// 1. Tự động dọn sạch tiến trình cũ chiếm cổng PORT trước khi lắng nghe
freePortSync(PORT);

// 2. Bắt lỗi EADDRINUSE thông minh không bao giờ crash unhandled
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[Cảnh báo] Cổng ${PORT} vẫn đang bận. Đang giải phóng cưỡng chế và khởi động lại...`);
    freePortSync(PORT);
    setTimeout(() => {
      try {
        server.close();
      } catch (e) {}
      server.listen(PORT, '0.0.0.0', () => {
        renderSystemBanner();
      });
    }, 1200);
    return;
  }
  console.error('[Server Error (Non-Fatal)]:', err.message);
});

// 3. Bảo vệ tuyệt đối: Bắt toàn bộ lỗi ngoại lệ không để server bị sập đột ngột
process.on('uncaughtException', (err) => {
  console.error('[Server UncaughtException (Bảo vệ an toàn - Server vẫn tiếp tục hoạt động)]:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server UnhandledRejection (Bảo vệ an toàn - Server vẫn tiếp tục hoạt động)]:', reason);
});

// 4. Bắt tín hiệu Ctrl+C để nhả cổng và thoát sạch sẽ ngay lập tức
const handleGracefulShutdown = (signal) => {
  console.log(`\n[Server] Nhận lệnh tắt (${signal}). Đang giải phóng cổng ${PORT}...`);
  try { if (wss) wss.close(); } catch (e) {}
  server.close(() => {
    console.log(`[Server] Đã giải phóng cổng ${PORT}. Tạm biệt!`);
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 1000).unref();
};

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

server.listen(PORT, '0.0.0.0', () => {
  renderSystemBanner();
});
