/**
 * ==============================================================================
 * AI TURBO PRO - BỘ TẠO VÀ QUẢN LÝ MÃ BYPASS TẠM THỜI (TEMPORARY BYPASS KEYS)
 * ==============================================================================
 * File: key.js
 * Chức năng: Tạo mã Bypass tạm thời có hiệu lực trong 60 phút (hoặc tùy chỉnh).
 * Sử dụng:
 *   - Chạy lệnh: `node key.js` (Tạo mã mới có hiệu lực 60 phút)
 *   - Chạy lệnh: `node key.js list` (Xem danh sách các mã đang hoạt động)
 *   - Chạy lệnh: `node key.js <số_phút>` (Tạo mã với thời lượng tùy chọn)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Danh sách các đường dẫn lưu trữ key trên máy tính (hỗ trợ chạy độc lập ở bất kỳ thư mục nào)
function getStorageFiles() {
  const list = [];
  // 1. Nếu key.js đặt trong thư mục gốc AI_Turbo_Pro
  list.push(path.join(__dirname, 'backend', 'temp-keys.json'));
  // 2. Thư mục cài đặt AI_Turbo_Pro cố định trên máy tính
  list.push('C:\\AI_Turbo_Pro\\backend\\temp-keys.json');
  // 3. Thư mục Universal Profile của người dùng Windows
  const userHome = process.env.USERPROFILE || process.env.HOME || '';
  if (userHome) {
    list.push(path.join(userHome, '.ai_turbo_pro', 'temp-keys.json'));
  }
  // 4. Thư mục cục bộ cùng cấp với file key.js nếu đem sang máy khác
  list.push(path.join(__dirname, 'temp-keys.json'));
  return [...new Set(list)];
}

/**
 * Đọc danh sách key từ các file lưu trữ
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
 * Ghi danh sách key vào tất cả các vị trí lưu trữ để AI Turbo Pro luôn nhận diện được
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
 * Dọn dẹp các key đã hết hạn
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
 * Tạo một mã Bypass ngẫu nhiên (dạng: KEYAIPRO-XXXX-XXXX-XXXX)
 */
function generateRandomCode() {
  const bytes = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `KEYAIPRO-${bytes.slice(0, 4)}-${bytes.slice(4, 8)}-${bytes.slice(8, 12)}`;
}

/**
 * Tạo mã Bypass mới với thời hạn (mặc định 60 phút)
 * @param {number} durationMinutes - Số phút hiệu lực (mặc định 60)
 * @param {string} label - Ghi chú tùy chọn
 */
function generateBypassKey(durationMinutes = 60, label = 'Tạo qua CLI/Hệ thống') {
  cleanupExpiredKeys();
  const minutes = Math.max(1, parseInt(durationMinutes, 10) || 60);
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
 * Kiểm tra tính hợp lệ của một mã Bypass
 * @param {string} inputKey - Mã cần kiểm tra
 */
function validateBypassKey(inputKey = '') {
  if (!inputKey || typeof inputKey !== 'string') {
    return { valid: false, reason: 'Mã không hợp lệ' };
  }

  const cleanKey = inputKey.trim().toUpperCase();
  const data = readKeysData();
  const now = Date.now();

  const found = data.keys.find((k) => {
    const kUpper = k.key.toUpperCase();
    if (kUpper === cleanKey) return true;
    const rawSuffix = kUpper.replace(/^(KEYAIPRO|BYPASS)-/, '');
    const inputSuffix = cleanKey.replace(/^(KEYAIPRO|BYPASS)-/, '');
    return rawSuffix === inputSuffix;
  });

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
      reason: 'Mã Bypass tạm thời này đã hết hạn hiệu lực (60 phút)! Vui lòng liên hệ tạo mã mới.',
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

/**
 * Lấy danh sách các key còn hiệu lực
 */
function getActiveKeys() {
  return cleanupExpiredKeys();
}

/**
 * Thu hồi một key trước hạn
 */
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

// ==============================================================================
// GIAO DIỆN DÒNG LỆNH (CLI MODE) - Khi chạy trực tiếp: `node key.js`
// ==============================================================================
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = (args[0] || '').toLowerCase();

  // Trường hợp 1: Xem danh sách key đang còn hiệu lực
  if (command === 'list' || command === 'ls') {
    const active = getActiveKeys();
    console.log('\n==================================================================');
    console.log('       📋 DANH SÁCH MÃ BYPASS ĐANG CÒN HIỆU LỰC (AI TURBO PRO)');
    console.log('==================================================================');
    if (active.length === 0) {
      console.log(' Hiện tại không có mã Bypass nào đang hoạt động.');
      console.log(' 👉 Gõ: `node key.js` để tạo mã mới có hiệu lực 60 phút.\n');
    } else {
      active.forEach((item, idx) => {
        const check = validateBypassKey(item.key);
        console.log(`\n [${idx + 1}] Khóa: \x1b[32m\x1b[1m${item.key}\x1b[0m`);
        console.log(`     ⏳ Thời gian còn lại: \x1b[33m${check.remainingFormatted}\x1b[0m`);
        console.log(`     ⏰ Hết hạn lúc      : ${item.expiresStr}`);
        console.log(`     🏷️  Ghi chú          : ${item.label}`);
      });
      console.log('\n==================================================================\n');
    }
    process.exit(0);
  }

  // Trường hợp 2: Hủy một key
  if (command === 'revoke' || command === 'del' || command === 'rm') {
    const keyToRevoke = args[1];
    if (!keyToRevoke) {
      console.log('\n❌ Vui lòng nhập mã cần hủy: `node key.js revoke <mã_key>`\n');
      process.exit(1);
    }
    const success = revokeKey(keyToRevoke);
    if (success) {
      console.log(`\n✅ Đã hủy thành công mã Bypass: ${keyToRevoke}\n`);
    } else {
      console.log(`\n⚠️ Không tìm thấy mã: ${keyToRevoke}\n`);
    }
    process.exit(0);
  }

  // Trường hợp 3: Tạo mã mới (Mặc định 60 phút, hoặc nhận số phút từ tham số)
  let minutes = 60;
  if (!isNaN(parseInt(command, 10)) && parseInt(command, 10) > 0) {
    minutes = parseInt(command, 10);
  }

  const keyData = generateBypassKey(minutes, 'Tạo từ dòng lệnh CLI');

  const boxWidth = 72;
  const ansiPattern = /\x1b\[[0-?]*[ -\/]*[@-~]/g;
  const getDisplayWidth = (value) => {
    let width = 0;
    for (const char of value.replace(ansiPattern, '')) {
      const codePoint = char.codePointAt(0);
      if (/[\u0300-\u036f\ufe00-\ufe0f]/.test(char)) continue;
      width += codePoint >= 0x1f000 || (codePoint >= 0x2600 && codePoint <= 0x27ff) ? 2 : 1;
    }
    return width;
  };
  const fitBoxContent = (content) => {
    let fitted = '';
    for (const char of content) {
      if (getDisplayWidth(fitted + char) > boxWidth) break;
      fitted += char;
    }
    return fitted;
  };
  const boxLine = (content) => {
    const fitted = fitBoxContent(content);
    return `║${fitted}${' '.repeat(boxWidth - getDisplayWidth(fitted))}║`;
  };
  const boxBorder = (left, fill, right) => `${left}${fill.repeat(boxWidth)}${right}`;

  console.log('\n');
  console.log(boxBorder('╔', '═', '╗'));
  console.log(boxLine('       ⚡ AI TURBO PRO // BỘ TẠO MÃ KEYAIPRO TẠM THỜI ⚡'));
  console.log(boxBorder('╠', '═', '╣'));
  console.log(boxLine(`  🔑 MÃ KEYAIPRO MỚI: \x1b[32m\x1b[1m${keyData.key}\x1b[0m`));
  console.log(boxLine(`  ⏳ THỜI LƯỢNG     : \x1b[33m${keyData.durationMinutes} phút\x1b[0m`));
  console.log(boxLine(`  🕒 THỜI ĐIỂM TẠO  : ${keyData.createdStr}`));
  console.log(boxLine(`  ⏰ HẾT HẠN LÚC    : \x1b[31m\x1b[1m${keyData.expiresStr}\x1b[0m`));
  console.log(boxLine('  🛡️  TRẠNG THÁI     : \x1b[32mKÍCH HOẠT THÀNH CÔNG (100% BYPASS)\x1b[0m'));
  console.log(boxBorder('╠', '═', '╣'));
  console.log(boxLine('  👉 HƯỚNG DẪN SỬ DỤNG:'));
  console.log(boxLine('  1. Gửi mã này cho người dùng / người test.'));
  console.log(boxLine('  2. Người dùng chỉ cần nhập mã này vào khung chat gửi đi,'));
  console.log(boxLine('     hoặc gõ kèm trong câu lệnh (Ví dụ: ' + keyData.key.slice(0, 15) + '... code)'));
  console.log(boxLine('  3. Mã sẽ tự động hết hạn sau đúng ' + keyData.durationMinutes + ' phút!'));
  console.log(boxBorder('╚', '═', '╝'));
  console.log('\n');
}

module.exports = {
  generateBypassKey,
  validateBypassKey,
  getActiveKeys,
  revokeKey,
  cleanupExpiredKeys,
};
