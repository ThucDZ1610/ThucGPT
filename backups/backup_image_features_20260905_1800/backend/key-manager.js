const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Danh sách các đường dẫn lưu trữ key trên toàn máy tính (để dù key.js ở đâu cũng đọc được)
function getStorageFiles() {
  const list = [];
  // 1. Thư mục backend của AI Turbo Pro
  list.push(path.join(__dirname, 'temp-keys.json'));
  // 2. Thư mục Universal Profile của người dùng Windows
  const userHome = process.env.USERPROFILE || process.env.HOME || '';
  if (userHome) {
    list.push(path.join(userHome, '.ai_turbo_pro', 'temp-keys.json'));
  }
  // 3. Đường dẫn mặc định C:\AI_Turbo_Pro\backend\temp-keys.json
  list.push('C:\\AI_Turbo_Pro\\backend\\temp-keys.json');
  return [...new Set(list)];
}

/**
 * Đọc tất cả key từ các vị trí lưu trữ
 */
function readKeysData() {
  const mergedMap = new Map();
  for (const filePath of getStorageFiles()) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.keys)) {
          for (const item of data.keys) {
            if (item && item.key) {
              mergedMap.set(item.key.toUpperCase(), item);
            }
          }
        }
      }
    } catch (e) {}
  }
  return { keys: Array.from(mergedMap.values()) };
}

/**
 * Ghi danh sách key vào các vị trí lưu trữ
 */
function writeKeysData(data) {
  for (const filePath of getStorageFiles()) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {}
  }
  return true;
}

/**
 * Dọn dẹp key hết hạn
 */
function cleanupExpiredKeys() {
  const data = readKeysData();
  const now = Date.now();
  const validKeys = data.keys.filter((item) => item.expiresAt > now);
  if (validKeys.length !== data.keys.length) {
    writeKeysData({ keys: validKeys });
  }
  return validKeys;
}

/**
 * Tạo mã Bypass ngẫu nhiên
 */
function generateRandomCode() {
  const bytes = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `BYPASS-${bytes.slice(0, 4)}-${bytes.slice(4, 8)}-${bytes.slice(8, 12)}`;
}

/**
 * Tạo mã Bypass mới với thời hạn
 */
function generateBypassKey(durationMinutes = 30, label = 'Tạo qua CLI/Hệ thống') {
  cleanupExpiredKeys();
  const minutes = Math.max(1, parseInt(durationMinutes, 10) || 30);
  const now = Date.now();
  const expiresAt = now + minutes * 60 * 1000;
  const key = generateRandomCode();

  const keyEntry = {
    key,
    createdAt: now,
    expiresAt,
    durationMinutes: minutes,
    createdStr: new Date(now).toLocaleString('vi-VN'),
    expiresStr: new Date(expiresAt).toLocaleString('vi-VN'),
    label,
    active: true,
  };

  const data = readKeysData();
  data.keys.push(keyEntry);
  writeKeysData(data);

  return keyEntry;
}

/**
 * Kiểm tra tính hợp lệ của mã Bypass
 */
function validateBypassKey(inputKey = '') {
  if (!inputKey || typeof inputKey !== 'string') {
    return { valid: false, reason: 'Mã không hợp lệ' };
  }

  const cleanKey = inputKey.trim().toUpperCase();
  const data = readKeysData();
  const now = Date.now();

  const found = data.keys.find((k) => k.key.toUpperCase() === cleanKey);

  if (!found) {
    return { valid: false, notFound: true, reason: 'Mã không tồn tại' };
  }

  if (now > found.expiresAt) {
    cleanupExpiredKeys();
    return {
      valid: false,
      expired: true,
      key: found.key,
      expiredAt: found.expiresStr,
      reason: 'Mã Bypass tạm thời này đã hết hạn hiệu lực!',
    };
  }

  const remainingMs = found.expiresAt - now;
  const remainingMinutes = Math.floor(remainingMs / 60000);
  const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);

  return {
    valid: true,
    key: found.key,
    remainingMinutes,
    remainingSeconds,
    remainingFormatted: `${remainingMinutes} phút ${remainingSeconds} giây`,
    expiresStr: found.expiresStr,
    label: found.label,
  };
}

function getActiveKeys() {
  return cleanupExpiredKeys();
}

function revokeKey(targetKey = '') {
  const cleanKey = String(targetKey).trim().toUpperCase();
  const data = readKeysData();
  const initialCount = data.keys.length;
  data.keys = data.keys.filter((k) => k.key.toUpperCase() !== cleanKey);
  if (data.keys.length !== initialCount) {
    writeKeysData(data);
    return true;
  }
  return false;
}

module.exports = {
  generateBypassKey,
  validateBypassKey,
  getActiveKeys,
  revokeKey,
  cleanupExpiredKeys,
};
