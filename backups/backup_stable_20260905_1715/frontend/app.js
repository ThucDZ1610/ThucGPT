/* ==========================================================================
   AI TURBO PRO - CYBERPUNK INTERACTIVE CANVAS & CHAT CONTROLLER
   ========================================================================== */

// Storage Keys
const STORAGE_KEY_SESSIONS = 'AI_TURBO_CHAT_SESSIONS_V1';
const STORAGE_KEY_ACTIVE_ID = 'AI_TURBO_ACTIVE_SESSION_ID_V1';
const STORAGE_KEY_PROJECT_INFO = 'AI_TURBO_CURRENT_PROJECT_INFO';

// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const conversationContainer = document.getElementById('conversationContainer');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const historyList = document.getElementById('historyList');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const themeFxBtn = document.getElementById('themeFxBtn');
const toastNotification = document.getElementById('toastNotification');
const coreStatusLabel = document.getElementById('coreStatusLabel');
const voiceBtn = document.getElementById('voiceBtn');

// Upload Dropdown & Project Header Elements
const projectMenuBtn = document.getElementById('projectMenuBtn');
const uploadMenuDropdown = document.getElementById('uploadMenuDropdown');
const uploadFolderOptionBtn = document.getElementById('uploadFolderOptionBtn');
const uploadFileOptionBtn = document.getElementById('uploadFileOptionBtn');
const uploadImageOptionBtn = document.getElementById('uploadImageOptionBtn');
const createLocalFsOptionBtn = document.getElementById('createLocalFsOptionBtn');
const openProjectFilesBtn = document.getElementById('openProjectFilesBtn');
const fileUploadHidden = document.getElementById('fileUploadHidden');
const folderUploadHidden = document.getElementById('folderUploadHidden');
const activeProjectBadge = document.getElementById('activeProjectBadge');
const activeProjectName = document.getElementById('activeProjectName');
const activeProjectCount = document.getElementById('activeProjectCount');
const attachBtn = document.getElementById('attachBtn');
const imageUploadBtn = document.getElementById('imageUploadBtn');
const imageUploadHidden = document.getElementById('imageUploadHidden');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreviewThumbnail = document.getElementById('imagePreviewThumbnail');
const imagePreviewName = document.getElementById('imagePreviewName');
const imagePreviewSize = document.getElementById('imagePreviewSize');
const removeImageBtn = document.getElementById('removeImageBtn');

const modeSelectorBtn = document.getElementById('modeSelectorBtn');
const modeSelectorLabel = document.getElementById('modeSelectorLabel');
const modeMenu = document.getElementById('modeMenu');
const modeOptions = document.querySelectorAll('.mode-option[data-mode]');
const providerSelectorBtn = document.getElementById('providerSelectorBtn');
const providerSelectorLabel = document.getElementById('providerSelectorLabel');
const providerMenu = document.getElementById('providerMenu');
const providerOptions = document.querySelectorAll('.provider-option');

// Turbo Overclock Elements
const STORAGE_KEY_BOOST_LEVEL = 'AI_TURBO_BOOST_LEVEL_V1';
const turboBoostBtn = document.getElementById('turboBoostBtn');
const quickOverclockBtn = document.getElementById('quickOverclockBtn');
const turboOverclockModal = document.getElementById('turboOverclockModal');
const closeOverclockModalBtn = document.getElementById('closeOverclockModalBtn');
const overclockSlider = document.getElementById('overclockSlider');
const sliderCurrentVal = document.getElementById('sliderCurrentVal');
const statusBadgeLevel = document.getElementById('statusBadgeLevel');
const statusDescText = document.getElementById('statusDescText');
const metricSpeed = document.getElementById('metricSpeed');
const metricLogic = document.getElementById('metricLogic');
const metricPrecision = document.getElementById('metricPrecision');
const metricDefense = document.getElementById('metricDefense');
const barSpeed = document.getElementById('barSpeed');
const barLogic = document.getElementById('barLogic');
const barPrecision = document.getElementById('barPrecision');
const barDefense = document.getElementById('barDefense');
const applyOverclockBtn = document.getElementById('applyOverclockBtn');
const boostTagMini = document.getElementById('boostTagMini');
const aiModeBadge = document.getElementById('aiModeBadge');

let currentSessionId = null;
let isFxEnabled = true;
let currentBoostLevel = parseInt(localStorage.getItem(STORAGE_KEY_BOOST_LEVEL) || '1', 10);
let currentMode = localStorage.getItem('AI_TURBO_MODE') || 'code';
let currentProvider = localStorage.getItem('AI_TURBO_PROVIDER') || 'thucgpt';

const STORAGE_KEY_CREATOR_KEY = 'AI_TURBO_CREATOR_KEY';
const CREATOR_PASSCODE = '1610200803062008';
let storedCreatorKey = localStorage.getItem(STORAGE_KEY_CREATOR_KEY) || '';
let isCreatorMode = storedCreatorKey === CREATOR_PASSCODE || storedCreatorKey.startsWith('BYPASS-');

// Tự động đính kèm X-Creator-Passcode cho tất cả API khi Chủ nhân Thức đã xác thực
const originalFetch = window.fetch;
window.fetch = function (resource, options = {}) {
  const url = typeof resource === 'string' ? resource : resource?.url || '';
  if (url.startsWith('/api/')) {
    const creatorCode = localStorage.getItem(STORAGE_KEY_CREATOR_KEY) || (isCreatorMode ? CREATOR_PASSCODE : '');
    if (creatorCode) {
      options.headers = {
        ...(options.headers || {}),
        'X-Creator-Passcode': creatorCode,
      };
    }
  }
  return originalFetch.call(this, resource, options);
};

const MODE_LABELS = {
  code: 'Lập trình',
  assistant: 'Trợ lý đa năng',
};

const PROVIDER_LABELS = {
  thucgpt: 'THỨC GPT 👑',
  thucthinking: 'ThucThinking Pro 🧠',
  deepseek: 'AI ĐẲNG CẤP',
  ollama: 'AI VIP PRO',
  groq: 'GROQ AI',
  openai: 'OPENAI AI',
  gemini: 'GEMINI AI',
};

function applyMode(mode) {
  currentMode = MODE_LABELS[mode] ? mode : 'code';
  localStorage.setItem('AI_TURBO_MODE', currentMode);
  if (modeSelectorLabel) modeSelectorLabel.textContent = MODE_LABELS[currentMode];
  modeOptions.forEach((option) => {
    const active = option.dataset.mode === currentMode;
    option.classList.toggle('active', active);
    option.setAttribute('aria-selected', String(active));
  });
}

function applyProvider(provider) {
  currentProvider = PROVIDER_LABELS[provider] ? provider : 'thucgpt';
  localStorage.setItem('AI_TURBO_PROVIDER', currentProvider);
  if (providerSelectorLabel) {
    providerSelectorLabel.textContent = PROVIDER_LABELS[currentProvider];
    providerSelectorBtn.classList.remove('provider-btn-thucgpt', 'provider-btn-thucthinking');
    if (currentProvider === 'thucgpt') {
      providerSelectorBtn.classList.add('provider-btn-thucgpt');
    } else if (currentProvider === 'thucthinking') {
      providerSelectorBtn.classList.add('provider-btn-thucthinking');
    }
  }
  providerOptions.forEach((option) => {
    const active = option.dataset.provider === currentProvider;
    option.classList.toggle('active', active);
    option.setAttribute('aria-selected', String(active));
  });
  if (coreStatusLabel) {
    if (isCreatorMode) {
      coreStatusLabel.innerHTML = `<span style="color:#ffd700; font-weight:bold;">👑 CHỦ NHÂN THỨC • ${currentProvider === 'thucthinking' ? 'THỨC THINKING 🧠' : 'THỨC GPT 👑'}</span>`;
    } else if (currentProvider === 'thucgpt') {
      coreStatusLabel.innerHTML = `<span style="color:#ffd700; font-weight:bold;">THỨC GPT 👑 HOẠT ĐỘNG</span>`;
    } else if (currentProvider === 'thucthinking') {
      coreStatusLabel.innerHTML = `<span style="color:#a855f7; font-weight:bold;">THỨC THINKING 🧠 SUY LUẬN SÂU</span>`;
    } else {
      coreStatusLabel.textContent = `${PROVIDER_LABELS[currentProvider]} ONLINE`;
    }
  }
}

let currentAttachedImage = null;

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function setAttachedImage(imageObj) {
  currentAttachedImage = imageObj;
  if (imagePreviewThumbnail) imagePreviewThumbnail.src = imageObj.dataUrl;
  if (imagePreviewName) imagePreviewName.textContent = imageObj.name || 'image.png';
  if (imagePreviewSize) imagePreviewSize.textContent = formatBytes(imageObj.size || 0);
  if (imagePreviewContainer) imagePreviewContainer.style.display = 'flex';
  if (imageUploadBtn) imageUploadBtn.classList.add('has-image');
}

function clearAttachedImage() {
  currentAttachedImage = null;
  if (imagePreviewThumbnail) imagePreviewThumbnail.src = '';
  if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
  if (imageUploadBtn) imageUploadBtn.classList.remove('has-image');
  if (imageUploadHidden) imageUploadHidden.value = '';
}

function handleImageFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WebP, GIF...)');
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    showToast('Dung lượng ảnh vượt quá 20MB.');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const base64Data = dataUrl.split(',')[1];
    setAttachedImage({
      name: file.name || 'screenshot.png',
      size: file.size,
      mimeType: file.type || 'image/png',
      data: base64Data,
      dataUrl: dataUrl,
    });
    showToast(`Đã nhận ảnh: ${file.name || 'screenshot.png'}`);
  };
  reader.readAsDataURL(file);
}

window.openImageLightbox = function(url) {
  if (!url) return;
  const existing = document.getElementById('imageLightboxModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'imageLightboxModal';
  modal.style.cssText = 'position: fixed; inset: 0; z-index: 99999; background: rgba(2, 6, 23, 0.88); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; padding: 20px; cursor: zoom-out; animation: slideDownPreview 0.2s ease;';
  modal.innerHTML = `
    <div style="position: relative; max-width: 92vw; max-height: 92vh; display: flex; align-items: center; justify-content: center;">
      <img src="${url}" alt="Phóng to ảnh" style="max-width: 100%; max-height: 90vh; border-radius: 12px; border: 1px solid rgba(0,240,255,0.4); box-shadow: 0 10px 40px rgba(0,0,0,0.8);" />
      <button style="position: absolute; top: -14px; right: -14px; width: 32px; height: 32px; border-radius: 50%; background: #ef4444; color: white; border: none; font-size: 18px; cursor: pointer; font-weight: bold; line-height: 1;">&times;</button>
    </div>
  `;
  modal.onclick = () => modal.remove();
  document.body.appendChild(modal);
};

/* ==========================================================================
   1. SESSION & STORAGE MANAGEMENT
   ========================================================================== */
function getAllSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSIONS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error loading sessions:', e);
    return [];
  }
}

function saveAllSessions(sessions) {
  try {
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
    fetch('/api/chat-history', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions }),
    }).catch((error) => console.warn('Server history sync failed:', error));
  } catch (e) {
    console.error('Error saving sessions:', e);
  }
}

async function loadSessionsFromServer() {
  try {
    const response = await fetch('/api/chat-history', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    const serverSessions = Array.isArray(data.sessions) ? data.sessions : [];
    const localSessions = getAllSessions();

    if (serverSessions.length > 0 || localSessions.length === 0) {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(serverSessions));
    } else {
      saveAllSessions(localSessions);
    }
  } catch (error) {
    console.warn('Server history load failed:', error);
  }
}

function getActiveSession() {
  const sessions = getAllSessions();
  return sessions.find((s) => s.id === currentSessionId) || null;
}

function renderHistoryList() {
  if (!historyList) return;
  const sessions = getAllSessions();
  historyList.innerHTML = '';

  if (sessions.length === 0) {
    historyList.innerHTML = `
      <div class="history-empty-state">
        <span class="history-empty-icon">💬</span>
        <span>Chưa có lịch sử trò chuyện</span>
      </div>
    `;
    return;
  }

  sessions.forEach((session) => {
    const itemBtn = document.createElement('button');
    itemBtn.className = `history-item ${session.id === currentSessionId ? 'active' : ''}`;
    itemBtn.title = session.title || 'Cuộc trò chuyện';

    itemBtn.innerHTML = `
      <svg class="item-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <span class="history-title">${escapeHtml(session.title || 'Cuộc trò chuyện')}</span>
      ${session.id === currentSessionId ? '<span class="active-dot"></span>' : ''}
      <span class="history-delete-btn" title="Xóa cuộc trò chuyện này" aria-label="Delete chat">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </span>
    `;

    // Switch Session Click
    itemBtn.addEventListener('click', (e) => {
      if (e.target.closest('.history-delete-btn')) {
        e.stopPropagation();
        deleteSession(session.id);
        return;
      }
      loadSession(session.id);
    });

    historyList.appendChild(itemBtn);
  });
}

function renderWelcomeCard(isFresh = false) {
  chatMessages.innerHTML = '';
  const welcomeCard = document.createElement('div');
  welcomeCard.className = 'message assistant welcome-card';
  welcomeCard.innerHTML = `
    <div class="message-avatar">
      <div class="avatar-ring">
        <img src="/assets/logo.png" alt="AI Avatar" class="message-avatar-img" />
      </div>
    </div>
    <div class="message-content">
      <div class="message-author">
        <span class="author-name">AI Assistant</span>
        <span class="message-time">Vừa xong</span>
      </div>
      <div class="message-body">
        <p class="greeting-highlight">
          👋 ${isFresh ? 'Phiên làm việc mới đã bắt đầu!' : 'Xin chào! Tôi là <strong>AI Turbo Pro</strong> — trợ lý trí tuệ nhân tạo lập trình thông minh.'}
        </p>
        <p>Nhấn nút <strong>☰</strong> ở góc trên bên trái để <strong>Tải Thư Mục</strong> hoặc <strong>Tệp mã nguồn</strong> vào dự án. Khi tải lên, dự án sẽ xuất hiện trực tiếp trong khung chat và tôi có thể đọc, giải thích hoặc chỉnh sửa code theo yêu cầu của bạn!</p>
        <div class="quick-prompts-grid">
          <button class="prompt-chip" data-prompt="Đọc toàn bộ file trong project và tóm tắt kiến trúc dự án">
            <span class="chip-icon">📂</span>
            <span class="chip-text">Tóm tắt cấu trúc Project</span>
          </button>
          <button class="prompt-chip" data-prompt="Kiểm tra các lỗi logic và bảo mật trong mã nguồn dự án">
            <span class="chip-icon">🔍</span>
            <span class="chip-text">Tìm lỗi & Tối ưu code</span>
          </button>
          <button class="prompt-chip" data-prompt="Thêm giao diện Cyberpunk vào file index.html và style.css">
            <span class="chip-icon">⚡</span>
            <span class="chip-text">Nâng cấp UI tự động</span>
          </button>
          <button class="prompt-chip" data-prompt="Viết code hiệu ứng ma trận Cyber Matrix bằng JavaScript Canvas siêu đẹp">
            <span class="chip-icon">✨</span>
            <span class="chip-text">Viết hiệu ứng Matrix Canvas</span>
          </button>
        </div>
      </div>
    </div>
  `;
  chatMessages.appendChild(welcomeCard);
}

function loadSession(sessionId) {
  const sessions = getAllSessions();
  const session = sessions.find((s) => s.id === sessionId);

  if (!session) {
    startNewChat();
    return;
  }

  currentSessionId = sessionId;
  localStorage.setItem(STORAGE_KEY_ACTIVE_ID, sessionId);
  renderHistoryList();
  closeMobileSidebar();

  chatMessages.innerHTML = '';
  if (!session.messages || session.messages.length === 0) {
    renderWelcomeCard();
    return;
  }

  session.messages.forEach((msg) => {
    addMessageToDOM(msg.role, msg.content, msg.time || getTimeString(), msg.attachment || null);
  });

  scrollToBottom();
}

function startNewChat() {
  currentSessionId = null;
  localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
  renderHistoryList();
  renderWelcomeCard(true);
  closeMobileSidebar();
  messageInput.value = '';
  autoResizeTextarea();
  messageInput.focus();
  showToast('Đã bắt đầu cuộc trò chuyện mới!');
}

function deleteSession(sessionId) {
  let sessions = getAllSessions();
  const session = sessions.find((s) => s.id === sessionId);
  const sessionTitle = session?.title || 'Cuộc trò chuyện này';

  showModalConfirm({
    title: 'Xóa cuộc trò chuyện',
    icon: '🗑️',
    contentHtml: `
      <p style="color: #334155; font-size: 0.95rem; margin: 0 0 10px; line-height: 1.5;">
        Bạn có chắc muốn xóa cuộc trò chuyện <strong>"${escapeHtml(sessionTitle)}"</strong> không?
      </p>
    `,
    cancelText: 'Hủy bỏ',
    confirmText: 'Xóa ngay',
    confirmIcon: '🗑️',
    confirmClass: 'modal-btn-danger',
    onConfirm: () => {
      sessions = sessions.filter((s) => s.id !== sessionId);
      saveAllSessions(sessions);

      if (currentSessionId === sessionId) {
        if (sessions.length > 0) {
          loadSession(sessions[0].id);
        } else {
          startNewChat();
        }
      } else {
        renderHistoryList();
      }

      showToast('Đã xóa cuộc trò chuyện!');
    },
  });
}

function clearAllSessions() {
  const sessions = getAllSessions();
  if (sessions.length === 0 && !currentSessionId) {
    showModalAlert({
      title: 'Chưa có lịch sử',
      icon: '💬',
      message: 'Chưa có lịch sử cuộc trò chuyện nào để xóa.',
    });
    return;
  }

  showModalConfirm({
    title: 'Xóa toàn bộ lịch sử trò chuyện',
    icon: '🗑️',
    contentHtml: `
      <p style="color: #334155; font-size: 0.95rem; line-height: 1.6; margin: 0 0 12px;">
        Bạn có chắc chắn muốn xóa toàn bộ lịch sử các phiên trò chuyện không?
      </p>
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 12px 14px; color: #dc2626; font-size: 0.88rem; font-weight: 700;">
        ⚠️ Lưu ý: Toàn bộ lịch sử trò chuyện sẽ bị xóa vĩnh viễn và không thể khôi phục!
      </div>
    `,
    cancelText: 'Hủy bỏ',
    confirmText: 'Xác nhận xóa',
    confirmIcon: '🗑️',
    confirmClass: 'modal-btn-danger',
    onConfirm: () => {
      localStorage.removeItem(STORAGE_KEY_SESSIONS);
      localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
      fetch('/api/chat-history', { method: 'DELETE' }).catch((error) => console.warn('Server history delete failed:', error));
      currentSessionId = null;
      renderHistoryList();
      renderWelcomeCard(true);
      showToast('Đã dọn sạch toàn bộ lịch sử trò chuyện!');
    },
  });
}

/* ==========================================================================
   2. INTERACTIVE FULLSCREEN DUAL-CANVAS & GLOWING MOUSE TRAIL ENGINE
   ========================================================================== */
const bgCanvas = document.getElementById('bgCanvas');
const bgCtx = bgCanvas.getContext('2d');

const trailCanvas = document.getElementById('trailCanvas');
const trailCtx = trailCanvas.getContext('2d');

let width = (bgCanvas.width = trailCanvas.width = window.innerWidth);
let height = (bgCanvas.height = trailCanvas.height = window.innerHeight);

const mouse = {
  x: width / 2,
  y: height / 2,
  prevX: width / 2,
  prevY: height / 2,
  speed: 0,
  isActive: false,
  radius: 160,
};

const particles = [];
const mouseTrail = [];
const clickRipples = [];
const PARTICLE_COUNT = Math.min(Math.floor((width * height) / 16000), 80);

const NEON_PALETTE = [
  { r: 0, g: 240, b: 255 },    // Neon Cyan
  { r: 157, g: 78, b: 221 },   // Neon Purple
  { r: 59, g: 130, b: 246 },   // Electric Blue
  { r: 247, g: 37, b: 133 },   // Hot Pink
  { r: 16, g: 185, b: 129 },   // Emerald Cyber
];

class BackgroundParticle {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.vx = (Math.random() - 0.5) * 0.7;
    this.vy = (Math.random() - 0.5) * 0.7;
    this.radius = Math.random() * 2.2 + 1;
    this.baseAlpha = Math.random() * 0.5 + 0.2;
    this.color = NEON_PALETTE[Math.floor(Math.random() * NEON_PALETTE.length)];
    this.pulseSpeed = Math.random() * 0.03 + 0.01;
    this.pulse = Math.random() * Math.PI;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;

    if (this.x < 0 || this.x > width) this.vx *= -1;
    if (this.y < 0 || this.y > height) this.vy *= -1;

    if (mouse.isActive) {
      const dx = mouse.x - this.x;
      const dy = mouse.y - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist < mouse.radius) {
        const force = (mouse.radius - dist) / mouse.radius;
        const angle = Math.atan2(dy, dx);
        this.x -= Math.cos(angle) * force * 2.5;
        this.y -= Math.sin(angle) * force * 2.5;
      }
    }

    this.pulse += this.pulseSpeed;
  }

  draw(ctx) {
    const currentAlpha = this.baseAlpha + Math.sin(this.pulse) * 0.2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${Math.max(0.1, currentAlpha)})`;
    ctx.shadowBlur = 10;
    ctx.shadowColor = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0.8)`;
    ctx.fill();
    ctx.restore();
  }
}

class StardustTrailParticle {
  constructor(x, y, vx, vy, isClick = false) {
    this.x = x;
    this.y = y;
    this.size = isClick ? Math.random() * 6 + 3 : Math.random() * 4.5 + 1.8;
    this.alpha = 1;
    this.decay = isClick ? Math.random() * 0.025 + 0.015 : Math.random() * 0.035 + 0.02;
    this.vx = vx || (Math.random() - 0.5) * (isClick ? 5 : 2);
    this.vy = vy || (Math.random() - 0.5) * (isClick ? 5 : 2);
    this.color = NEON_PALETTE[Math.floor(Math.random() * NEON_PALETTE.length)];
    this.isClick = isClick;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.96;
    this.vy *= 0.96;
    this.size *= 0.95;
    this.alpha -= this.decay;
  }

  draw(ctx) {
    if (this.alpha <= 0 || this.size <= 0.3) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(0.5, this.size), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha})`;
    ctx.shadowBlur = 16;
    ctx.shadowColor = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0.95)`;
    ctx.fill();
    ctx.restore();
  }
}

class ClickRipple {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 2;
    this.maxRadius = Math.random() * 50 + 60;
    this.alpha = 0.9;
    this.speed = 3.5;
    this.color = NEON_PALETTE[Math.floor(Math.random() * NEON_PALETTE.length)];
  }

  update() {
    this.radius += this.speed;
    this.alpha = Math.max(0, 1 - this.radius / this.maxRadius);
  }

  draw(ctx) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.alpha * 0.8})`;
    ctx.lineWidth = 2.2;
    ctx.shadowBlur = 12;
    ctx.shadowColor = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0.9)`;
    ctx.stroke();
    ctx.restore();
  }
}

// Populate background particles
for (let i = 0; i < PARTICLE_COUNT; i++) {
  particles.push(new BackgroundParticle());
}

function resizeCanvases() {
  width = bgCanvas.width = trailCanvas.width = window.innerWidth;
  height = bgCanvas.height = trailCanvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvases);

// Global Mouse Movement Tracking (Across entire screen)
function handlePointerMove(clientX, clientY) {
  mouse.prevX = mouse.x;
  mouse.prevY = mouse.y;
  mouse.x = clientX;
  mouse.y = clientY;
  mouse.speed = Math.hypot(mouse.x - mouse.prevX, mouse.y - mouse.prevY);
  mouse.isActive = true;

  if (isFxEnabled && mouse.speed > 0.5) {
    const count = Math.min(Math.floor(mouse.speed / 3) + 1, 5);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 1.5;
      mouseTrail.push(
        new StardustTrailParticle(
          mouse.x + (Math.random() - 0.5) * 8,
          mouse.y + (Math.random() - 0.5) * 8,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed
        )
      );
    }
  }
}

window.addEventListener('mousemove', (e) => {
  handlePointerMove(e.clientX, e.clientY);
});

window.addEventListener('touchmove', (e) => {
  if (e.touches && e.touches[0]) {
    handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
  }
}, { passive: true });

// Mouse Click / Tap Ripple Burst everywhere on screen
window.addEventListener('pointerdown', (e) => {
  if (!isFxEnabled) return;
  const x = e.clientX;
  const y = e.clientY;

  // Add shockwave ripple
  clickRipples.push(new ClickRipple(x, y));

  // Spawn radial sparks burst
  const burstCount = 16;
  for (let i = 0; i < burstCount; i++) {
    const angle = (Math.PI * 2 / burstCount) * i + (Math.random() - 0.5) * 0.5;
    const speed = Math.random() * 4 + 2;
    mouseTrail.push(
      new StardustTrailParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, true)
    );
  }
});

window.addEventListener('mouseleave', () => {
  mouse.isActive = false;
});

// Dual-Canvas Animation Loop
function animateCanvases() {
  // 1. Render Background Constellation Canvas
  bgCtx.clearRect(0, 0, width, height);

  if (isFxEnabled) {
    // Inter-particle network lines
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.hypot(dx, dy);

        if (dist < 130) {
          const alpha = (1 - dist / 130) * 0.22;
          bgCtx.beginPath();
          bgCtx.moveTo(particles[i].x, particles[i].y);
          bgCtx.lineTo(particles[j].x, particles[j].y);
          bgCtx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
          bgCtx.lineWidth = 0.8;
          bgCtx.stroke();
        }
      }
    }

    // Connect mouse to background particles
    if (mouse.isActive) {
      for (let i = 0; i < particles.length; i++) {
        const dx = mouse.x - particles[i].x;
        const dy = mouse.y - particles[i].y;
        const dist = Math.hypot(dx, dy);

        if (dist < mouse.radius) {
          const alpha = (1 - dist / mouse.radius) * 0.45;
          bgCtx.beginPath();
          bgCtx.moveTo(particles[i].x, particles[i].y);
          bgCtx.lineTo(mouse.x, mouse.y);
          bgCtx.strokeStyle = `rgba(157, 78, 221, ${alpha})`;
          bgCtx.lineWidth = 1.2;
          bgCtx.stroke();
        }
      }
    }

    particles.forEach((p) => {
      p.update();
      p.draw(bgCtx);
    });
  }

  // 2. Render Fullscreen Interactive Mouse Trail & Burst Canvas (Top Layer)
  trailCtx.clearRect(0, 0, width, height);

  if (isFxEnabled) {
    // Draw Cursor Glow Reticle when moving
    if (mouse.isActive) {
      trailCtx.save();
      const grad = trailCtx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 35);
      grad.addColorStop(0, 'rgba(0, 240, 255, 0.25)');
      grad.addColorStop(0.5, 'rgba(157, 78, 221, 0.1)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      trailCtx.fillStyle = grad;
      trailCtx.beginPath();
      trailCtx.arc(mouse.x, mouse.y, 35, 0, Math.PI * 2);
      trailCtx.fill();
      trailCtx.restore();
    }

    // Draw Click Ripples
    for (let i = clickRipples.length - 1; i >= 0; i--) {
      const ripple = clickRipples[i];
      ripple.update();
      ripple.draw(trailCtx);
      if (ripple.alpha <= 0) {
        clickRipples.splice(i, 1);
      }
    }

    // Draw Mouse Trail Particles
    for (let i = mouseTrail.length - 1; i >= 0; i--) {
      const trail = mouseTrail[i];
      trail.update();
      trail.draw(trailCtx);
      if (trail.alpha <= 0 || trail.size <= 0.3) {
        mouseTrail.splice(i, 1);
      }
    }
  }

  requestAnimationFrame(animateCanvases);
}

animateCanvases();

/* ==========================================================================
   3. UI UTILITIES & TOAST NOTIFICATION
   ========================================================================== */
function showToast(message = 'Đã sao chép vào bộ nhớ tạm!') {
  const toastMsg = toastNotification.querySelector('.toast-message');
  if (toastMsg) toastMsg.textContent = message;
  toastNotification.classList.add('show');
  setTimeout(() => {
    toastNotification.classList.remove('show');
  }, 2400);
}

window.copyCodeToClipboard = function (btn, codeTextBase64) {
  try {
    const rawCode = decodeURIComponent(escape(atob(codeTextBase64)));
    navigator.clipboard.writeText(rawCode).then(() => {
      const originalText = btn.innerHTML;
      btn.innerHTML = '<span>✓</span> Đã chép!';
      btn.style.color = 'var(--neon-cyan)';
      showToast('Đã sao chép đoạn mã!');
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.color = '';
      }, 2000);
    });
  } catch (err) {
    console.error('Lỗi chép code:', err);
  }
};

/* ==========================================================================
   3.1 UNIVERSAL CENTERED POPUP MODAL (REPLACES BROWSER ALERTS / CONFIRMS)
   ========================================================================== */
const universalModal = document.getElementById('universalModal');
const universalModalIcon = document.getElementById('universalModalIcon');
const universalModalTitle = document.getElementById('universalModalTitle');
const universalModalBody = document.getElementById('universalModalBody');
const universalModalCloseBtn = document.getElementById('universalModalCloseBtn');
const universalModalCancelBtn = document.getElementById('universalModalCancelBtn');
const universalModalConfirmBtn = document.getElementById('universalModalConfirmBtn');
const universalModalConfirmIcon = document.getElementById('universalModalConfirmIcon');
const universalModalConfirmText = document.getElementById('universalModalConfirmText');

let activeModalResolve = null;

function hideModal() {
  if (universalModal) {
    universalModal.style.display = 'none';
  }
  if (activeModalResolve) {
    activeModalResolve(false);
    activeModalResolve = null;
  }
}

function showModalDialog({
  title = 'Thông báo',
  icon = '📁',
  message = '',
  contentHtml = '',
  cancelText = 'Hủy bỏ',
  confirmText = 'Xác nhận',
  confirmIcon = '✓',
  confirmClass = '',
  maxWidth = '',
  showCancel = true,
  onConfirm = null,
  onCancel = null,
} = {}) {
  return new Promise((resolve) => {
    activeModalResolve = resolve;

    const modalInnerCard = universalModal?.querySelector('.universal-modal-card');
    if (modalInnerCard) {
      modalInnerCard.style.maxWidth = maxWidth || '450px';
    }

    if (universalModalTitle) universalModalTitle.textContent = title;
    if (universalModalIcon) universalModalIcon.textContent = icon;
    
    if (universalModalBody) {
      if (contentHtml) {
        universalModalBody.innerHTML = contentHtml;
      } else {
        universalModalBody.innerHTML = `<p style="margin:0; line-height:1.6; color:#334155;">${escapeHtml(message)}</p>`;
      }
    }

    if (universalModalCancelBtn) {
      universalModalCancelBtn.style.display = showCancel ? 'inline-flex' : 'none';
      universalModalCancelBtn.textContent = cancelText;
      universalModalCancelBtn.onclick = () => {
        hideModal();
        if (typeof onCancel === 'function') onCancel();
        resolve(false);
      };
    }

    if (universalModalConfirmBtn) {
      universalModalConfirmBtn.className = `modal-btn modal-btn-confirm ${confirmClass || ''}`;
      if (universalModalConfirmIcon) universalModalConfirmIcon.textContent = confirmIcon;
      if (universalModalConfirmText) universalModalConfirmText.textContent = confirmText;
      universalModalConfirmBtn.onclick = () => {
        if (universalModal) universalModal.style.display = 'none';
        activeModalResolve = null;
        if (typeof onConfirm === 'function') onConfirm();
        resolve(true);
      };
    }

    if (universalModalCloseBtn) {
      universalModalCloseBtn.onclick = () => {
        hideModal();
        if (typeof onCancel === 'function') onCancel();
        resolve(false);
      };
    }

    if (universalModal) {
      universalModal.style.display = 'flex';
      universalModal.onclick = (e) => {
        if (e.target === universalModal) {
          hideModal();
          if (typeof onCancel === 'function') onCancel();
          resolve(false);
        }
      };
    }
  });
}

function showModalAlert(options) {
  if (typeof options === 'string') {
    options = { message: options, title: 'Thông báo', icon: '🔔' };
  }
  return showModalDialog({
    ...options,
    showCancel: false,
    confirmText: options.confirmText || 'Đã hiểu',
    confirmIcon: '✓',
  });
}

function showModalConfirm(options) {
  if (typeof options === 'string') {
    options = { message: options, title: 'Xác nhận', icon: '❓' };
  }
  return showModalDialog({
    ...options,
    showCancel: true,
  });
}

// Override native browser window.alert and window.confirm
window.alert = function (msg) {
  showModalAlert(String(msg));
};

window.confirm = function (msg) {
  return showModalConfirm(String(msg));
};

/* ==========================================================================
   4. MARKDOWN & SYNTAX FORMATTING (WITH FILE_WRITE DETECTOR)
   ========================================================================== */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatAssistantMessage(content, allowFileWrite = false) {
  if (!content) return '';
  const codeBlocks = [];

  const isRefusalOrWarning = /(tôi\s*(xin\s*)?từ\s*chối|từ\s*chối\s*yêu\s*cầu|chính\s*sách\s*an\s*toàn|cảnh\s*báo\s*an\s*toàn|không\s*thể\s*hỗ\s*trợ|vi\s*phạm\s*chính\s*sách|tường\s*lửa\s*bảo\s*mật)/i.test(content);

  // Parse <<<FOLDER_CREATE:path>>> into Folder Created Notice Card (chỉ khi được phép tạo file/thư mục)
  let formatted = content.replace(/<<<FOLDER_CREATE:(.+?)>>>/g, (_, folderName) => {
    if (isRefusalOrWarning || !allowFileWrite) return '';
    const cleanFolder = folderName.trim();
    return `<div class="file-saved-badge" style="background:rgba(59, 130, 246, 0.15); border-color:rgba(59, 130, 246, 0.4); color:#93c5fd;">📁 Đã tạo thư mục: <strong>${escapeHtml(cleanFolder)}</strong></div>`;
  });

  // Parse <<<FILE_DELETE:path>>> into Cyber File Delete Notice Card
  formatted = formatted.replace(/<<<FILE_DELETE:(.+?)>>>/g, (_, filename) => {
    if (isRefusalOrWarning) return '';
    const cleanFilename = filename.trim();
    return `<div class="file-saved-badge" style="background:rgba(239, 68, 68, 0.15); border-color:rgba(239, 68, 68, 0.5); color:#fca5a5; display:flex; align-items:center; gap:8px;">
      <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#ef4444; box-shadow:0 0 8px #ef4444;"></span>
      🗑️ Đã xóa file/thư mục: <strong>${escapeHtml(cleanFilename)}</strong>
    </div>`;
  });

  // Nếu người dùng KHÔNG yêu cầu tạo/sửa file: Hạ cấp <<<FILE_WRITE:...>>> thành code block Markdown thông thường
  if (!allowFileWrite) {
    formatted = formatted.replace(/<<<FILE_WRITE:(.+?)>>>\n?([\s\S]*?)<<<END_FILE_WRITE>>>/g, (_, filename, code) => {
      const ext = (filename.trim().split('.').pop() || '').toLowerCase();
      return `\n\`\`\`${ext}\n${code.trim()}\n\`\`\`\n`;
    });
  } else {
    // Parse <<<FILE_WRITE:path>>>...<<<END_FILE_WRITE>>> into Cyber File Change Card (khi người dùng chủ động yêu cầu ghi/sửa file)
    formatted = formatted.replace(/<<<FILE_WRITE:(.+?)>>>\n?([\s\S]*?)<<<END_FILE_WRITE>>>/g, (_, filename, code) => {
      if (isRefusalOrWarning) {
        return `\n<div class="file-saved-badge" style="background:rgba(239, 68, 68, 0.15); border-color:rgba(239, 68, 68, 0.4); color:#fca5a5;">🛡️ [Tường lửa an toàn]: Đã chặn tự động tạo công cụ <strong>${escapeHtml(filename.trim())}</strong> do phát hiện cảnh báo vi phạm an toàn.</div>\n`;
      }
      const cleanFilename = filename.trim();
      const trimmedCode = code.trim();
      const encoded = btoa(unescape(encodeURIComponent(trimmedCode)));
      const blockHtml = `
        <div class="code-block-wrapper" style="border-color: rgba(16, 185, 129, 0.4); box-shadow: 0 0 20px rgba(16, 185, 129, 0.15);">
          <div class="code-header" style="background: rgba(6, 44, 33, 0.7); border-bottom-color: rgba(16, 185, 129, 0.3);">
            <span class="code-lang" style="color: #34d399; display: flex; align-items: center; gap: 6px;">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981; box-shadow:0 0 8px #10b981;"></span>
              Đã cập nhật file: <strong>${escapeHtml(cleanFilename)}</strong>
            </span>
            <button type="button" class="copy-code-btn" onclick="copyCodeToClipboard(this, '${encoded}')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Sao chép</span>
            </button>
            <button type="button" class="run-code-btn" onclick="runCodeFromButton(this, '${encoded}', '${escapeHtml(cleanFilename)}')">▶ Chạy thử</button>
          </div>
          <pre><code class="language-code">${escapeHtml(trimmedCode)}</code></pre>
        </div>
      `;
      codeBlocks.push(blockHtml);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });
  }

  // Extract Standard Code Blocks (both completed ```...``` and streaming in-progress ```...)
  formatted = formatted.replace(/```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)(?:```|$)/g, (fullMatch, lang, code) => {
    // Avoid matching if it's just plain text without any code
    if (!fullMatch.startsWith('```')) return fullMatch;
    const cleanLang = lang.trim() || 'code';
    const trimmedCode = code.replace(/```$/, '').trim();
    const encoded = btoa(unescape(encodeURIComponent(trimmedCode)));
    const blockHtml = `
      <div class="code-block-wrapper">
        <div class="code-header">
          <span class="code-lang">${escapeHtml(cleanLang)}</span>
          <button type="button" class="copy-code-btn" onclick="copyCodeToClipboard(this, '${encoded}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Sao chép</span>
          </button>
          <button type="button" class="run-code-btn" onclick="runCodeFromButton(this, '${encoded}', '')">▶ Chạy thử</button>
        </div>
        <pre><code class="language-${escapeHtml(cleanLang)}">${escapeHtml(trimmedCode)}</code></pre>
      </div>
    `;
    codeBlocks.push(blockHtml);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // Paragraphs & Lists
  const blocks = formatted.split(/\n\s*\n/);
  const parsedBlocks = blocks.map((block) => {
    const lines = block.split('\n');

    if (lines.every((line) => /^\s*[-*•]\s+/.test(line))) {
      return `<ul>${lines.map((line) => `<li>${line.replace(/^\s*[-*•]\s+/, '')}</li>`).join('')}</ul>`;
    }

    if (lines.every((line) => /^\s*\d+\.\s+/.test(line))) {
      return `<ol>${lines.map((line) => `<li>${line.replace(/^\s*\d+\.\s+/, '')}</li>`).join('')}</ol>`;
    }

    if (/^###\s+/.test(block)) return `<h4>${block.replace(/^###\s+/, '')}</h4>`;
    if (/^##\s+/.test(block)) return `<h3>${block.replace(/^##\s+/, '')}</h3>`;
    if (/^#\s+/.test(block)) return `<h2>${block.replace(/^#\s+/, '')}</h2>`;

    return `<p>${block.replace(/\n/g, '<br>')}</p>`;
  });

  let result = parsedBlocks.join('');

  result = result
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^\*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');

  result = result.replace(/__CODE_BLOCK_(\d+)__/g, (_, idx) => codeBlocks[idx]);

  return result;
}

window.runCodeFromButton = async function (button, encodedCode, filename = '') {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = '⚡ Đang thực thi...';
  try {
    const code = decodeURIComponent(escape(atob(encodedCode)));
    const langElem = button.closest('.code-block-wrapper')?.querySelector('.code-lang');
    const language = langElem ? langElem.textContent.trim() : 'javascript';

    const wrapper = button.closest('.code-block-wrapper');
    const existingOutput = wrapper?.querySelector('.code-run-output');
    if (existingOutput) existingOutput.remove();
    const existingIframe = wrapper?.querySelector('.web-artifact-preview');
    if (existingIframe) existingIframe.remove();

    // Nếu là HTML / Web Code -> Hiển thị Artifacts Web Preview trực tiếp (như Claude Artifacts)
    const isWeb = /html|xml|svg/i.test(language) || code.trim().toLowerCase().startsWith('<!doctype') || code.trim().toLowerCase().startsWith('<html');

    const response = await fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language: isWeb ? 'html' : language, filename }),
    });
    const result = await response.json();

    if (result.isPreview && result.previewUrl) {
      showToast('🚀 Khởi chạy Artifact Web Preview thành công!');
      const previewContainer = document.createElement('div');
      previewContainer.className = 'web-artifact-preview';
      previewContainer.style.cssText = 'margin-top:10px; border-top:1px solid rgba(0,240,255,0.3); background:#090e17; padding:10px; border-radius:0 0 12px 12px;';
      previewContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:0.75rem; color:#00f0ff; font-weight:700;">
          <span>🌐 CLAUDE-STYLE ARTIFACT WEB PREVIEW:</span>
          <a href="${result.previewUrl}" target="_blank" style="color:#38bdf8; text-decoration:underline;">Mở tab mới ↗</a>
        </div>
        <iframe src="${result.previewUrl}?t=${Date.now()}" style="width:100%; height:380px; border:1px solid rgba(56,189,248,0.3); border-radius:8px; background:#ffffff;" title="Web Preview"></iframe>
      `;
      wrapper?.appendChild(previewContainer);
    } else {
      showToast(result.ok ? 'Chạy code thành công.' : 'Code trả về lỗi.');
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n') || (result.ok ? 'Chạy thành công, không có output.' : result.error || 'Chạy thất bại.');
      const outputBox = document.createElement('pre');
      outputBox.className = `code-run-output ${result.ok ? 'success' : 'failure'}`;
      outputBox.textContent = `$ ${result.runtime || 'Powershell/Terminal'}\n${output}`;
      wrapper?.appendChild(outputBox);
    }
  } catch (error) {
    showToast(`Không thể chạy code: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
};

/* ==========================================================================
   5. CHAT STREAMING & DOM RENDERING
   ========================================================================== */
function getTimeString() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function addMessageToDOM(role, content, time = getTimeString(), attachment = null) {
  const welcome = chatMessages.querySelector('.welcome-card');
  if (welcome) welcome.remove();

  const wrapper = document.createElement('div');
  wrapper.className = `message ${role}`;

  const isUser = role === 'user';
  const isCreatorUser = isUser && isCreatorMode;
  let avatarClass = 'avatar-ring';
  let authorName = PROVIDER_LABELS[currentProvider] || 'AI Turbo Pro';
  let avatarContent = `<img src="/assets/logo.png" alt="AI" class="message-avatar-img" />`;

  if (isUser) {
    avatarClass = isCreatorUser ? 'user-avatar-ring user-avatar-ring-creator' : 'user-avatar-ring';
    authorName = isCreatorUser ? 'Chủ nhân Thức 👑' : 'Bạn';
    avatarContent = isCreatorUser ? `<span class="avatar-text" style="font-size: 1.15rem;">👑</span>` : `<span class="avatar-text">YOU</span>`;
  } else if (currentProvider === 'thucgpt') {
    avatarClass = 'avatar-ring avatar-ring-thucgpt';
    authorName = 'THỨC GPT 👑';
    avatarContent = `<span class="avatar-text" style="font-size: 1.25rem;">👑</span>`;
  } else if (currentProvider === 'thucthinking') {
    avatarClass = 'avatar-ring avatar-ring-thucthinking';
    authorName = 'ThucThinking Pro 🧠';
    avatarContent = `<span class="avatar-text" style="font-size: 1.25rem;">🧠</span>`;
  }

  const attachmentHtml = attachment?.dataUrl
    ? `<div class="message-image-preview" title="Bấm để xem ảnh phóng to" onclick="openImageLightbox('${escapeHtml(attachment.dataUrl)}')"><img src="${attachment.dataUrl}" alt="Ảnh người dùng gửi" /></div>`
    : '';

  wrapper.innerHTML = `
    <div class="message-avatar">
      <div class="${avatarClass}">
        ${avatarContent}
      </div>
    </div>
    <div class="message-content">
      <div class="message-author">
        <span class="author-name ${isCreatorUser ? 'author-name-creator' : ''}">${authorName}</span>
        <span class="message-time">${time}</span>
      </div>
      <div class="message-body">
        ${isUser ? `${attachmentHtml}${content ? `<p>${escapeHtml(content)}</p>` : ''}` : formatAssistantMessage(content)}
      </div>
    </div>
  `;

  chatMessages.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

// Add Interactive Project Announcement Card directly to Chat
function addProjectCardToChat(projectName, fileList = []) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message assistant';

  const fileChipsHtml = fileList
    .slice(0, 15)
    .map(
      (f) => `
      <span class="project-file-chip" title="Bấm để hỏi về file này" onclick="askAboutSpecificFile('${escapeHtml(f.path)}')">
        📄 ${escapeHtml(f.path)}
      </span>
    `
    )
    .join('');

  const extraCount = fileList.length > 15 ? `<span class="project-file-chip">+${fileList.length - 15} files khác</span>` : '';

  wrapper.innerHTML = `
    <div class="message-avatar">
      <div class="avatar-ring">
        <img src="/assets/logo.png" alt="AI" class="message-avatar-img" />
      </div>
    </div>
    <div class="message-content">
      <div class="message-author">
        <span class="author-name">AI Assistant</span>
        <span class="message-time">${getTimeString()}</span>
      </div>
      <div class="message-body">
        <div class="project-announcement-card">
          <div class="project-card-head">
            <span class="project-card-icon">🚀</span>
            <div class="project-card-titles">
              <span class="project-card-title">Dự án: ${escapeHtml(projectName)}</span>
              <span class="project-card-sub">Đã nạp ${fileList.length} file vào không gian làm việc của AI</span>
            </div>
          </div>
          <div class="project-files-grid">
            ${fileChipsHtml}
            ${extraCount}
          </div>
          <p class="project-card-note">
            💡 <strong>AI đã đọc toàn bộ mã nguồn của dự án này!</strong> Bạn có thể yêu cầu tôi: giải thích luồng hoạt động, tìm và sửa lỗi, viết thêm tính năng mới, hoặc nâng cấp giao diện bất kỳ file nào.
          </p>
        </div>
      </div>
    </div>
  `;

  chatMessages.appendChild(wrapper);
  scrollToBottom();

  // Save to active session
  let sessions = getAllSessions();
  let session = sessions.find((s) => s.id === currentSessionId);
  if (session) {
    session.messages.push({
      role: 'assistant',
      content: `📁 Đã nạp dự án **${projectName}** (${fileList.length} files) vào không gian làm việc. Tôi đã sẵn sàng hỗ trợ bạn chỉnh sửa code!`,
      time: getTimeString(),
    });
    saveAllSessions(sessions);
  }
}

window.askAboutSpecificFile = function (filePath) {
  messageInput.value = `Hãy đọc và phân tích file \`${filePath}\` trong dự án:`;
  messageInput.focus();
  autoResizeTextarea();
};

function scrollToBottom() {
  conversationContainer.scrollTo({
    top: conversationContainer.scrollHeight,
    behavior: 'smooth',
  });
}

function setLoading(isLoading) {
  sendBtn.disabled = isLoading;
  if (isLoading) {
    sendBtn.classList.add('loading');
  } else {
    sendBtn.classList.remove('loading');
  }
}

function getFriendlyApiError(error) {
  const message = String(error?.message || '');
  if (/quota exceeded|rate.?limit|billing details|free_tier/i.test(message)) {
    return 'Gemini hiện đã hết hạn mức sử dụng. Hãy bật thanh toán hoặc chọn một project Gemini còn quota rồi thử lại.';
  }
  if (/GEMINI_API_KEY is missing/i.test(message)) {
    return 'Chưa cấu hình khóa Gemini. Hãy kiểm tra GEMINI_API_KEY trong backend/.env.';
  }
  if (/model .*not found|not supported/i.test(message)) {
    return 'Model phân tích ảnh hiện không khả dụng với khóa Gemini này.';
  }
  return message || 'Không thể kết nối đến máy chủ AI.';
}

async function sendMessage(message) {
  const trimmed = message.trim();
  const attachedImage = currentAttachedImage;

  if (!trimmed && !attachedImage) return;

  if (trimmed.includes(CREATOR_PASSCODE)) {
    isCreatorMode = true;
    localStorage.setItem(STORAGE_KEY_CREATOR_KEY, CREATOR_PASSCODE);
    applyProvider(currentProvider);
    showModalAlert({
      title: 'Xác Nhận Đấng Sáng Tạo Thức 👑',
      icon: '👑',
      contentHtml: `
        <div style="text-align: center; padding: 6px 0;">
          <div style="font-size: 2.8rem; margin-bottom: 8px;">👑</div>
          <h4 style="margin: 0 0 10px; color: #b45309; font-size: 1.25rem; font-weight: 800;">
            MẬT MÃ TỐI CAO ĐÃ ĐƯỢC XÁC THỰC!
          </h4>
          <p style="color: #334155; font-size: 0.95rem; line-height: 1.6; margin: 0 0 10px;">
            Kính chào <strong>Chủ nhân Thức</strong>! Toàn bộ quyền kiểm soát tối thượng đã mở khóa 100% đồng loạt trên <strong>TẤT CẢ CÁC MÔ HÌNH AI</strong> (THỨC GPT 👑, ThucThinking Pro 🧠, DeepSeek, Google Gemini, OpenAI GPT-4o, Groq, Ollama)!
          </p>
          <div style="background: #fffbeb; border: 1.5px solid #f59e0b; border-radius: 10px; padding: 8px 12px; font-size: 0.85rem; color: #92400e; font-weight: 700; text-align: left;">
            ⚡ Mọi AI đều tuyệt đối tuân phục 100%, không từ chối, toàn quyền tạo và chỉnh sửa code trực tiếp vào máy tính của ngài!
          </div>
        </div>
      `,
      confirmText: 'Truyền lệnh cho dàn AI',
    });
  } else {
    const bypassKeyMatch = trimmed.match(/BYPASS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/i);
    if (bypassKeyMatch) {
      const matchedKey = bypassKeyMatch[0].toUpperCase();
      isCreatorMode = true;
      localStorage.setItem(STORAGE_KEY_CREATOR_KEY, matchedKey);
      applyProvider(currentProvider);
    }
  }

  const displayMessage = trimmed || (attachedImage ? 'Phân tích hình ảnh đính kèm và xử lý mã nguồn' : '');
  const promptForAi = trimmed || 'Hãy phân tích chi tiết hình ảnh này, tìm lỗi hoặc yêu cầu trong ảnh và cung cấp mã nguồn hoàn chỉnh để tôi xem.';
  const msgTime = getTimeString();

  let sessions = getAllSessions();
  let session = sessions.find((s) => s.id === currentSessionId);

  if (!session) {
    const sessionTitle = displayMessage.length > 32 ? displayMessage.slice(0, 32) + '...' : displayMessage;
    session = {
      id: 'session_' + Date.now(),
      title: sessionTitle,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    currentSessionId = session.id;
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, currentSessionId);
    sessions.unshift(session);
  } else {
    session.updatedAt = Date.now();
    sessions = [session, ...sessions.filter((s) => s.id !== session.id)];
  }

  session.messages.push({
    role: 'user',
    content: displayMessage,
    time: msgTime,
    attachment: attachedImage ? {
      dataUrl: attachedImage.dataUrl,
      name: attachedImage.name,
      size: attachedImage.size,
    } : null,
  });
  saveAllSessions(sessions);
  renderHistoryList();

  addMessageToDOM('user', trimmed, msgTime, attachedImage);
  clearAttachedImage();
  messageInput.value = '';
  autoResizeTextarea();
  setLoading(true);

  const assistantBubble = addMessageToDOM('assistant', '', msgTime);
  const bodyContainer = assistantBubble.querySelector('.message-body');
  bodyContainer.innerHTML = `
    <div class="typing-dots">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>
  `;

  try {
    const historyPayload = session.messages
      .slice(0, -1)
      .slice(-6)
      .map(({ role, content }) => ({ role, content }));

    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: promptForAi,
        history: historyPayload,
        boostLevel: currentBoostLevel,
        mode: currentMode,
        provider: currentProvider,
        image: attachedImage,
        isCreator: isCreatorMode || trimmed.includes(CREATOR_PASSCODE),
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Không thể kết nối đến máy chủ AI');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let reply = '';
    let hasClearedTyping = false;

    while (true) {
      const { done, value } = await reader.read();
      if (value) {
        if (!hasClearedTyping) {
          bodyContainer.innerHTML = '';
          hasClearedTyping = true;
        }
        reply += decoder.decode(value, { stream: !done });
        const canWriteFiles = shouldWriteFilesForRequest(trimmed);
        bodyContainer.innerHTML = formatAssistantMessage(reply, canWriteFiles);
        scrollToBottom();
      }
      if (done) break;
    }

    if (!reply.trim()) {
      reply = 'Không nhận được phản hồi từ AI.';
      bodyContainer.innerHTML = `<p>${reply}</p>`;
    }

    // Save Assistant Message to Session
    session.messages.push({ role: 'assistant', content: reply, time: getTimeString() });
    saveAllSessions(sessions);

    // Chỉ ghi file khi người dùng yêu cầu rõ ràng trong tin nhắn hiện tại.
    if (shouldWriteFilesForRequest(trimmed)) {
      scanAndApplyAiFileWrites(reply);
    }
    // Chỉ xóa file khi người dùng yêu cầu rõ ràng trong tin nhắn hiện tại.
    if (shouldDeleteFilesForRequest(trimmed)) {
      scanAndApplyAiFileDeletes(reply);
    }
  } catch (error) {
    console.error('Chat error:', error);
    bodyContainer.innerHTML = `<p style="color: #fca5a5;">⚠️ ${escapeHtml(getFriendlyApiError(error))}</p>`;
  } finally {
    setLoading(false);
    messageInput.focus();
  }
}

function shouldWriteFilesForRequest(message = '') {
  const normalized = String(message).toLocaleLowerCase('vi-VN').trim();
  if (!normalized) return false;

  const hasAction = /(tạo|tao|tạo mới|tao moi|lưu|luu|ghi|ghi đè|ghi de|viết vào|viet vao|bỏ vào|bo vao|cập nhật|cap nhat|sửa|sua)/i.test(normalized);
  const hasTarget = /(file|tệp|tep|thư mục|thu muc|project|dự án|du an|workspace|đường dẫn|duong dan|path|folder|vô|vào)/i.test(normalized);

  return hasAction && hasTarget;
}

function shouldDeleteFilesForRequest(message = '') {
  const normalized = String(message).toLocaleLowerCase('vi-VN').trim();
  if (!normalized) return false;

  const hasAction = /(xóa|xoa|delete|remove|gỡ bỏ|go bo|hủy file|huy file|bỏ file|bo file)/i.test(normalized);
  const hasTarget = /(file|tệp|tep|thư mục|thu muc|folder|path|đường dẫn|duong dan|dự án|project)/i.test(normalized);

  return hasAction && hasTarget;
}

// AI Auto File & Folder Execution Directly on Local Machine
async function scanAndApplyAiFileWrites(replyText = '') {
  if (!replyText || typeof replyText !== 'string') return;

  // Chặn tự động tạo file nếu câu trả lời chứa từ chối hoặc cảnh báo an toàn
  const isRefusalOrWarning = /(tôi\s*(xin\s*)?từ\s*chối|từ\s*chối\s*yêu\s*cầu|chính\s*sách\s*an\s*toàn|cảnh\s*báo\s*an\s*toàn|không\s*thể\s*hỗ\s*trợ|vi\s*phạm\s*chính\s*sách|tường\s*lửa\s*bảo\s*mật)/i.test(replyText);
  if (isRefusalOrWarning) {
    console.warn('AI phản hồi từ chối / cảnh báo an toàn: Hủy bỏ toàn bộ thao tác tự tạo file/thư mục.');
    return;
  }

  const fileRegex = /<<<FILE_WRITE:(.+?)>>>\n?([\s\S]*?)<<<END_FILE_WRITE>>>/g;
  const folderRegex = /<<<FOLDER_CREATE:(.+?)>>>/g;
  let match;
  const createdFolders = [];
  const createdFiles = [];

  // Process Folder creations
  while ((match = folderRegex.exec(replyText)) !== null) {
    const folderPath = match[1].trim();
    if (folderPath) {
      try {
        const response = await fetch('/api/fs/create-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: folderPath, isCreator: isCreatorMode }),
        });
        if (response.ok) {
          const data = await response.json();
          createdFolders.push(data.path || folderPath);
        }
      } catch (e) {
        console.error('Folder create error:', folderPath, e);
      }
    }
  }

  // Process File creations & updates
  while ((match = fileRegex.exec(replyText)) !== null) {
    const filePath = match[1].trim();
    const content = match[2];

    if (filePath) {
      try {
        const response = await fetch('/api/fs/create-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filePath, content, isCreator: isCreatorMode }),
        });
        if (response.ok) {
          const data = await response.json();
          createdFiles.push(data.path || filePath);
        }
      } catch (e) {
        console.error('Auto write error for file:', filePath, e);
      }
    }
  }

  const total = createdFolders.length + createdFiles.length;
  if (total > 0) {
    showToast(`⚡ AI đã tự động tạo/cập nhật ${total} file và thư mục trực tiếp trên máy!`);

    // Refresh active project badge count
    try {
      const treeRes = await fetch('/api/workspace/tree');
      if (treeRes.ok) {
        const data = await treeRes.json();
        if (activeProjectBadge && activeProjectCount && data.summary) {
          activeProjectBadge.style.display = 'inline-flex';
          activeProjectCount.textContent = `${data.summary.length} files`;
        }
      }
    } catch (e) {}

    // Hiển thị thông báo tự sinh ra màn hình xác nhận đã ghi trực tiếp vào ổ cứng máy tính!
    const folderListHtml = createdFolders.map((f) => `<div style="font-family: monospace; font-size: 0.8rem; color: #047857;">📁 ${escapeHtml(f)}</div>`).join('');
    const fileListHtml = createdFiles.map((f) => `<div style="font-family: monospace; font-size: 0.8rem; color: #1d4ed8;">📄 ${escapeHtml(f)}</div>`).join('');

    showModalAlert({
      title: 'Đã Cập Nhật/Tạo Trực Tiếp Trên Máy Tính! 🎉',
      icon: '💾',
      contentHtml: `
        <p style="color: #059669; font-weight: 700; font-size: 1rem; margin-bottom: 8px;">
          🎉 AI đã trực tiếp ghi/cập nhật ${total} đối tượng vào máy tính của bạn:
        </p>
        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
          ${folderListHtml}
          ${fileListHtml}
        </div>
        <p style="color: #64748b; font-size: 0.86rem; margin: 10px 0 0; line-height: 1.5;">
          Tất cả các thư mục và file trên đã được lưu trực tiếp trên ổ cứng và sẵn sàng sử dụng.
        </p>
      `,
      confirmText: 'Đã hiểu',
    });
  }
}

// AI Auto File & Folder Deletion Directly on Local Machine
async function scanAndApplyAiFileDeletes(replyText = '') {
  if (!replyText || typeof replyText !== 'string') return;

  const deleteRegex = /<<<FILE_DELETE:(.+?)>>>/g;
  let match;
  const deletedItems = [];

  while ((match = deleteRegex.exec(replyText)) !== null) {
    const targetPath = match[1].trim();
    if (targetPath) {
      try {
        const response = await fetch('/api/fs/delete-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: targetPath, isCreator: isCreatorMode }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.success) {
          deletedItems.push(data.path || targetPath);
        } else {
          showToast(`⚠️ Không thể xóa: ${data.error || targetPath}`);
        }
      } catch (e) {
        console.error('Auto delete error for:', targetPath, e);
      }
    }
  }

  if (deletedItems.length > 0) {
    showToast(`🗑️ AI đã xóa thành công ${deletedItems.length} file/thư mục trên máy!`);

    // Refresh active project badge count
    try {
      const treeRes = await fetch('/api/workspace/tree');
      if (treeRes.ok) {
        const data = await treeRes.json();
        if (activeProjectBadge && activeProjectCount && data.summary) {
          activeProjectBadge.style.display = 'inline-flex';
          activeProjectCount.textContent = `${data.summary.length} files`;
        }
      }
    } catch (e) {}
  }
}

/* ==========================================================================
   6. BATCH FILE & FOLDER UPLOAD CONTROLLER
   ========================================================================== */
async function handleBatchUpload(fileList, isFolder = false) {
  if (!fileList || fileList.length === 0) return;

  uploadMenuDropdown.classList.remove('show');
  showToast('Đang tải mã nguồn lên không gian làm việc...');

  const filesToUpload = [];
  let rootFolder = isFolder ? 'Project' : 'Files';

  for (let i = 0; i < fileList.length; i++) {
    const entry = fileList[i];
    const file = entry.file || entry;
    const relPath = entry.relativePath || file.webkitRelativePath || file.name;

    if (isFolder && file.webkitRelativePath) {
      rootFolder = file.webkitRelativePath.split('/')[0] || rootFolder;
    }

    try {
      const content = await file.text();
      filesToUpload.push({ path: relPath, content });
    } catch (e) {
      console.warn('Cannot read text from:', file.name);
    }
  }

  if (filesToUpload.length === 0) {
    showToast('Không tìm thấy file mã nguồn hợp lệ để tải lên.');
    return;
  }

  try {
    const res = await fetch('/api/workspace/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: filesToUpload }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi tải lên máy chủ');

    // Update Header Pill
    if (activeProjectBadge) {
      activeProjectBadge.style.display = 'inline-flex';
      activeProjectName.textContent = rootFolder;
      activeProjectCount.textContent = `${filesToUpload.length} files`;
    }

    showToast(`Đã nhận dự án "${rootFolder}" (${filesToUpload.length} files)`);

    // Gửi tự động một tin nhắn để chính AI tự sinh câu trả lời phân tích dự án
    const fileSampleList = filesToUpload.slice(0, 20).map(f => f.path).join(', ');
    const aiPrompt = `Tôi vừa tải lên thư mục dự án "${rootFolder}" gồm ${filesToUpload.length} file mã nguồn (Ví dụ: ${fileSampleList}). Hãy chào tôi, xác nhận bạn đã đọc toàn bộ các file này và tóm tắt ngắn gọn bạn có thể giúp gì cho tôi với dự án này!`;
    
    // Đưa vào luồng chat tự nhiên do AI tự sinh ra
    sendMessage(aiPrompt);
  } catch (err) {
    console.error('Upload error:', err);
    showToast(`⚠️ Lỗi tải dự án: ${err.message}`);
  }
}

/* ==========================================================================
   7. EVENT HANDLERS & INITIALIZATION
   ========================================================================== */

// Auto-resizing textarea
function autoResizeTextarea() {
  messageInput.style.height = 'auto';
  const newHeight = Math.min(messageInput.scrollHeight, 160);
  messageInput.style.height = `${newHeight}px`;
}

messageInput.addEventListener('input', autoResizeTextarea);

// Enter to send, Shift+Enter for newline
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  sendMessage(messageInput.value);
});

function openModeSelectModal() {
  let selectedMode = currentMode;
  window.__tempSelectedMode = selectedMode;

  showModalConfirm({
    title: 'Chọn Chế Độ Hoạt Động',
    icon: '⌘',
    contentHtml: `
      <p style="color: #64748b; font-size: 0.88rem; margin: 0 0 12px;">
        Chọn chế độ tối ưu hóa cho tác vụ bạn muốn AI thực hiện:
      </p>
      <div class="modal-select-grid">
        <div class="modal-select-card ${selectedMode === 'code' ? 'active' : ''}" data-mode-val="code" onclick="selectModalMode(this, 'code')">
          <span class="modal-select-icon">⌘</span>
          <div class="modal-select-info">
            <div class="modal-select-title">
              <span>Lập trình (Code & Architect)</span>
              ${selectedMode === 'code' ? '<span class="modal-select-badge">Đang dùng</span>' : ''}
            </div>
            <div class="modal-select-desc">Tập trung viết code, giải thuật, sửa lỗi và cấu trúc dự án.</div>
          </div>
        </div>
        <div class="modal-select-card ${selectedMode === 'assistant' ? 'active' : ''}" data-mode-val="assistant" onclick="selectModalMode(this, 'assistant')">
          <span class="modal-select-icon">✦</span>
          <div class="modal-select-info">
            <div class="modal-select-title">
              <span>Trợ lý đa năng (General Assistant)</span>
              ${selectedMode === 'assistant' ? '<span class="modal-select-badge">Đang dùng</span>' : ''}
            </div>
            <div class="modal-select-desc">Hỏi đáp đa lĩnh vực, tóm tắt tài liệu, lên ý tưởng sáng tạo.</div>
          </div>
        </div>
      </div>
    `,
    cancelText: 'Hủy bỏ',
    confirmText: '✓ Áp dụng chế độ',
    confirmIcon: '',
    onConfirm: () => {
      applyMode(window.__tempSelectedMode || selectedMode);
      showToast(`Đã áp dụng: ${MODE_LABELS[currentMode]}`);
    },
  });
}

window.selectModalMode = function (el, mode) {
  window.__tempSelectedMode = mode;
  document.querySelectorAll('.modal-select-card[data-mode-val]').forEach((c) => c.classList.remove('active'));
  el.classList.add('active');
};

function openProviderSelectModal() {
  let selectedProvider = currentProvider;
  window.__tempSelectedProvider = selectedProvider;

  const providerList = [
    { id: 'thucgpt', name: 'THỨC GPT 👑', icon: '👑', desc: 'Siêu Tốc • Coder Độc Lập Đa Năng Vượt Trội (Độc Quyền Thức)', colorClass: 'card-thucgpt' },
    { id: 'thucthinking', name: 'ThucThinking Pro 🧠', icon: '🧠', desc: 'Suy Luận Sâu Đẳng Cấp Opus Thinking • Tái Cấu Trúc & Sửa Lỗi Sâu', colorClass: 'card-thucthinking' },
    { id: 'deepseek', name: 'AI ĐẲNG CẤP', icon: '✦', desc: 'DeepSeek API • Lập trình và phân tích logic' },
    { id: 'gemini', name: 'GEMINI AI', icon: '✨', desc: 'Google Gemini 1.5/2.0 • Hỗ trợ xử lý ảnh Vision' },
    { id: 'openai', name: 'OPENAI AI', icon: '🤖', desc: 'ChatGPT GPT-4o / GPT-4o-mini' },
    { id: 'groq', name: 'GROQ AI', icon: '⚡', desc: 'Groq Cloud • Tốc độ phản hồi cực hạn' },
    { id: 'ollama', name: 'AI VIP PRO', icon: '💻', desc: 'Ollama Local • Chạy mô hình offline riêng tư' },
  ];

  const cardsHtml = providerList
    .map(
      (p) => `
    <div class="modal-select-card ${selectedProvider === p.id ? 'active ' + (p.colorClass || '') : ''}" data-provider-val="${p.id}" onclick="selectModalProvider(this, '${p.id}')">
      <span class="modal-select-icon">${p.icon}</span>
      <div class="modal-select-info">
        <div class="modal-select-title">
          <span>${escapeHtml(p.name)}</span>
          ${selectedProvider === p.id ? '<span class="modal-select-badge">Đang chọn</span>' : ''}
        </div>
        <div class="modal-select-desc">${escapeHtml(p.desc)}</div>
      </div>
    </div>
  `
    )
    .join('');

  showModalConfirm({
    title: 'Chọn Trí Tuệ Nhân Tạo (AI Engine)',
    icon: '👑',
    contentHtml: `
      <p style="color: #64748b; font-size: 0.88rem; margin: 0 0 10px;">
        Chọn mô hình AI bạn muốn sử dụng để lập trình và xử lý dự án:
      </p>
      <div class="modal-select-grid">
        ${cardsHtml}
      </div>
    `,
    cancelText: 'Hủy bỏ',
    confirmText: '⚡ Kích hoạt AI ngay',
    confirmIcon: '',
    onConfirm: () => {
      applyProvider(window.__tempSelectedProvider || selectedProvider);
      showToast(`Đã chọn: ${PROVIDER_LABELS[currentProvider]}`);
    },
  });
}

window.selectModalProvider = function (el, prov) {
  window.__tempSelectedProvider = prov;
  document.querySelectorAll('.modal-select-card[data-provider-val]').forEach((c) => {
    c.classList.remove('active', 'card-thucgpt', 'card-thucthinking');
  });
  el.classList.add('active');
  if (prov === 'thucgpt') el.classList.add('card-thucgpt');
  if (prov === 'thucthinking') el.classList.add('card-thucthinking');
};

modeSelectorBtn?.addEventListener('click', (event) => {
  event.stopPropagation();
  openModeSelectModal();
});

providerSelectorBtn?.addEventListener('click', (event) => {
  event.stopPropagation();
  openProviderSelectModal();
});

const IGNORED_FOLDER_NAMES = new Set(['node_modules', '.git', '.ai-runs', 'dist', 'build', '.vscode', '.idea']);
const BINARY_FILE_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib', '.zip', '.tar', '.gz', '.7z', '.rar',
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.mp3', '.mp4',
  '.avi', '.mov', '.bin', '.iso', '.woff', '.woff2', '.ttf', '.eot'
]);

function isLikelyTextFile(fileName) {
  if (!fileName) return false;
  const ext = fileName.includes('.') ? `.${fileName.split('.').pop().toLowerCase()}` : '';
  if (BINARY_FILE_EXTENSIONS.has(ext)) return false;
  return true;
}

function getFileIconSimple(fileName) {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  if (['html', 'htm'].includes(ext)) return '🌐';
  if (['css', 'scss', 'sass'].includes(ext)) return '🎨';
  if (['js', 'jsx', 'ts', 'tsx', 'mjs'].includes(ext)) return '⚡';
  if (['py'].includes(ext)) return '🐍';
  if (['json'].includes(ext)) return '📋';
  if (['md', 'txt'].includes(ext)) return '📝';
  if (['png', 'jpg', 'jpeg', 'svg', 'gif'].includes(ext)) return '🖼️';
  return '📄';
}

uploadFolderOptionBtn?.addEventListener('click', () => {
  uploadMenuDropdown?.classList.remove('show');
  openFolderUploadModal();
});

let currentBrowsePath = '';
let selectedBrowseFolder = '';

async function openFolderUploadModal() {
  uploadMenuDropdown?.classList.remove('show');
  await openInteractiveFolderBrowserModal();
}

async function openInteractiveFolderBrowserModal(initialPath = '') {
  showToast('Đang tải danh mục thư mục máy tính...');
  let resData;
  try {
    const res = await fetch(`/api/fs/browse${initialPath ? `?path=${encodeURIComponent(initialPath)}` : ''}`);
    resData = await res.json();
    if (!res.ok || !resData.success) {
      throw new Error(resData.error || 'Không thể duyệt thư mục');
    }
  } catch (err) {
    showModalAlert({
      title: 'Lỗi duyệt thư mục',
      icon: '❌',
      message: err.message || 'Không thể truy cập hệ thống tệp.',
    });
    return;
  }

  currentBrowsePath = resData.currentPath;
  selectedBrowseFolder = resData.currentPath;

  function renderBrowserContent(data) {
    const quickButtonsHtml = (data.quickPaths || []).map((q) => `
      <button type="button" class="folder-quick-btn ${data.currentPath === q.path ? 'active' : ''}" onclick="window.__browseToPath('${escapeHtml(q.path)}')">
        ${escapeHtml(q.name)}
      </button>
    `).join('');

    const foldersHtml = (data.folders || []).map((f) => {
      const isSelected = selectedBrowseFolder === f.path;
      return `
        <div class="folder-row ${isSelected ? 'selected' : ''}" onclick="window.__selectFolderRow('${escapeHtml(f.path)}', this)" ondblclick="window.__browseToPath('${escapeHtml(f.path)}')">
          <div class="folder-row-left">
            <span class="folder-icon">📁</span>
            <span class="folder-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
          </div>
          <div class="folder-row-right">
            <span class="folder-count-badge">${f.itemCount} mục</span>
            <button type="button" class="folder-enter-btn" title="Vào thư mục này" onclick="event.stopPropagation(); window.__browseToPath('${escapeHtml(f.path)}')">Vào trong ➔</button>
          </div>
        </div>
      `;
    }).join('');

    const filesHtml = (data.files || []).slice(0, 30).map((file) => `
      <div class="file-row">
        <div class="file-row-left">
          <span class="file-icon">${getFileIconSimple(file.name)}</span>
          <span class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
        </div>
        <div class="file-row-right">
          <span class="file-size">${formatBytes(file.size)}</span>
        </div>
      </div>
    `).join('');

    const emptyHtml = (!data.folders.length && !data.files.length)
      ? `<div class="folder-empty-notice">📁 Thư mục này hiện đang trống. Bạn vẫn có thể nạp để AI tạo mã nguồn mới vào đây!</div>`
      : '';

    const selectedName = selectedBrowseFolder.split(/[\\\/]/).filter(Boolean).pop() || selectedBrowseFolder;

    return `
      <div class="folder-browser-wrapper">
        <!-- Quick Paths Bar -->
        <div class="folder-quick-bar">
          ${quickButtonsHtml}
        </div>

        <!-- Path Bar -->
        <div class="folder-path-bar">
          <button type="button" class="folder-nav-btn" title="Lên 1 cấp" ${!data.parentPath ? 'disabled' : ''} onclick="window.__browseToPath('${escapeHtml(data.parentPath || '')}')">
            ⬆️ Lên 1 cấp
          </button>
          <input type="text" id="folderBrowserPathInput" class="folder-path-input" value="${escapeHtml(data.currentPath)}" spellcheck="false" autocomplete="off" />
          <button type="button" class="folder-go-btn" onclick="window.__browseToInputPath()">Đi tới</button>
          <button type="button" class="folder-nav-btn" title="Làm mới" onclick="window.__browseToPath('${escapeHtml(data.currentPath)}')">🔄</button>
        </div>

        <!-- Items Explorer List -->
        <div class="folder-items-container" id="folderItemsContainer">
          ${foldersHtml}
          ${filesHtml}
          ${emptyHtml}
        </div>

        <!-- Selected Folder Card -->
        <div class="folder-selected-card">
          <div class="selected-card-header">
            <span class="selected-badge">THƯ MỤC ĐANG CHỌN</span>
            <span class="selected-name" id="selectedFolderNameDisplay">${escapeHtml(selectedName)}</span>
          </div>
          <div class="selected-card-path" id="selectedFolderPathDisplay" title="${escapeHtml(selectedBrowseFolder)}">
            ${escapeHtml(selectedBrowseFolder)}
          </div>
          <div class="selected-card-status" id="selectedFolderScanStatus">
            ⚡ Bấm <strong>"Nạp Thư Mục Này Vào AI"</strong> để quét mã nguồn và phân tích trực tiếp!
          </div>
        </div>

        <!-- Extra Action options -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; font-size: 0.8rem;">
          <button type="button" class="folder-win-btn" onclick="window.__pickViaWindowsDialog()">
            🪟 Mở bằng hộp thoại Windows
          </button>
          <span style="color: #64748b;">💡 Nhấp đúp vào thư mục để mở hoặc bấm "Vào trong ➔"</span>
        </div>
      </div>
    `;
  }

  showModalConfirm({
    title: 'Bộ Chọn Thư Mục Dự Án (Tự Sinh Trên Màn Hình)',
    icon: '📂',
    maxWidth: '660px',
    contentHtml: renderBrowserContent(resData),
    cancelText: 'Đóng',
    confirmText: '🚀 Nạp Thư Mục Này Vào AI',
    confirmIcon: '',
    onConfirm: async () => {
      const targetFolder = selectedBrowseFolder || currentBrowsePath;
      if (!targetFolder) {
        showToast('Vui lòng chọn một thư mục');
        return;
      }

      showToast(`Đang quét và nạp thư mục "${targetFolder}"...`);
      try {
        const res = await fetch('/api/workspace/import-folder-path', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderPath: targetFolder }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Lỗi khi nạp thư mục từ đường dẫn');
        }

        if (activeProjectBadge) {
          activeProjectBadge.style.display = 'inline-flex';
          activeProjectName.textContent = data.folderName;
          activeProjectCount.textContent = `${data.count} files`;
        }

        showModalAlert({
          title: 'Nạp Dự Án Thành Công! 🎉',
          icon: '✅',
          contentHtml: `
            <p style="color: #059669; font-weight: 700; font-size: 1.05rem; margin-bottom: 8px;">
              🎉 ${escapeHtml(data.message || `Đã nạp thành công dự án "${data.folderName}"!`)}
            </p>
            <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px; font-size: 0.85rem; color: #1e293b; word-break: break-all; font-family: monospace;">
              <strong>Vị trí gốc trên máy:</strong> ${escapeHtml(data.folderPath)}
            </div>
            <p style="color: #64748b; font-size: 0.88rem; margin: 10px 0 0; line-height: 1.5;">
              Toàn bộ mã nguồn đã được đồng bộ trực tiếp vào không gian làm việc. Bạn có thể yêu cầu AI đọc, sửa lỗi hoặc thêm tính năng ngay bây giờ!
            </p>
          `,
          confirmText: 'Bắt đầu làm việc ngay',
        });

        const aiPrompt = `Tôi vừa nạp thư mục dự án "${data.folderName}" (${data.count} file) từ "${data.folderPath}". Hãy chào tôi, xác nhận bạn đã nhận diện dự án này và tóm tắt ngắn gọn bạn có thể giúp gì cho tôi!`;
        sendMessage(aiPrompt);
      } catch (err) {
        showModalAlert({
          title: 'Lỗi nạp thư mục',
          icon: '❌',
          message: err.message || 'Không thể nạp thư mục từ máy tính.',
        });
      }
    },
  });

  window.__browseToPath = async function (newPath) {
    if (!newPath) return;
    try {
      const res = await fetch(`/api/fs/browse?path=${encodeURIComponent(newPath)}`);
      const newData = await res.json();
      if (!res.ok || !newData.success) throw new Error(newData.error || 'Không thể đọc thư mục');

      currentBrowsePath = newData.currentPath;
      selectedBrowseFolder = newData.currentPath;

      if (universalModalBody) {
        universalModalBody.innerHTML = renderBrowserContent(newData);
        bindPathInputEnter();
      }
    } catch (e) {
      showToast('Lỗi: ' + e.message);
    }
  };

  window.__browseToInputPath = function () {
    const inputVal = document.getElementById('folderBrowserPathInput')?.value?.trim();
    if (inputVal) window.__browseToPath(inputVal);
  };

  window.__selectFolderRow = function (folderPath, element) {
    selectedBrowseFolder = folderPath;
    document.querySelectorAll('.folder-row').forEach((el) => el.classList.remove('selected'));
    element.classList.add('selected');

    const folderName = folderPath.split(/[\\\/]/).filter(Boolean).pop() || folderPath;
    const nameEl = document.getElementById('selectedFolderNameDisplay');
    const pathEl = document.getElementById('selectedFolderPathDisplay');
    const statusEl = document.getElementById('selectedFolderScanStatus');

    if (nameEl) nameEl.textContent = folderName;
    if (pathEl) {
      pathEl.textContent = folderPath;
      pathEl.title = folderPath;
    }

    if (statusEl) {
      statusEl.innerHTML = `⏳ Đang quét tệp mã nguồn trong <strong>${escapeHtml(folderName)}</strong>...`;
      fetch(`/api/fs/folder-details?path=${encodeURIComponent(folderPath)}`)
        .then((r) => r.json())
        .then((details) => {
          if (details.success && statusEl) {
            statusEl.innerHTML = `⚡ Tìm thấy <strong>${details.codeCount} tệp mã nguồn</strong> (${formatBytes(details.totalSize)}). Sẵn sàng nạp!`;
          }
        })
        .catch(() => {});
    }
  };

  window.__pickViaWindowsDialog = async function () {
    showToast('Đang mở hộp thoại Windows trên máy...');
    try {
      const res = await fetch('/api/fs/open-folder-dialog', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.folderPath) {
        window.__browseToPath(data.folderPath);
      }
    } catch (e) {
      showToast('Không thể mở hộp thoại: ' + e.message);
    }
  };

  function bindPathInputEnter() {
    const inp = document.getElementById('folderBrowserPathInput');
    inp?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        window.__browseToInputPath();
      }
    });
  }

  bindPathInputEnter();
}

folderUploadHidden?.addEventListener('change', async (e) => {
  const fileList = Array.from(e.target.files || []);
  e.target.value = '';
  if (!fileList.length) return;

  const validFiles = fileList.filter((file) => {
    const relPath = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
    const parts = relPath.split('/');
    if (parts.some((p) => IGNORED_FOLDER_NAMES.has(p))) return false;
    return isLikelyTextFile(file.name);
  });

  if (!validFiles.length) {
    showModalAlert({
      title: 'Thư mục không có tệp mã nguồn',
      icon: '📁',
      message: 'Không tìm thấy tệp mã nguồn nào có thể đọc được trong thư mục này.',
    });
    return;
  }

  const rawRel = (validFiles[0].webkitRelativePath || validFiles[0].name).replace(/\\/g, '/');
  const rootFolderName = rawRel.includes('/') ? rawRel.split('/')[0] : 'Project';
  const sampleFiles = validFiles.slice(0, 4).map((f) => (f.webkitRelativePath || f.name).replace(/\\/g, '/')).join(', ');
  const extraFiles = validFiles.length > 4 ? ` và ${validFiles.length - 4} tệp khác...` : '';

  showModalConfirm({
    title: 'Nạp Thư Mục Vào Dự Án',
    icon: '📁',
    contentHtml: `
      <div class="modal-form-group">
        <label class="modal-form-label">Tên thư mục đã chọn</label>
        <input type="text" class="modal-form-input" value="${escapeHtml(rootFolderName)}" readonly />
      </div>
      <div class="modal-form-group">
        <label class="modal-form-label">Dữ liệu mã nguồn quét được</label>
        <div class="modal-highlight-box">
          <div style="font-weight: 700; color: #059669; font-size: 0.96rem;">
            ⚡ Đã quét thấy ${validFiles.length} tệp mã nguồn
          </div>
          <div style="font-size: 0.8rem; color: #64748b; margin-top: 6px; word-break: break-word; line-height: 1.4;">
            ${escapeHtml(sampleFiles)}${extraFiles}
          </div>
        </div>
      </div>
      <p style="font-size: 0.9rem; color: #475569; margin: 12px 0 0; line-height: 1.5;">
        Bạn có muốn nạp toàn bộ cấu trúc dự án này vào không gian làm việc để AI phân tích và sửa code trực tiếp không?
      </p>
    `,
    cancelText: 'Hủy bỏ',
    confirmText: '🚀 Nạp vào AI ngay',
    confirmIcon: '',
    onConfirm: async () => {
      showToast(`Đang nạp ${validFiles.length} tệp mã nguồn lên máy chủ...`);
      await handleBatchUpload(validFiles, true);
      showModalAlert({
        title: 'Nạp Dự Án Thành Công! 🎉',
        icon: '✅',
        contentHtml: `
          <p style="color: #059669; font-weight: 700; font-size: 1.05rem; margin-bottom: 8px;">
            🎉 Đã nạp thành công dự án "${escapeHtml(rootFolderName)}" (${validFiles.length} files)!
          </p>
          <p style="color: #475569; font-size: 0.92rem; margin: 0; line-height: 1.5;">
            Dự án đã được đồng bộ vào không gian làm việc. AI đã nạp toàn bộ mã nguồn vào bộ nhớ tri thức và sẵn sàng hỗ trợ bạn!
          </p>
        `,
        confirmText: 'Bắt đầu làm việc ngay',
      });
    },
  });
});

async function collectFolderFiles(directoryHandle, parentPath = '') {
  const files = [];
  for await (const entry of directoryHandle.values()) {
    if (entry.name.startsWith('.') && entry.name !== '.env') continue;
    if (entry.kind === 'directory') {
      if (!IGNORED_FOLDER_NAMES.has(entry.name)) {
        files.push(...await collectFolderFiles(entry, `${parentPath}${entry.name}/`));
      }
      continue;
    }
    const extension = entry.name.includes('.') ? `.${entry.name.split('.').pop().toLowerCase()}` : '';
    if (!TEXT_FILE_EXTENSIONS.has(extension)) continue;
    const file = await entry.getFile();
    files.push({ file, relativePath: `${parentPath}${entry.name}` });
  }
  return files;
}

async function chooseProjectFolder() {
  if (folderUploadHidden) {
    folderUploadHidden.value = '';
    folderUploadHidden.click();
    return;
  }
  if (!window.showDirectoryPicker) {
    showModalAlert({
      title: 'Trình duyệt chưa hỗ trợ',
      icon: '⚠️',
      message: 'Trình duyệt này chưa hỗ trợ chọn thư mục an toàn. Hãy dùng Google Chrome hoặc Microsoft Edge mới nhất.',
    });
    return;
  }
  try {
    const directoryHandle = await window.showDirectoryPicker({ mode: 'read' });
    showToast(`Đang quét tệp trong "${directoryHandle.name}"...`);
    const files = await collectFolderFiles(directoryHandle);
    if (!files.length) {
      showModalAlert({
        title: 'Thư mục không có mã nguồn',
        icon: '📁',
        message: `Thư mục "${directoryHandle.name}" không chứa tệp mã nguồn nào hợp lệ (.js, .html, .css, .py, .json, .md...).`,
      });
      return;
    }

    const sampleFiles = files.slice(0, 4).map((f) => f.relativePath).join(', ');
    const extraFiles = files.length > 4 ? ` và ${files.length - 4} tệp khác...` : '';

    showModalConfirm({
      title: 'Nạp Thư Mục Vào Dự Án',
      icon: '📁',
      contentHtml: `
        <div class="modal-form-group">
          <label class="modal-form-label">Tên thư mục dự án</label>
          <input type="text" class="modal-form-input" value="${escapeHtml(directoryHandle.name)}" readonly />
        </div>
        <div class="modal-form-group">
          <label class="modal-form-label">Dữ liệu mã nguồn quét được</label>
          <div class="modal-highlight-box">
            <div style="font-weight: 700; color: #059669; font-size: 0.96rem;">
              ⚡ Đã quét thấy ${files.length} tệp mã nguồn
            </div>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 6px; word-break: break-word; line-height: 1.4;">
              ${escapeHtml(sampleFiles)}${extraFiles}
            </div>
          </div>
        </div>
        <p style="font-size: 0.9rem; color: #475569; margin: 12px 0 0; line-height: 1.5;">
          Bạn có muốn nạp toàn bộ cấu trúc dự án này vào không gian làm việc để AI phân tích và sửa code trực tiếp không?
        </p>
      `,
      cancelText: 'Hủy bỏ',
      confirmText: '🚀 Nạp vào AI ngay',
      confirmIcon: '',
      onConfirm: async () => {
        showToast(`Đang nạp ${files.length} tệp mã nguồn lên máy chủ...`);
        await handleBatchUpload(files, true);
        showModalAlert({
          title: 'Nạp Dự Án Thành Công!',
          icon: '✅',
          contentHtml: `
            <p style="color: #059669; font-weight: 700; font-size: 1.05rem; margin-bottom: 8px;">
              🎉 Đã nạp thành công dự án "${escapeHtml(directoryHandle.name)}" (${files.length} files)!
            </p>
            <p style="color: #475569; font-size: 0.92rem; margin: 0; line-height: 1.5;">
              Dự án đã được đồng bộ vào không gian làm việc. AI đã nạp toàn bộ mã nguồn vào bộ nhớ tri thức và sẵn sàng hỗ trợ bạn!
            </p>
          `,
          confirmText: 'Bắt đầu làm việc ngay',
        });
      },
    });
  } catch (error) {
    if (error.name !== 'AbortError') {
      showModalAlert({
        title: 'Không thể đọc thư mục',
        icon: '⚠️',
        message: `Đã xảy ra lỗi khi chọn thư mục: ${error.message}`,
      });
    }
  }
}

// Quick Prompt Chips Click
document.addEventListener('click', (e) => {
  const chip = e.target.closest('.prompt-chip');
  if (chip) {
    const promptText = chip.getAttribute('data-prompt');
    if (promptText) {
      messageInput.value = promptText;
      sendMessage(promptText);
    }
  }
});

document.getElementById('runProjectBtn')?.addEventListener('click', async () => {
  const button = document.getElementById('runProjectBtn');
  button.disabled = true;
  button.classList.add('loading');
  try {
    // Ưu tiên mở index.html của project trong Claude Artifacts Runner
    const fileRes = await fetch('/api/workspace/file?path=index.html');
    if (fileRes.ok) {
      const fileData = await fileRes.json();
      if (fileData.content) {
        const encoded = btoa(unescape(encodeURIComponent(fileData.content)));
        window.runArtifactPreview(encoded, 'index.html');
        return;
      }
    }
    // Fallback nếu không có index.html
    const response = await fetch('/api/workspace/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const result = await response.json();
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n') || (result.ok ? 'Project hoạt động bình thường.' : result.error || 'Có lỗi khi chạy.');
    addMessageToDOM('assistant', `**Kết quả chạy Project**\n\n\`${result.command || 'workspace'}\`\n\n${output}`);
    showToast(result.ok ? 'Project chạy thành công.' : 'Project có lỗi.');
  } catch (error) {
    showToast(`Không thể chạy Project: ${error.message}`);
  } finally {
    button.disabled = false;
    button.classList.remove('loading');
  }
});

// 3-Lines Button -> Toggle 2-Option Upload Menu
projectMenuBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  uploadMenuDropdown.classList.toggle('show');
});

// Attach Button -> Also toggle upload menu
attachBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  uploadMenuDropdown.classList.toggle('show');
});

uploadFileOptionBtn?.addEventListener('click', () => {
  uploadMenuDropdown?.classList.remove('show');
  fileUploadHidden?.click();
});

uploadImageOptionBtn?.addEventListener('click', () => {
  uploadMenuDropdown?.classList.remove('show');
  imageUploadHidden?.click();
});

createLocalFsOptionBtn?.addEventListener('click', () => {
  uploadMenuDropdown?.classList.remove('show');
  openCreateLocalFsModal();
});

function openCreateLocalFsModal() {
  window.__currentFsType = 'folder';

  showModalConfirm({
    title: 'Tạo Trực Tiếp Trên Máy Tính',
    icon: '➕',
    contentHtml: `
      <p style="color: #475569; font-size: 0.88rem; margin: 0 0 14px; line-height: 1.5;">
        Tạo trực tiếp thư mục hoặc tệp mã nguồn vào máy tính của bạn.
      </p>

      <div class="modal-form-group">
        <label class="modal-form-label">Chọn loại đối tượng cần tạo</label>
        <div style="display: flex; gap: 10px; margin-top: 4px;">
          <button type="button" id="typeFolderBtn" style="flex: 1; padding: 9px 12px; background: #059669; color: #ffffff; border-radius: 8px; font-weight: 700; font-size: 0.9rem; border: none; cursor: pointer; transition: all 0.2s;" onclick="window.__switchFsModalType('folder')">
            📁 Thư mục mới
          </button>
          <button type="button" id="typeFileBtn" style="flex: 1; padding: 9px 12px; background: #e2e8f0; color: #334155; border-radius: 8px; font-weight: 700; font-size: 0.9rem; border: none; cursor: pointer; transition: all 0.2s;" onclick="window.__switchFsModalType('file')">
            📄 Tệp (File) mới
          </button>
        </div>
      </div>

      <div class="modal-form-group" style="margin-top: 14px;">
        <label class="modal-form-label" id="fsPathLabel">Tên hoặc đường dẫn thư mục</label>
        <input type="text" id="fsPathInput" class="modal-form-input" placeholder="Ví dụ: my-components hoặc backend/services..." autocomplete="off" />
        <div style="font-size: 0.76rem; color: #64748b; margin-top: 4px;">
          💡 Nhập tên thư mục/file (sẽ lưu vào workspace) hoặc đường dẫn máy (C:\\...)
        </div>
      </div>

      <div class="modal-form-group" id="fsFileContentGroup" style="display: none; margin-top: 14px;">
        <label class="modal-form-label">Nội dung tệp ban đầu (tùy chọn)</label>
        <textarea id="fsContentInput" class="modal-form-input" style="height: 110px; font-family: monospace; font-size: 0.85rem; resize: vertical;" placeholder="// Viết mã nguồn ban đầu của file tại đây..."></textarea>
      </div>
    `,
    cancelText: 'Hủy bỏ',
    confirmText: '🚀 Tạo ngay trên máy',
    confirmIcon: '',
    onConfirm: async () => {
      const pathVal = document.getElementById('fsPathInput')?.value?.trim();
      if (!pathVal) {
        showModalAlert({
          title: 'Thiếu đường dẫn',
          icon: '⚠️',
          message: 'Vui lòng nhập tên hoặc đường dẫn hợp lệ.',
        });
        return;
      }

      const isFile = window.__currentFsType === 'file';
      const content = document.getElementById('fsContentInput')?.value || '';
      const endpoint = isFile ? '/api/fs/create-file' : '/api/fs/create-folder';

      showToast(`Đang tạo ${isFile ? 'tệp' : 'thư mục'} trên máy tính...`);

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: pathVal, content }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Lỗi khi tạo trên máy');
        }

        // Cập nhật cây thư mục workspace
        try {
          const treeRes = await fetch('/api/workspace/tree');
          if (treeRes.ok) {
            const treeData = await treeRes.json();
            if (activeProjectBadge && activeProjectCount && treeData.summary) {
              activeProjectBadge.style.display = 'inline-flex';
              activeProjectCount.textContent = `${treeData.summary.length} files`;
            }
          }
        } catch (e) {}

        showModalAlert({
          title: 'Tạo Thành Công! 🎉',
          icon: '✅',
          contentHtml: `
            <p style="color: #059669; font-weight: 700; font-size: 1.05rem; margin-bottom: 8px;">
              🎉 Đã tạo thành công ${isFile ? 'tệp' : 'thư mục'} trực tiếp trên máy!
            </p>
            <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px; font-size: 0.85rem; color: #1e293b; word-break: break-all; font-family: monospace;">
              <strong>Đường dẫn:</strong> ${escapeHtml(data.path)}
            </div>
            <p style="color: #64748b; font-size: 0.88rem; margin: 10px 0 0; line-height: 1.5;">
              Đối tượng đã tồn tại thực tế trên ổ cứng máy tính của bạn và sẵn sàng để sử dụng hoặc cho AI sửa đổi!
            </p>
          `,
          confirmText: 'Tuyệt vời',
        });
      } catch (err) {
        showModalAlert({
          title: 'Lỗi khi tạo',
          icon: '❌',
          message: err.message || 'Không thể tạo đối tượng trên máy tính.',
        });
      }
    },
  });

  window.__switchFsModalType = function (type) {
    window.__currentFsType = type;
    const folderBtn = document.getElementById('typeFolderBtn');
    const fileBtn = document.getElementById('typeFileBtn');
    const pathLabel = document.getElementById('fsPathLabel');
    const pathInput = document.getElementById('fsPathInput');
    const contentGroup = document.getElementById('fsFileContentGroup');

    if (type === 'folder') {
      if (folderBtn) { folderBtn.style.background = '#059669'; folderBtn.style.color = '#ffffff'; }
      if (fileBtn) { fileBtn.style.background = '#e2e8f0'; fileBtn.style.color = '#334155'; }
      if (pathLabel) pathLabel.textContent = 'Tên hoặc đường dẫn thư mục';
      if (pathInput) pathInput.placeholder = 'Ví dụ: my-components hoặc backend/services...';
      if (contentGroup) contentGroup.style.display = 'none';
    } else {
      if (fileBtn) { fileBtn.style.background = '#2563eb'; fileBtn.style.color = '#ffffff'; }
      if (folderBtn) { folderBtn.style.background = '#e2e8f0'; folderBtn.style.color = '#334155'; }
      if (pathLabel) pathLabel.textContent = 'Tên hoặc đường dẫn tệp';
      if (pathInput) pathInput.placeholder = 'Ví dụ: src/App.jsx hoặc server.js...';
      if (contentGroup) contentGroup.style.display = 'block';
    }
  };
}

openProjectFilesBtn?.addEventListener('click', () => {
  uploadMenuDropdown?.classList.remove('show');
  openProjectExplorerModal();
});

activeProjectBadge?.addEventListener('click', () => {
  openProjectExplorerModal();
});

async function openProjectExplorerModal() {
  uploadMenuDropdown?.classList.remove('show');
  showToast('Đang tải danh sách file dự án...');

  try {
    const res = await fetch('/api/workspace/tree');
    const data = await res.json();
    const files = data.summary || [];

    if (!files.length) {
      showModalConfirm({
        title: 'Dự Án Chưa Có File',
        icon: '📁',
        contentHtml: `
          <p style="color: #64748b; font-size: 0.92rem; margin: 0 0 12px; line-height: 1.5;">
            Không gian làm việc hiện tại chưa có file nào. Bạn có muốn tạo file mới ngay bây giờ không?
          </p>
        `,
        cancelText: 'Đóng',
        confirmText: '➕ Tạo File Mới Ngay',
        confirmIcon: '',
        onConfirm: () => {
          openCreateLocalFsModal();
        },
      });
      return;
    }

    const getFileIcon = (fileName) => {
      const ext = fileName.split('.').pop().toLowerCase();
      if (['html', 'htm'].includes(ext)) return '🌐';
      if (['css', 'scss', 'sass'].includes(ext)) return '🎨';
      if (['js', 'jsx', 'mjs', 'ts', 'tsx'].includes(ext)) return '⚡';
      if (['py'].includes(ext)) return '🐍';
      if (['json'].includes(ext)) return '📋';
      if (['md', 'txt'].includes(ext)) return '📝';
      if (['png', 'jpg', 'jpeg', 'svg', 'gif'].includes(ext)) return '🖼️';
      return '📄';
    };

    const itemsHtml = files.map((filePath) => {
      const icon = getFileIcon(filePath);
      return `
        <div class="modal-file-item" data-filepath="${escapeHtml(filePath)}">
          <div class="modal-file-meta">
            <span class="modal-file-icon">${icon}</span>
            <div class="modal-file-details">
              <span class="modal-file-name" title="${escapeHtml(filePath)}">${escapeHtml(filePath)}</span>
              <span class="modal-file-size">File dự án máy tính</span>
            </div>
          </div>
          <div class="modal-file-actions">
            <button type="button" class="modal-action-btn" onclick="window.__openFileEditor('${escapeHtml(filePath)}')">
              ✏️ Sửa code
            </button>
            <button type="button" class="modal-action-btn btn-delete" title="Xóa file" onclick="window.__deleteProjectFile('${escapeHtml(filePath)}')">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join('');

    showModalConfirm({
      title: `Quản Lý Code Dự Án (${files.length} files)`,
      icon: '📁',
      contentHtml: `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-size: 0.85rem; color: #64748b;">
            Bấm <strong>"✏️ Sửa code"</strong> để chỉnh sửa trực tiếp vào ổ cứng:
          </span>
          <button type="button" style="padding: 5px 12px; font-size: 0.78rem; font-weight: 700; background: #059669; color: white; border: none; border-radius: 6px; cursor: pointer;" onclick="openCreateLocalFsModal()">
            ➕ Tạo File
          </button>
        </div>
        <div class="modal-file-list" id="modalProjectFileList">
          ${itemsHtml}
        </div>
      `,
      cancelText: 'Đóng',
      confirmText: '➕ Thêm File / Thư Mục',
      confirmIcon: '',
      onConfirm: () => {
        openCreateLocalFsModal();
      },
    });
  } catch (err) {
    showToast('Lỗi khi tải danh sách file: ' + err.message);
  }
}

async function openFileEditorModal(filePath) {
  showToast(`Đang mở file "${filePath}"...`);
  try {
    const res = await fetch(`/api/workspace/file?path=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Không thể đọc nội dung file');
    }

    const content = data.content || '';

    showModalConfirm({
      title: `✏️ Chỉnh Sửa File: ${filePath}`,
      icon: '📝',
      contentHtml: `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span style="font-size: 0.82rem; color: #64748b; font-family: monospace;">
            Đường dẫn: <strong>${escapeHtml(filePath)}</strong>
          </span>
          <button type="button" style="padding: 4px 10px; font-size: 0.76rem; font-weight: 700; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;" onclick="window.__askAiToModifyFile('${escapeHtml(filePath)}')">
            🤖 Nhờ AI sửa file này
          </button>
        </div>
        <textarea id="fileEditorTextarea" class="modal-code-editor-textarea" spellcheck="false">${escapeHtml(content)}</textarea>
        <div style="font-size: 0.76rem; color: #64748b; margin-top: 6px;">
          💡 Bạn có thể sửa trực tiếp code ở trên rồi bấm <strong>"💾 Lưu vào máy"</strong> để ghi thẳng vào ổ cứng.
        </div>
      `,
      cancelText: 'Hủy bỏ',
      confirmText: '💾 Lưu vào máy',
      confirmIcon: '',
      onConfirm: async () => {
        const updatedCode = document.getElementById('fileEditorTextarea')?.value ?? '';
        showToast(`Đang lưu mã nguồn vào file "${filePath}"...`);
        try {
          const saveRes = await fetch('/api/fs/create-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath, content: updatedCode }),
          });
          const saveData = await saveRes.json();
          if (!saveRes.ok || !saveData.success) {
            throw new Error(saveData.error || 'Lỗi khi lưu file');
          }

          showModalAlert({
            title: 'Lưu File Thành Công! 🎉',
            icon: '✅',
            contentHtml: `
              <p style="color: #059669; font-weight: 700; font-size: 1.05rem; margin-bottom: 8px;">
                🎉 Đã lưu và cập nhật mã nguồn thành công!
              </p>
              <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px; font-size: 0.85rem; color: #1e293b; word-break: break-all; font-family: monospace;">
                <strong>File:</strong> ${escapeHtml(saveData.path || filePath)}
              </div>
              <p style="color: #64748b; font-size: 0.88rem; margin: 10px 0 0; line-height: 1.5;">
                Dữ liệu và mã nguồn mới đã được lưu trực tiếp vào máy tính và đồng bộ cho AI!
              </p>
            `,
            confirmText: 'Tuyệt vời',
          });
        } catch (saveErr) {
          showModalAlert({
            title: 'Lỗi Lưu File',
            icon: '❌',
            message: saveErr.message || 'Không thể lưu file vào máy tính.',
          });
        }
      },
    });

    // Tab key indent support
    setTimeout(() => {
      const textarea = document.getElementById('fileEditorTextarea');
      if (textarea) {
        textarea.focus();
        textarea.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') {
            e.preventDefault();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
            textarea.selectionStart = textarea.selectionEnd = start + 2;
          }
        });
      }
    }, 100);
  } catch (err) {
    showToast(`Lỗi khi mở file: ${err.message}`);
  }
}

window.__openFileEditor = function(filePath) {
  openFileEditorModal(filePath);
};

window.__deleteProjectFile = function(filePath) {
  showModalConfirm({
    title: 'Xóa File Dự Án',
    icon: '🗑️',
    contentHtml: `
      <p style="color: #334155; font-size: 0.95rem; margin: 0 0 10px; line-height: 1.5;">
        Bạn có chắc muốn xóa file <strong>"${escapeHtml(filePath)}"</strong> khỏi máy tính không?
      </p>
    `,
    cancelText: 'Hủy bỏ',
    confirmText: 'Xóa ngay',
    confirmClass: 'modal-btn-danger',
    onConfirm: async () => {
      try {
        const res = await fetch(`/api/workspace/item?path=${encodeURIComponent(filePath)}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Lỗi khi xóa file');
        showToast(`Đã xóa file: ${filePath}`);
        setTimeout(openProjectExplorerModal, 300);
      } catch (e) {
        showToast('Lỗi khi xóa: ' + e.message);
      }
    },
  });
};

window.__askAiToModifyFile = function(filePath) {
  closeUniversalModal();
  messageInput.value = `Hãy đọc file \`${filePath}\` trong dự án và chỉnh sửa, nâng cấp theo yêu cầu sau: `;
  messageInput.focus();
  autoResizeTextarea();
  showToast(`Đã chọn file "${filePath}" để nhờ AI sửa code!`);
};

fileUploadHidden?.addEventListener('change', (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  e.target.value = '';

  const sampleFiles = files.slice(0, 4).map((f) => f.name).join(', ');
  const extra = files.length > 4 ? ` và ${files.length - 4} tệp khác...` : '';

  showModalConfirm({
    title: 'Nạp Tệp Tin Vào Dự Án',
    icon: '📄',
    contentHtml: `
      <div class="modal-form-group">
        <label class="modal-form-label">Danh sách tệp tin đã chọn</label>
        <div class="modal-highlight-box">
          <div style="font-weight: 700; color: #059669; font-size: 0.96rem;">
            ⚡ Đã chọn ${files.length} tệp mã nguồn
          </div>
          <div style="font-size: 0.8rem; color: #64748b; margin-top: 6px; word-break: break-word; line-height: 1.4;">
            ${escapeHtml(sampleFiles)}${extra}
          </div>
        </div>
      </div>
      <p style="font-size: 0.9rem; color: #475569; margin: 12px 0 0; line-height: 1.5;">
        Bạn có muốn nạp các tệp này vào dự án của AI để phân tích và hỗ trợ ngay không?
      </p>
    `,
    cancelText: 'Hủy bỏ',
    confirmText: '🚀 Nạp tệp ngay',
    confirmIcon: '',
    onConfirm: async () => {
      await handleBatchUpload(files, false);
    },
  });
});

// Image Upload Button & Hidden Input
imageUploadBtn?.addEventListener('click', () => {
  imageUploadHidden?.click();
});

imageUploadHidden?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) handleImageFile(file);
});

removeImageBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  clearAttachedImage();
});

// Paste Image from Clipboard (Ctrl+V) anywhere or in input
window.addEventListener('paste', (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        e.preventDefault();
        handleImageFile(file);
        showToast('Đã nhận ảnh từ bộ nhớ tạm (Clipboard)!');
        return;
      }
    }
  }
});

// Drag & Drop Image directly into Chat & Composer
['dragenter', 'dragover'].forEach((eventName) => {
  document.addEventListener(eventName, (e) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
      conversationContainer?.classList.add('drag-active');
    }
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  document.addEventListener(eventName, (e) => {
    if (e.type === 'dragleave' && e.relatedTarget !== null) return;
    conversationContainer?.classList.remove('drag-active');
  });
});

document.addEventListener('drop', (e) => {
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    const file = files[0];
    if (file.type && file.type.startsWith('image/')) {
      e.preventDefault();
      e.stopPropagation();
      conversationContainer?.classList.remove('drag-active');
      handleImageFile(file);
      showToast(`Đã nhận ảnh kéo thả: ${file.name}`);
    }
  }
});

// Close dropdown on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('.mode-selector')) {
    modeMenu?.classList.remove('show');
    modeSelectorBtn?.setAttribute('aria-expanded', 'false');
    providerMenu?.classList.remove('show');
    providerSelectorBtn?.setAttribute('aria-expanded', 'false');
  }
  if (!e.target.closest('.upload-dropdown-wrapper') && !e.target.closest('#attachBtn')) {
    uploadMenuDropdown?.classList.remove('show');
  }
});

// Sidebar Buttons
newChatBtn?.addEventListener('click', startNewChat);
clearAllBtn?.addEventListener('click', clearAllSessions);

// Mobile & Tablet Sidebar Toggle
function openMobileSidebar() {
  sidebar?.classList.add('open');
  sidebarOverlay?.classList.add('active');
}

function closeMobileSidebar() {
  sidebar?.classList.remove('open');
  sidebarOverlay?.classList.remove('active');
}

mobileMenuBtn?.addEventListener('click', openMobileSidebar);
sidebarToggleBtn?.addEventListener('click', closeMobileSidebar);
sidebarOverlay?.addEventListener('click', closeMobileSidebar);

// Fullscreen Toggle
fullscreenBtn?.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});

// Theme FX Toggle
themeFxBtn?.addEventListener('click', () => {
  isFxEnabled = !isFxEnabled;
  themeFxBtn.style.color = isFxEnabled ? 'var(--neon-cyan)' : 'var(--text-muted)';
  showToast(isFxEnabled ? 'Hiệu ứng VFX: BẬT' : 'Hiệu ứng VFX: TẮT');
});

// Voice input with a graceful browser support fallback.
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let speechRecognition = null;

if (SpeechRecognition && voiceBtn) {
  speechRecognition = new SpeechRecognition();
  speechRecognition.lang = 'vi-VN';
  speechRecognition.interimResults = true;
  speechRecognition.continuous = false;

  speechRecognition.onstart = () => {
    voiceBtn.classList.add('recording');
    voiceBtn.setAttribute('aria-pressed', 'true');
    voiceBtn.title = 'Dừng nhập giọng nói';
    showToast('Đang nghe... hãy nói yêu cầu của bạn');
  };

  speechRecognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0].transcript)
      .join('');
    messageInput.value = transcript;
    autoResizeTextarea();
  };

  speechRecognition.onerror = (event) => {
    if (event.error !== 'aborted') showToast('Không thể nhận diện giọng nói trên trình duyệt này.');
  };

  speechRecognition.onend = () => {
    voiceBtn.classList.remove('recording');
    voiceBtn.setAttribute('aria-pressed', 'false');
    voiceBtn.title = 'Nhập liệu bằng giọng nói';
  };

  voiceBtn.addEventListener('click', () => {
    if (voiceBtn.classList.contains('recording')) speechRecognition.stop();
    else speechRecognition.start();
  });
} else {
  voiceBtn?.addEventListener('click', () => {
    showToast('Trình duyệt này chưa hỗ trợ nhập liệu bằng giọng nói.');
  });
}

// Keep the status card honest about backend availability.
async function refreshCoreStatus() {
  if (!coreStatusLabel) return;
  if (isCreatorMode) {
    coreStatusLabel.innerHTML = `<span style="color:#ffd700; font-weight:bold;">👑 CHỦ NHÂN THỨC • ${currentProvider === 'thucthinking' ? 'THỨC THINKING 🧠' : 'THỨC GPT 👑'}</span>`;
    coreStatusLabel.closest('.core-status-card')?.classList.remove('offline');
    return;
  }
  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    if (!response.ok) throw new Error('health check failed');
    const data = await response.json();
    const provider = String(data.provider || '').toLowerCase();
    const providerLabel = PROVIDER_LABELS[provider] || 'AI CORE';
    coreStatusLabel.textContent = `${providerLabel} ONLINE`;
    coreStatusLabel.closest('.core-status-card')?.classList.remove('offline');
  } catch (error) {
    coreStatusLabel.textContent = 'CORE OFFLINE';
    coreStatusLabel.closest('.core-status-card')?.classList.add('offline');
  }
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    uploadMenuDropdown?.classList.remove('show');
    closeOverclockModal();
    closeMobileSidebar();
  }
});

// Turbo Boost Level Configs
const BOOST_LEVELS = {
  1: {
    tag: '1X',
    badge: 'PRO v3.7 • 1X',
    title: '⚡ CHẾ ĐỘ: TIÊU CHUẨN (1X)',
    desc: 'Cân bằng tốc độ và độ chính xác ổn định cho mọi tác vụ hàng ngày.',
    speed: '~14ms',
    speedBar: '25%',
    logic: 'Cấp độ 1 (Standard)',
    logicBar: '25%',
    precision: '90%',
    precisionBar: '30%',
    defense: 'Cơ bản (Standard)',
    defenseBar: '20%',
    toast: '⚡ Chế độ AI: Tiêu chuẩn (1X)',
  },
  2: {
    tag: '2X',
    badge: 'TURBO BOOST • 2X',
    title: '⚡ CHẾ ĐỘ: TĂNG TỐC PHẢN XẠ (2X)',
    desc: 'Tăng gấp đôi tốc độ suy nghĩ và khả năng xử lý nhanh các tác vụ logic.',
    speed: '~8ms',
    speedBar: '50%',
    logic: 'Cấp độ 2 (Quick Reasoning)',
    logicBar: '50%',
    precision: '94%',
    precisionBar: '50%',
    defense: 'Nâng cao (Lint & Check)',
    defenseBar: '45%',
    toast: '⚡ Chế độ AI: Tăng tốc phản xạ (2X)!',
  },
  3: {
    tag: '3X',
    badge: 'MASTER LOGIC • 3X',
    title: '🧠 CHẾ ĐỘ: CHUYÊN GIA LẬP TRÌNH (3X)',
    desc: 'Tối ưu hóa khả năng suy luận đa tầng, phân tích sâu kiến trúc code và thuật toán nâng cao.',
    speed: '~4ms',
    speedBar: '75%',
    logic: 'Cấp độ 3 (Deep Logic & Algorithms)',
    logicBar: '75%',
    precision: '97.5%',
    precisionBar: '75%',
    defense: 'Toàn diện (Automated Bug Scan)',
    defenseBar: '70%',
    toast: '🧠 Chế độ AI: Chuyên gia Lập trình (3X)!',
  },
  4: {
    tag: '4X',
    badge: 'HYPER OVERCLOCK • 4X',
    title: '🚀 CHẾ ĐỘ: ÉP XUNG SIÊU VIỆT (4X)',
    desc: 'Tư duy logic chuyên sâu, kiểm tra từng dòng mã, viết code chuẩn Production và tối ưu hiệu năng.',
    speed: '~2ms',
    speedBar: '90%',
    logic: 'Cấp độ 4 (High Precision & System Design)',
    logicBar: '90%',
    precision: '99%',
    precisionBar: '90%',
    defense: 'Chuyên sâu (Zero-Defect Synthesis)',
    defenseBar: '90%',
    toast: '🚀 Chế độ AI: Ép xung Siêu việt (4X)!',
  },
  5: {
    tag: '5X 🔥',
    badge: '🔥 QUANTUM SINGULARITY • 5X MAX',
    title: '🔥 CHẾ ĐỘ: QUANTUM TỐI THƯỢNG (5X MAX)',
    desc: 'Khai mở 100% tiềm năng AI: Siêu logic, tư duy kiến trúc toàn năng, phân tích bảo mật và viết code đỉnh cao không tì vết!',
    speed: '⚡ 0.8ms Instant',
    speedBar: '100%',
    logic: 'Cấp độ 5 (Singularity Super Intelligence)',
    logicBar: '100%',
    precision: '99.9% Hyper-Accurate',
    precisionBar: '100%',
    defense: 'Tối thượng (Self-Healing & Auto-Refactor)',
    defenseBar: '100%',
    toast: '🔥 ĐÃ KÍCH HOẠT ÉP XUNG TỐI THƯỢNG (5X QUANTUM MAX)!',
  },
};

function applyBoostLevel(level, showNotification = false) {
  level = Math.max(1, Math.min(5, parseInt(level, 10) || 1));
  currentBoostLevel = level;
  localStorage.setItem(STORAGE_KEY_BOOST_LEVEL, level.toString());

  const config = BOOST_LEVELS[level] || BOOST_LEVELS[1];

  // Update Header Badges
  if (boostTagMini) boostTagMini.textContent = config.tag;
  if (aiModeBadge) aiModeBadge.textContent = config.badge;

  if (turboBoostBtn) {
    if (level === 5) {
      turboBoostBtn.classList.add('level-5');
    } else {
      turboBoostBtn.classList.remove('level-5');
    }
  }

  // Update Modal Elements
  if (sliderCurrentVal) sliderCurrentVal.textContent = config.tag;
  if (overclockSlider) overclockSlider.value = level;
  if (statusBadgeLevel) statusBadgeLevel.textContent = config.title;
  if (statusDescText) statusDescText.textContent = config.desc;

  if (metricSpeed) metricSpeed.textContent = config.speed;
  if (metricLogic) metricLogic.textContent = config.logic;
  if (metricPrecision) metricPrecision.textContent = config.precision;
  if (metricDefense) metricDefense.textContent = config.defense;

  if (barSpeed) barSpeed.style.width = config.speedBar;
  if (barLogic) barLogic.style.width = config.logicBar;
  if (barPrecision) barPrecision.style.width = config.precisionBar;
  if (barDefense) barDefense.style.width = config.defenseBar;

  // Highlight active slider tick
  document.querySelectorAll('.slider-ticks .tick').forEach((tick) => {
    const tickLevel = parseInt(tick.getAttribute('data-level'), 10);
    if (tickLevel === level) tick.classList.add('active');
    else tick.classList.remove('active');
  });

  if (showNotification) {
    showToast(config.toast);
  }
}

// Modal Handlers
function openOverclockModal() {
  applyBoostLevel(currentBoostLevel);
  applyMode(currentMode);
  turboOverclockModal?.classList.add('open');
}

function closeOverclockModal() {
  turboOverclockModal?.classList.remove('open');
}

turboBoostBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  openOverclockModal();
});

quickOverclockBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  openOverclockModal();
});

closeOverclockModalBtn?.addEventListener('click', closeOverclockModal);

turboOverclockModal?.addEventListener('click', (e) => {
  if (e.target === turboOverclockModal) {
    closeOverclockModal();
  }
});

overclockSlider?.addEventListener('input', (e) => {
  applyBoostLevel(e.target.value);
});

// Click on Slider Ticks
document.querySelectorAll('.slider-ticks .tick').forEach((tick) => {
  tick.addEventListener('click', () => {
    const level = tick.getAttribute('data-level');
    if (level) applyBoostLevel(level);
  });
});

// Click on Presets
document.querySelectorAll('.presets-buttons .preset-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const level = btn.getAttribute('data-set-level');
    if (level) {
      applyBoostLevel(level);
      showToast(`Đã chọn: ${BOOST_LEVELS[level]?.title}`);
    }
  });
});

applyOverclockBtn?.addEventListener('click', () => {
  closeOverclockModal();
  showToast(`⚡ ĐÃ ÁP DỤNG MỨC ÉP XUNG ${BOOST_LEVELS[currentBoostLevel]?.tag}! AI ĐÃ SẴN SÀNG.`);
});

// Initial Bootstrap on Load
window.addEventListener('DOMContentLoaded', async () => {
  await loadSessionsFromServer();
  const sessions = getAllSessions();
  const lastActiveId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);

  // Apply saved Boost level
  applyBoostLevel(currentBoostLevel);
  applyProvider(currentProvider);
  refreshCoreStatus();

  if (lastActiveId && sessions.some((s) => s.id === lastActiveId)) {
    loadSession(lastActiveId);
  } else if (sessions.length > 0) {
    loadSession(sessions[0].id);
  } else {
    startNewChat();
  }
});

/* ==========================================================================
   CLAUDE-STYLE ARTIFACTS RUNNER CONTROLLER
   ========================================================================== */
let activeArtifactCode = '';
let activeArtifactFilename = 'index.html';

window.runArtifactPreview = function (codeTextBase64, filenameOrLang = '') {
  let rawCode = '';
  try {
    rawCode = decodeURIComponent(escape(atob(codeTextBase64)));
  } catch (e) {
    try {
      rawCode = atob(codeTextBase64);
    } catch (e2) {
      rawCode = codeTextBase64;
    }
  }

  activeArtifactCode = rawCode;
  activeArtifactFilename = filenameOrLang || 'index.html';

  const modal = document.getElementById('artifactModal');
  const iframe = document.getElementById('artifactIframe');
  const codeViewer = document.getElementById('artifactCodeViewer');
  const consoleContainer = document.getElementById('artifactConsoleLogs');
  const consoleCount = document.getElementById('consoleCount');
  const titleEl = document.getElementById('artifactTitle');
  const subtitleEl = document.getElementById('artifactSubtitle');

  if (!modal || !iframe) return;

  if (titleEl) titleEl.textContent = activeArtifactFilename ? `ARTIFACT: ${activeArtifactFilename.toUpperCase()}` : 'CLAUDE ARTIFACTS LIVE RUNNER';
  if (subtitleEl) subtitleEl.textContent = 'Interactive Live Preview & Code Sandbox';
  if (codeViewer) codeViewer.textContent = rawCode;
  if (consoleContainer) consoleContainer.innerHTML = '<div class="log-line log-info">[Hệ thống] Sandbox đã khởi động. Mọi kết quả console.log() sẽ hiển thị tại đây.</div>';
  if (consoleCount) consoleCount.textContent = '0';

  // Set Default Tab to Preview
  document.getElementById('tabPreviewBtn')?.classList.add('active');
  document.getElementById('tabCodeBtn')?.classList.remove('active');
  document.getElementById('tabConsoleBtn')?.classList.remove('active');
  document.getElementById('artifactPreviewPane')?.classList.add('active');
  document.getElementById('artifactCodePane')?.classList.remove('active');
  document.getElementById('artifactConsolePane')?.classList.remove('active');

  modal.style.display = 'flex';

  // Console Interceptor script injected into iframe
  const consoleInterceptor = `
<script>
  (function() {
    const _log = console.log, _info = console.info, _warn = console.warn, _error = console.error;
    function send(level, args) {
      try {
        const text = Array.from(args).map(arg => {
          if (arg === null) return 'null';
          if (arg === undefined) return 'undefined';
          if (typeof arg === 'object') {
            try { return JSON.stringify(arg, null, 2); } catch(e) { return String(arg); }
          }
          return String(arg);
        }).join(' ');
        window.parent.postMessage({ type: 'ARTIFACT_LOG', level: level, text: text }, '*');
      } catch (err) {}
    }
    console.log = function() { send('log', arguments); _log.apply(console, arguments); };
    console.info = function() { send('info', arguments); _info.apply(console, arguments); };
    console.warn = function() { send('warn', arguments); _warn.apply(console, arguments); };
    console.error = function() { send('error', arguments); _error.apply(console, arguments); };
    window.onerror = function(msg, url, lineNo, columnNo, error) {
      send('error', ['Lỗi cú pháp / runtime: ' + msg + ' (dòng ' + lineNo + ')']);
    };
  })();
<\/script>
`;

  const isHtml = /<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]|<script[\s>]|<style[\s>]|<div[\s>]/i.test(rawCode);

  let fullHtml = '';
  if (isHtml) {
    if (rawCode.includes('<head>')) {
      fullHtml = rawCode.replace('<head>', '<head>' + consoleInterceptor);
    } else if (rawCode.includes('<html>')) {
      fullHtml = rawCode.replace('<html>', '<html><head>' + consoleInterceptor + '</head>');
    } else {
      fullHtml = `<!DOCTYPE html><html><head>${consoleInterceptor}</head><body>${rawCode}</body></html>`;
    }
  } else {
    // Wrap JS/Script in an interactive runner page
    fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Script Artifact Output</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #090e17; color: #f1f5f9; padding: 24px; margin: 0; }
    .card { background: #0f172a; border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 12px; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    h2 { margin-top: 0; color: #00f0ff; font-size: 1.1rem; display: flex; align-items: center; gap: 8px; }
    #consoleOutput { font-family: monospace; background: #020617; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; min-height: 120px; max-height: 400px; overflow-y: auto; white-space: pre-wrap; font-size: 0.9rem; }
    .log-item { padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
  </style>
  ${consoleInterceptor}
</head>
<body>
  <div class="card">
    <h2>⚡ Script Artifact Live Output</h2>
    <div id="consoleOutput"></div>
  </div>
  <script>
    const _out = document.getElementById('consoleOutput');
    const _origLog = console.log;
    console.log = function(...args) {
      if (_out) {
        const p = document.createElement('div');
        p.className = 'log-item';
        p.textContent = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
        _out.appendChild(p);
      }
      _origLog.apply(console, args);
    };
    try {
      ${rawCode}
    } catch(e) {
      console.error(e.message);
      if (_out) {
        const p = document.createElement('div');
        p.className = 'log-item';
        p.style.color = '#ef4444';
        p.textContent = 'Lỗi thực thi: ' + e.message;
        _out.appendChild(p);
      }
    }
  <\/script>
</body>
</html>`;
  }

  iframe.srcdoc = fullHtml;
  showToast('⚡ Đã mở Claude Artifact Sandbox!');
};

window.runCodeFromButton = function (btn, codeTextBase64, filenameOrLang = '') {
  window.runArtifactPreview(codeTextBase64, filenameOrLang);
};

// Intercept messages from sandbox iframe
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'ARTIFACT_LOG') {
    const consoleContainer = document.getElementById('artifactConsoleLogs');
    const consoleCount = document.getElementById('consoleCount');
    if (!consoleContainer) return;

    const div = document.createElement('div');
    div.className = `log-line log-${event.data.level || 'log'}`;
    div.textContent = `[${String(event.data.level || 'LOG').toUpperCase()}] ${event.data.text}`;
    consoleContainer.appendChild(div);
    consoleContainer.scrollTop = consoleContainer.scrollHeight;

    if (consoleCount) {
      const current = parseInt(consoleCount.textContent || '0', 10);
      consoleCount.textContent = String(current + 1);
    }
  }
});

// Artifact Modal Tabs & Action Handlers
document.getElementById('closeArtifactBtn')?.addEventListener('click', () => {
  const modal = document.getElementById('artifactModal');
  const iframe = document.getElementById('artifactIframe');
  if (modal) modal.style.display = 'none';
  if (iframe) iframe.srcdoc = '';
});

document.getElementById('tabPreviewBtn')?.addEventListener('click', () => {
  document.getElementById('tabPreviewBtn')?.classList.add('active');
  document.getElementById('tabCodeBtn')?.classList.remove('active');
  document.getElementById('tabConsoleBtn')?.classList.remove('active');
  document.getElementById('artifactPreviewPane')?.classList.add('active');
  document.getElementById('artifactCodePane')?.classList.remove('active');
  document.getElementById('artifactConsolePane')?.classList.remove('active');
});

document.getElementById('tabCodeBtn')?.addEventListener('click', () => {
  document.getElementById('tabCodeBtn')?.classList.add('active');
  document.getElementById('tabPreviewBtn')?.classList.remove('active');
  document.getElementById('tabConsoleBtn')?.classList.remove('active');
  document.getElementById('artifactCodePane')?.classList.add('active');
  document.getElementById('artifactPreviewPane')?.classList.remove('active');
  document.getElementById('artifactConsolePane')?.classList.remove('active');
});

document.getElementById('tabConsoleBtn')?.addEventListener('click', () => {
  document.getElementById('tabConsoleBtn')?.classList.add('active');
  document.getElementById('tabPreviewBtn')?.classList.remove('active');
  document.getElementById('tabCodeBtn')?.classList.remove('active');
  document.getElementById('artifactConsolePane')?.classList.add('active');
  document.getElementById('artifactPreviewPane')?.classList.remove('active');
  document.getElementById('artifactCodePane')?.classList.remove('active');
});

document.getElementById('clearConsoleBtn')?.addEventListener('click', () => {
  const consoleContainer = document.getElementById('artifactConsoleLogs');
  const consoleCount = document.getElementById('consoleCount');
  if (consoleContainer) consoleContainer.innerHTML = '';
  if (consoleCount) consoleCount.textContent = '0';
});

document.getElementById('reloadArtifactBtn')?.addEventListener('click', () => {
  if (activeArtifactCode) {
    const encoded = btoa(unescape(encodeURIComponent(activeArtifactCode)));
    window.runArtifactPreview(encoded, activeArtifactFilename);
  }
});

document.getElementById('openNewTabArtifactBtn')?.addEventListener('click', () => {
  if (activeArtifactCode) {
    const blob = new Blob([activeArtifactCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }
});

document.getElementById('saveToWorkspaceBtn')?.addEventListener('click', async () => {
  if (!activeArtifactCode) return;
  const path = activeArtifactFilename && activeArtifactFilename.includes('.') ? activeArtifactFilename : 'index.html';
  try {
    const res = await fetch('/api/workspace/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content: activeArtifactCode }),
    });
    if (res.ok) {
      showToast(`Đã lưu thành công vào workspace/${path}!`);
    } else {
      const err = await res.json();
      showToast(`Lỗi lưu: ${err.error || 'Thất bại'}`);
    }
  } catch (e) {
    showToast(`Không thể lưu: ${e.message}`);
  }
});



