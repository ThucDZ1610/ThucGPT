# AI Turbo Pro - Context Export

## 1. Pham vi va luu y

- Day la cau truc thuc te cua workspace `c:\AI_Turbo_Pro` tai thoi diem tao tai lieu.
- Du an **khong co** thu muc `server/` hoac `app/src/`; phan tuong ung la `backend/` va `frontend/`.
- `backend/server.js` la entry point chinh cua server va phuc vu luon frontend.
- `frontend/` la giao dien chat chay tren trinh duyet.
- `workspace/` la thu muc code do AI doc, sua, chay va kiem thu qua REST API.
- Khong dua noi dung bi mat cua `backend/.env` hoac du lieu hoi thoai trong `backend/chat-history.json` vao tai lieu.
- `frontend/assets/logo.png` va `workspace/capconmemay/captcha-project/eng.traineddata` la file nhi phan, khong the hien duoi dang code text.

## 2. Cay thu muc

```text
AI_Turbo_Pro/
├── cautrucAI.md                  # Tai lieu ngu canh nay
├── cautrucAIOllama.md            # File cu, hien dang rong
├── package.json                  # Script start cap root
├── README.md                     # Huong dan cai dat/chay du an
├── start.js                      # Khoi dong backend, doi health roi mo trinh duyet
├── node_modules/                 # Dependencies cap root
├── backend/
│   ├── .env                      # Cau hinh local, co the chua API key; khong xuat noi dung
│   ├── .env.example              # Mau bien moi truong
│   ├── .gitignore
│   ├── chat-history.json         # Lich su chat runtime
│   ├── load_tester.py            # HTTP load tester dong bo bang requests
│   ├── package.json
│   ├── package-lock.json
│   ├── scanner.js                # TCP port scanner Node.js
│   ├── scanner.py                # TCP port scanner Python
│   └── server.js                 # Express server/API chinh
├── frontend/
│   ├── app.js                    # Controller UI, chat, history, upload, workspace, streaming
│   ├── index.html                # Markup giao dien
│   ├── package.json
│   ├── start.js                  # Kiem tra/khoi dong backend roi mo Chrome
│   ├── styles.css                # Toan bo giao dien cyberpunk responsive
│   └── assets/
│       └── logo.png              # Logo/avatar binary
└── workspace/
    ├── .ai-runs/                 # File tam tao khi /api/execute chay code
    ├── index.html                # Workspace demo
    ├── main.js                   # Workspace demo JS
    ├── style.css                 # Workspace demo CSS
    ├── README.md
    ├── test.txt
    ├── calculator.html           # Demo may tinh
    ├── calculator.css            # CSS may tinh
    ├── load_test.py              # Load tester async bang aiohttp
    ├── AI_Turbo_Pro/
    │   ├── hithudepzai.txt
    │   └── package.json
    ├── cac/
    │   └── c.js                  # CLI tai anh/video va quan ly file tai xuong
    ├── capconmemay/
    │   └── captcha-project/
    │       └── eng.traineddata   # Tesseract trained data binary
    ├── duong/
    │   └── dan/
    │       └── den/
    │           └── tools_spsm_sms.py
    ├── PNT/
    │   └── bot zalo/
    │       └── cachtaobotzalo.md
    └── tools_spsm_sms/            # Hien khong co file hien thi trong workspace
```

## 3. Cach chay va dependency

Root `package.json`:

```json
{
  "name": "ai-turbo-pro",
  "version": "1.0.0",
  "private": true,
  "scripts": { "start": "node start.js" }
}
```

Backend `backend/package.json` dung Express, CORS, dotenv va OpenAI SDK:

```json
{
  "name": "ai-openai-webapp",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": { "start": "node server.js", "dev": "node server.js" },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.2",
    "openai": "^4.57.0"
  }
}
```

Mau `backend/.env.example`:

```env
AI_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-20b
GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_VISION_MODEL=gpt-4o
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.1-pro-preview
PORT=3000
```

Lenh chay:

```text
cd backend
npm install
npm start
```

Hoac tu root: `npm start`. Server lang nghe `http://localhost:3000`, serve static tu `frontend/`.

## 4. Backend: backend/server.js

### Trach nhiem

1. Khoi tao Express, CORS, JSON body toi da 50 MB va static frontend.
2. Doc `.env` cua backend va root.
3. Tao OpenAI-compatible clients cho Ollama, OpenAI, Groq, DeepSeek; co Gemini dung `fetch`.
4. Quan ly `workspace/` va `chat-history.json`.
5. Cung cap chat thuong/streaming, doc/ghi file, tao/xoa thu muc, upload, execute va test.

### Cau hinh va duong dan cot loi

```js
const app = express();
const PORT = process.env.PORT || 3000;
const AI_PROVIDER = (process.env.AI_PROVIDER || 'ollama').toLowerCase();
const frontendDir = path.join(__dirname, '../frontend');
const WORKSPACE_DIR = path.resolve(__dirname, '../workspace');
const CHAT_HISTORY_FILE = path.join(__dirname, 'chat-history.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(frontendDir));
```

### Ham nen quan trong

- `safeResolve(relPath)`: chuan hoa duong dan tuong doi vao workspace.
- `runCommand(file, args, cwd, timeout)`: chay Node/Python bang `execFile`, gioi han timeout/buffer va tra `{ ok, code, signal, stdout, stderr }`.
- `getRunnableFile(filePath)`: chi cho phep file ton tai co `.js`, `.mjs`, `.cjs`, `.py`.
- `getDirectoryTree()`: tao cay thu muc, bo qua `.git*`, `node_modules`.
- `getWorkspaceSummary()`: tra danh sach file tuong doi.
- `getWorkspaceFileContext()`: lay toi da khoang 3.000 ky tu context tu file text nho de nhung vao system prompt.
- `readChatHistory()`/`writeChatHistory()`: doc va ghi JSON lich su chat.
- `normalizeHistory(history)`: chi giu object co `role` va `content` dang chuoi.
- `buildSystemPrompt(boostLevel)`: ghep system prompt, che do boost va context workspace.

### AI provider

- `callOpenAICompatible(...)`: gui chat completion khong stream.
- `streamOpenAICompatible(...)`: gui completion stream va ghi tung delta vao HTTP response.
- `callGemini(...)` va `streamGemini(...)`: goi Gemini REST API, gom ca inline image neu co.
- Route `/api/chat` va `/api/chat/stream` hien dat cung `const provider = 'ollama'`, vi vay lua chon provider tren UI chua thuc su doi provider backend.
- Ollama dung `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_KEEP_ALIVE`, `OLLAMA_NUM_CTX`, `OLLAMA_NUM_THREADS`.

### REST API

```text
GET    /api/health
GET    /api/chat-history
PUT    /api/chat-history
DELETE /api/chat-history
POST   /api/chat
POST   /api/chat/stream
POST   /api/execute
POST   /api/workspace/test
GET    /api/workspace/tree
GET    /api/workspace/file?path=...
POST   /api/workspace/file
POST   /api/workspace/folder
DELETE /api/workspace/item?path=...
POST   /api/workspace/upload
POST   /api/load-test
GET    /*                         # fallback frontend/index.html
```

Chi tiet hanh vi:

- `/api/health`: tra trang thai server, provider cau hinh va model Ollama.
- `/api/chat`: nhan `message`, `history`, `boostLevel`, `mode`; tra `{ reply, provider, boostLevel }`.
- `/api/chat/stream`: cung input, tra plain text chunked; khi loi sau khi gui header thi noi chuoi `[Loi: ...]`.
- `/api/execute`: ghi code tam vao `workspace/.ai-runs`, chay Node hoac Python roi xoa file tam.
- `/api/workspace/test`: neu co `workspace/package.json` thi chay `npm test`; neu khong thi chay file JS/Python duoc yeu cau.
- `/api/workspace/tree`, `/file`, `/folder`, `/item`, `/upload`: CRUD workspace.
- `/api/load-test`: goi `backend/load_tester.py` bang Python va parse JSON output.

### Mau route workspace

```js
app.get('/api/workspace/file', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: 'Missing path parameter' });
  const absPath = safeResolve(filePath);
  if (!fs.existsSync(absPath)) return res.status(404).json({ error: 'File not found' });
  const content = fs.readFileSync(absPath, 'utf8');
  res.json({ success: true, path: filePath, content });
});

app.post('/api/workspace/file', (req, res) => {
  const { path: filePath, content = '' } = req.body;
  if (!filePath) return res.status(400).json({ error: 'Missing path' });
  const absPath = safeResolve(filePath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content, 'utf8');
  res.json({ success: true, path: filePath, message: 'File saved successfully' });
});
```

## 5. Frontend: frontend/index.html

Markup gom cac khu vuc chinh:

- Hai canvas `bgCanvas` va `trailCanvas` cho particle/mouse trail.
- Sidebar: logo, nut chat moi, lich su chat, trang thai core va xoa lich su.
- Header: menu upload project, chon mode `code/assistant`, chon provider, turbo boost, fullscreen/theme FX.
- Vung `#chatMessages` hien thi tin nhan.
- Composer: attach, chay project, textarea, voice input va nut gui.
- Modal overclock, menu upload, toast va cac vung trang thai dat o cuoi file.
- Font: Plus Jakarta Sans va JetBrains Mono tu Google Fonts.

Cac ID DOM quan trong ma `app.js` truy cap: `chatMessages`, `chatForm`, `messageInput`, `historyList`, `sidebar`, `fileUploadHidden`, `modeMenu`, `providerMenu`, `turboOverclockModal`, `overclockSlider`, `runProjectBtn`, `voiceBtn`.

## 6. Frontend: frontend/app.js

### State va storage

```js
const STORAGE_KEY_SESSIONS = 'AI_TURBO_CHAT_SESSIONS_V1';
const STORAGE_KEY_ACTIVE_ID = 'AI_TURBO_ACTIVE_SESSION_ID_V1';
const STORAGE_KEY_PROJECT_INFO = 'AI_TURBO_CURRENT_PROJECT_INFO';
const STORAGE_KEY_BOOST_LEVEL = 'AI_TURBO_BOOST_LEVEL_V1';

let currentSessionId = null;
let currentBoostLevel = parseInt(localStorage.getItem(STORAGE_KEY_BOOST_LEVEL) || '1', 10);
let currentMode = localStorage.getItem('AI_TURBO_MODE') || 'code';
let currentProvider = localStorage.getItem('AI_TURBO_PROVIDER') || 'deepseek';
```

### Cac khoi chuc nang

- `applyMode()`/`applyProvider()`: cap nhat label, class active, ARIA va localStorage.
- `getAllSessions()`, `saveAllSessions()`, `loadSessionsFromServer()`: dong bo lich su giua localStorage va `/api/chat-history`.
- `renderHistoryList()`, `loadSession()`, `startNewChat()`, `deleteSession()`, `clearAllSessions()`: vong doi session.
- `renderWelcomeCard()`, `addMessageToDOM()`, `formatAssistantMessage()`: render chat va markdown/code block.
- `escapeHtml()`: escape noi dung truoc khi dua vao HTML.
- `sendMessage()`: gui message toi `/api/chat/stream`, doc stream, cap nhat cau tra loi, luu session.
- `scanAndApplyAiFileWrites()`: tim marker `<<<FILE_WRITE:path>>>...<<<END_FILE_WRITE>>>` trong cau tra loi AI va ghi file qua API.
- `handleBatchUpload()`, `collectFolderFiles()`, `chooseProjectFolder()`: doc file/folder bang File API roi POST `/api/workspace/upload`.
- `refreshCoreStatus()`: goi `/api/health` va doi trang thai online/offline.
- Canvas engine: `BackgroundParticle`, `StardustTrailParticle`, `ClickRipple`, `animateCanvases()`.
- Voice: dung `SpeechRecognition` hoac `webkitSpeechRecognition` neu trinh duyet ho tro.
- Boost: `BOOST_LEVELS`, `applyBoostLevel()`, `openOverclockModal()`, `closeOverclockModal()`.

Luồng gui chat rut gon:

```js
const response = await fetch('/api/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message,
    history: activeSession?.messages || [],
    boostLevel: currentBoostLevel,
    mode: currentMode,
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let reply = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  reply += decoder.decode(value, { stream: true });
  // cap nhat message assistant dang hien thi
}
```

## 7. Frontend: frontend/styles.css

Stylesheet duoc to chuc theo cac nhom:

- Design tokens trong `:root`: font, mau neon cyan/blue/purple/pink/emerald, border, radius va shadow.
- Canvas/background: `#bgCanvas`, `#trailCanvas`, `.cyber-grid-overlay`, `.ambient-glow`, `@keyframes floatGlow`.
- Layout: `.app-shell`, `.sidebar`, `.chat-panel`, `.chat-header`, `.conversation-container`.
- Sidebar/history: `.history-list`, `.history-item`, `.core-status-card`, `.danger-subtle-btn`.
- Chat: `.message`, `.message-body`, `.code-block-wrapper`, `.copy-code-btn`, `.run-code-btn`, `.typing-dots`.
- Composer: `.composer-container`, `.composer-dock`, `.dock-tool-btn`, `.send-action-btn`.
- Project upload/card: `.upload-menu-dropdown`, `.upload-menu-item`, `.project-pill-badge`, `.project-announcement-card`.
- Turbo: `.brand-hologram-btn`, `.boost-level-tag`, modal va progress bars.
- Responsive breakpoints: desktop lon tu 1440px, tablet 769-1024px, mobile toi da 768px/380px va landscape thap.

## 8. Cac file ma nguon nho

### start.js o root

Khoi dong `backend/server.js` bang `child_process.spawn`, polling `GET /api/health` toi da 30 lan, sau do mo `http://localhost:3000` bang PowerShell tren Windows, `open` tren macOS hoac `xdg-open` tren Linux.

### frontend/start.js

Kiem tra server song bang HTTP GET. Neu chua song thi spawn backend detached, cho toi da 30 giay, mo Chrome neu tim thay cac duong dan Chrome pho bien hoac fallback `cmd /c start`.

### backend/scanner.js

Export `checkPort(host, port, timeout)` va `scanPorts(host, startPort, endPort, concurrency, timeout)`. Dung `net.Socket`, worker concurrency gioi han 50 mac dinh, ho tro CLI `node scanner.js [host] [startPort] [endPort]`.

### backend/scanner.py

Phien ban Python tuong duong dung `socket.connect_ex` va `ThreadPoolExecutor`. CLI mac dinh quet `127.0.0.1`, cong 1-1024, 50 threads, timeout 0.8 giay.

### backend/load_tester.py

Dung `requests.Session` va `ThreadPoolExecutor`. `RequestResult` luu status, latency, success/error. `HttpLoadTester.get_summary()` tinh success/failure, status counts, errors, RPS, min/avg/median/p95/max latency. CLI nhan `--url`, `--requests`, `--concurrency`, `--timeout`, `--json`.

### workspace/load_test.py

Dung `asyncio`, `aiohttp` va `TCPConnector`. Co `LoadTestConfig`, `TestResult`, payload dong, header nhieu lan, timeout, duration, thong ke RPS va latency. Khac `backend/load_tester.py` o cho day la ban async POST tong quat.

### workspace/main.js

```js
document.getElementById('demoBtn')?.addEventListener('click', () => {
  alert('Chào mừng bạn đến với Project Workspace!');
});
```

### workspace/index.html

Trang demo tieng Viet gom card, tieu de project, doan mo ta, nut `#demoBtn`, lien ket `style.css` va `main.js`.

### workspace/style.css

Dat card demo giua man hinh, nen `#090e17`, mau chu sang, card trong suot, vien cyan, shadow va nut gradient cyan/blue co hover nang nhe.

### workspace/calculator.html va calculator.css

HTML tao may tinh voi display `#display`, cac nut so, dau cham, toan tu `+ - * / %`, clear, backspace, equals. File HTML tham chieu `calculator.js`, nhung file nay hien khong xuat hien trong cay workspace. CSS tao grid 4 cot, palette xanh navy/do/tim va hieu ung hover.

### workspace/cac/c.js

CLI Node.js lon dung `http/https`, `readline`, `crypto`, `child_process`. Chuc nang gom tim URL anh Google/Bing, tim video Bing, tai anh/video, hash SHA-256 de loai anh trung, dung `yt-dlp`, liet ke/xoa file co xac nhan. Cac thu muc runtime: `downloads/`, `Video/`, `data/taixiu/` va `state.json`.

### workspace/AI_Turbo_Pro/package.json

```json
{
  "name": "ai-turbo-pro",
  "version": "1.0.0",
  "private": true,
  "scripts": { "start": "node start.js" }
}
```

## 9. Du lieu/runtime can luu y

- `backend/.env`: cau hinh provider/API key, khong commit hoac chia se nguyen van.
- `backend/chat-history.json`: du lieu hoi thoai, co the chua ma nguon va thong tin nguoi dung.
- `workspace/.ai-runs/`: file code tam tu `/api/execute`.
- `node_modules/`: artifact cai dat, tai tao bang `npm install`.
- `calculator.html` tham chieu `calculator.js` nhung hien chua thay file do; nut may tinh vi vay co the chua hoat dong.
- API upload/ghi/xoa workspace nhan duong dan tu client; khi mo ung dung ngoai localhost can danh gia lai kiem soat path va quyen thuc thi code.

## 10. File goc de tro ly khac doc tiep

De co toan bo tung dong ma nguon, tro ly khac nen doc truc tiep cac file sau theo thu tu:

1. `backend/server.js`
2. `frontend/index.html`
3. `frontend/app.js`
4. `frontend/styles.css`
5. `start.js` va `frontend/start.js`
6. Cac script trong `backend/` va `workspace/`

Tai lieu nay la ban do kien truc va ban trich xuat context an toan; source of truth van la cac file ma nguon trong workspace.
