const crypto = require('crypto');

const CHAT_FIELDS = new Set([
  'message',
  'history',
  'boostLevel',
  'mode',
  'provider',
  'image',
  'images',
]);
const CHAT_PROVIDERS = new Set([
  'deepseek',
  'ollama',
  'groq',
  'openai',
  'gemini',
  'thucgpt',
  'thucthinking',
]);
const IMAGE_MIME_TYPES = new Set(['image/gif', 'image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BASE64_LENGTH = 36 * 1024 * 1024;

function constantTimeEqual(left, right) {
  const leftHash = crypto.createHash('sha256').update(String(left ?? '')).digest();
  const rightHash = crypto.createHash('sha256').update(String(right ?? '')).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function isValidBase64Image(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_IMAGE_BASE64_LENGTH
    && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

function isValidImagePayload(image) {
  if (typeof image === 'string') {
    const match = image.match(/^data:(image\/(?:gif|jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
    return Boolean(match && isValidBase64Image(match[2]));
  }
  if (!image || typeof image !== 'object' || Array.isArray(image)) return false;

  const dataUrl = typeof image.dataUrl === 'string' ? image.dataUrl : '';
  const dataUrlMatch = dataUrl.match(/^data:(image\/(?:gif|jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  const data = image.data ?? image.base64 ?? dataUrlMatch?.[2];
  const mimeType = image.mimeType || dataUrlMatch?.[1];

  if (!IMAGE_MIME_TYPES.has(mimeType)) return false;
  if (dataUrl) {
    const match = dataUrl.match(/^data:(image\/(?:gif|jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match || match[1] !== mimeType || !isValidBase64Image(match[2])) return false;
  }
  return isValidBase64Image(data);
}

function validateChatPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Chat request must be a JSON object.';
  }
  if (Object.keys(body).some((key) => !CHAT_FIELDS.has(key))) {
    return 'Chat request contains unsupported fields.';
  }
  if (body.message !== undefined && (typeof body.message !== 'string' || body.message.length > 20000)) {
    return 'Message must be a string of at most 20000 characters.';
  }
  if (body.history !== undefined) {
    if (!Array.isArray(body.history) || body.history.length > 20) {
      return 'History must contain at most 20 messages.';
    }
    if (body.history.some((entry) => !entry
      || typeof entry !== 'object'
      || Array.isArray(entry)
      || Object.keys(entry).some((key) => !['role', 'content'].includes(key))
      || !['user', 'assistant'].includes(entry.role)
      || typeof entry.content !== 'string'
      || entry.content.length > 20000)) {
      return 'History contains an invalid message.';
    }
  }
  if (body.boostLevel !== undefined && (!Number.isInteger(body.boostLevel) || body.boostLevel < 1 || body.boostLevel > 5)) {
    return 'Boost level must be an integer from 1 to 5.';
  }
  if (body.mode !== undefined && !['code', 'assistant'].includes(body.mode)) {
    return 'Mode is invalid.';
  }
  if (body.provider !== undefined && (typeof body.provider !== 'string' || !CHAT_PROVIDERS.has(body.provider.toLowerCase()))) {
    return 'Provider is invalid.';
  }
  if (body.image != null && !isValidImagePayload(body.image)) {
    return 'Image payload is invalid.';
  }
  if (body.images !== undefined && (!Array.isArray(body.images)
    || body.images.length > 10
    || body.images.some((image) => !isValidImagePayload(image)))) {
    return 'Image list is invalid.';
  }
  return null;
}

function createAiQuotaMiddleware({
  maxRequests = 5,
  maxConcurrent = 1,
  windowMs = 60 * 1000,
} = {}) {
  const usage = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [userId, entry] of usage) {
      entry.requests = entry.requests.filter((timestamp) => now - timestamp < windowMs);
      if (entry.requests.length === 0 && entry.active === 0) usage.delete(userId);
    }
  }, Math.max(windowMs, 60 * 1000));
  cleanup.unref();

  return (req, res, next) => {
    const userId = String(req.user?.id || 'creator');
    const now = Date.now();
    let entry = usage.get(userId);
    if (!entry) {
      entry = { requests: [], active: 0 };
      usage.set(userId, entry);
    }
    entry.requests = entry.requests.filter((timestamp) => now - timestamp < windowMs);

    const reason = entry.active >= maxConcurrent
      ? 'concurrency'
      : entry.requests.length >= maxRequests
        ? 'rate'
        : null;
    if (reason) {
      const retryAfter = reason === 'concurrency'
        ? 1
        : Math.max(1, Math.ceil((entry.requests[0] + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      console.warn(JSON.stringify({
        event: 'ai_quota_exceeded',
        userId,
        path: req.path,
        reason,
      }));
      return res.status(429).json({
        success: false,
        error: reason === 'concurrency'
          ? 'An AI request is already running for this account.'
          : 'AI request limit reached. Please try again later.',
      });
    }

    entry.requests.push(now);
    entry.active += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      entry.active = Math.max(0, entry.active - 1);
    };
    res.once('finish', release);
    res.once('close', release);
    next();
  };
}

module.exports = {
  constantTimeEqual,
  createAiQuotaMiddleware,
  validateChatPayload,
};
