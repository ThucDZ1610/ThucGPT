/**
 * AI TURBO PRO • ANTI-REQUEST & RATE LIMITING DEFENSE SYSTEM (AntiReq)
 * - Chống spam request (Anti-Spam / Anti-Flood / Anti-DDoS)
 * - Chống vét cạn hạn ngạch Gmail OTP (Anti-OTP Spam)
 * - Chống dò mật khẩu (Anti-Brute Force)
 * - Tự động đưa IP spam vào danh sách tạm giam (IP Jail / Temporary Ban)
 * - Tối ưu cho cả Localhost và Môi trường Web Hosting (Cloudflare, Render, VPS, Nginx)
 */

const fs = require('fs');
const path = require('path');

// Storage for request counters and IP jail
const requestStore = new Map(); // key: `${ip}:${tier}` -> { count, startTime, violations }
const ipJail = new Map();       // key: ip -> banUntilTimestamp

// Configuration Options
const CONFIG = {
  // 1. TIER BẢO VỆ XÁC THỰC & OTP (Ngăn chặn spam mã Gmail & Brute-force mật khẩu)
  AUTH: {
    windowMs: 60 * 1000,    // 1 phút
    max: 12,                // Tối đa 12 requests / phút
    name: 'AUTH_PROTECTION'
  },

  // 2. TIER BẢO VỆ AI & TẠO ẢNH (Ngăn chặn bot spam gọi AI liên tục gây sập server)
  AI: {
    windowMs: 60 * 1000,    // 1 phút
    max: 35,                // Tối đa 35 requests / phút
    name: 'AI_RATE_LIMIT'
  },

  // 3. TIER TOÀN CỤC CHO API (Chống flood request trên các API khác)
  GLOBAL: {
    windowMs: 60 * 1000,    // 1 phút
    max: 150,               // Tối đa 150 requests / phút
    name: 'GLOBAL_RATE_LIMIT'
  },

  // 4. CẤU HÌNH TẠM GIAM IP (IP JAIL)
  JAIL: {
    maxViolations: 5,       // Vi phạm quá giới hạn 5 lần liên tiếp sẽ bị cấm
    durationMs: 15 * 60 * 1000 // Tạm cấm 15 phút
  }
};

// Hàm trích xuất IP chính xác qua các tầng Proxy / Cloudflare / Nginx
function getClientIp(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : null) ||
    req.socket?.remoteAddress ||
    req.ip ||
    '127.0.0.1'
  );
}

// Kiểm tra xem request có thuộc diện miễn trừ không (Chủ nhân hoặc Key hợp lệ)
function isExempt(req) {
  const creatorKey = req.headers['x-creator-passcode'] || req.headers['x-bypass-key'] || req.body?.passcode || req.query?.passcode;
  if (creatorKey === '1610200803062008') {
    return true;
  }
  return false;
}

/**
 * Tạo Middleware Anti-Req cho từng Tier cụ thể
 */
function createAntiReqMiddleware(tierConfig) {
  return function antiReqMiddleware(req, res, next) {
    if (isExempt(req)) {
      return next();
    }

    const ip = getClientIp(req);
    const now = Date.now();

    // 1. Kiểm tra nếu IP đang trong danh sách Tạm giam (IP Jail)
    if (ipJail.has(ip)) {
      const banUntil = ipJail.get(ip);
      if (now < banUntil) {
        const remainingSeconds = Math.ceil((banUntil - now) / 1000);
        res.setHeader('Retry-After', remainingSeconds);
        res.setHeader('X-AntiReq-Status', 'JAILED');
        return res.status(429).json({
          success: false,
          error: `🚫 [Anti-Req Security] Địa chỉ IP (${ip}) đã bị tạm khóa do gửi quá nhiều yêu cầu bất thường (Flood/Spam). Vui lòng chờ ${remainingSeconds} giây trước khi truy cập lại.`,
          retryAfter: remainingSeconds,
          status: 'IP_JAILED'
        });
      } else {
        // Hết thời gian giam -> xóa khỏi jail
        ipJail.delete(ip);
      }
    }

    const storeKey = `${ip}:${tierConfig.name}`;
    let record = requestStore.get(storeKey);

    if (!record || (now - record.startTime) > tierConfig.windowMs) {
      // Khởi tạo cửa sổ thời gian mới
      record = {
        count: 1,
        startTime: now,
        violations: record ? record.violations : 0
      };
      requestStore.set(storeKey, record);
    } else {
      record.count++;
    }

    const remaining = Math.max(0, tierConfig.max - record.count);
    const resetTime = Math.ceil((record.startTime + tierConfig.windowMs - now) / 1000);

    // Gán các HTTP Security Headers tiêu chuẩn
    res.setHeader('X-AntiReq-Limit', tierConfig.max);
    res.setHeader('X-AntiReq-Remaining', remaining);
    res.setHeader('X-AntiReq-Reset', resetTime);

    // 2. Kiểm tra nếu vượt quá hạn mức cho phép
    if (record.count > tierConfig.max) {
      record.violations = (record.violations || 0) + 1;

      // Nếu vi phạm nhiều lần liên tiếp -> đưa vào IP Jail
      if (record.violations >= CONFIG.JAIL.maxViolations) {
        const banUntil = now + CONFIG.JAIL.durationMs;
        ipJail.set(ip, banUntil);
        const banSeconds = Math.ceil(CONFIG.JAIL.durationMs / 1000);
        console.warn(`[Anti-Req Alert] 🚨 IP ${ip} đã bị đưa vào danh sách TẠM GIAM ${banSeconds}s vì vi phạm ${record.violations} lần!`);
        
        res.setHeader('Retry-After', banSeconds);
        return res.status(429).json({
          success: false,
          error: `🚫 [Anti-Req Security] Bạn đã gửi yêu cầu quá dồn dập nhiều lần. IP của bạn đã bị tạm khóa trong ${Math.round(banSeconds / 60)} phút để bảo vệ hệ thống.`,
          retryAfter: banSeconds,
          status: 'IP_JAILED'
        });
      }

      res.setHeader('Retry-After', resetTime);
      return res.status(429).json({
        success: false,
        error: `⚠️ [Anti-Req Warning] Bạn đang gửi yêu cầu quá nhanh (${record.count}/${tierConfig.max} req/phút). Vui lòng chậm lại và thử lại sau ${resetTime} giây.`,
        retryAfter: resetTime,
        status: 'RATE_LIMITED'
      });
    }

    next();
  };
}

// Định kỳ dọn dẹp bộ nhớ RAM mỗi 5 phút để tránh rò rỉ bộ nhớ
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestStore.entries()) {
    if (now - record.startTime > 5 * 60 * 1000) {
      requestStore.delete(key);
    }
  }
  for (const [ip, banUntil] of ipJail.entries()) {
    if (now >= banUntil) {
      ipJail.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// Thống kê trạng thái Anti-Req
function getSecurityStats() {
  const now = Date.now();
  const activeJailedIps = [];
  for (const [ip, banUntil] of ipJail.entries()) {
    if (now < banUntil) {
      activeJailedIps.push({ ip, remainingSeconds: Math.ceil((banUntil - now) / 1000) });
    }
  }

  return {
    status: 'ACTIVE',
    engine: 'AI Turbo AntiReq Defense v1.0',
    trackedClients: requestStore.size,
    jailedIpsCount: activeJailedIps.length,
    jailedIps: activeJailedIps,
    tiers: {
      auth: `${CONFIG.AUTH.max} req/${CONFIG.AUTH.windowMs / 1000}s`,
      ai: `${CONFIG.AI.max} req/${CONFIG.AI.windowMs / 1000}s`,
      global: `${CONFIG.GLOBAL.max} req/${CONFIG.GLOBAL.windowMs / 1000}s`,
    }
  };
}

module.exports = {
  antiReqAuth: createAntiReqMiddleware(CONFIG.AUTH),
  antiReqAi: createAntiReqMiddleware(CONFIG.AI),
  antiReqGlobal: createAntiReqMiddleware(CONFIG.GLOBAL),
  getClientIp,
  getSecurityStats,
  CONFIG
};
