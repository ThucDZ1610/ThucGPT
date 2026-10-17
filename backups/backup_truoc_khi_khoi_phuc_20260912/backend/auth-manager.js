const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const USERS_FILE = path.join(__dirname, 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'ai_turbo_pro_secret_thucgpt_2026';

// Initialize users file if missing
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), 'utf8');
}

// Read and write users
function getUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '[]');
  } catch (err) {
    console.error('[Auth] Error reading users file:', err);
    return [];
  }
}

function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[Auth] Error writing users file:', err);
    return false;
  }
}

// Mailer Transporter (Configured with FaceCheck Gmail SMTP)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: (process.env.SMTP_PORT || '465') == 465,
  auth: {
    user: process.env.SMTP_USER || 'tancongmangwebsite@gmail.com',
    pass: process.env.SMTP_PASS || 'uymvogwfevlhdixu',
  },
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000
});

// In-memory OTP store: key = email_type
const otpStore = new Map();

// Helper: Password strength check (>= 6 chars, uppercase, lowercase, numbers/special)
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Mật khẩu không được để trống.' };
  }
  if (password.length < 6) {
    return { valid: false, message: 'Mật khẩu phải có từ 6 ký tự trở lên.' };
  }
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigitOrSpecial = /[0-9\W_]/.test(password);

  if (!hasUpper || !hasLower || !hasDigitOrSpecial) {
    return {
      valid: false,
      message: 'Mật khẩu phải mạnh: bao gồm ít nhất 1 chữ hoa, 1 chữ thường và 1 số hoặc ký tự đặc biệt.'
    };
  }

  return { valid: true };
}

// Helper: Hash password
function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

// Helper: Verify password
function verifyPassword(password, hash, salt) {
  const calculated = crypto.scryptSync(password, salt, 64).toString('hex');
  return calculated === hash;
}

// Helper: Generate session token
function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    username: user.username,
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  };
  const str = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(str).digest('base64url');
  return str + '.' + signature;
}

// Helper: Verify session token
function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [str, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(str).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(str, 'base64url').toString('utf8'));
    if (payload.expiresAt && Date.now() > payload.expiresAt) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

// Generate & Send OTP via Gmail
async function sendOtp(email, type = 'register') {
  if (!email || !email.includes('@')) {
    throw new Error('Địa chỉ email không hợp lệ.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const key = cleanEmail + '_' + type;

  // Rate limit cooldown (30s)
  const existing = otpStore.get(key);
  if (existing && Date.now() < existing.resendAvailableAt) {
    const waitSec = Math.ceil((existing.resendAvailableAt - Date.now()) / 1000);
    throw new Error('Vui lòng đợi ' + waitSec + 's trước khi yêu cầu mã OTP mới.');
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
  const resendAvailableAt = Date.now() + 30 * 1000; // 30s cooldown

  otpStore.set(key, {
    code,
    expiresAt,
    resendAvailableAt,
    attempts: 0
  });

  // Action title & description
  let actionTitle = 'Xác thực tài khoản';
  let actionDesc = 'xác thực tài khoản của bạn';
  if (type === 'register') {
    actionTitle = 'Xác thực đăng ký tài khoản';
    actionDesc = 'hoàn tất đăng ký tài khoản AI Turbo Pro & ThucGPT';
  } else if (type === 'forgot_password') {
    actionTitle = 'Đặt lại mật khẩu';
    actionDesc = 'xác nhận đặt lại mật khẩu cho tài khoản AI Turbo Pro';
  } else if (type === 'login') {
    actionTitle = 'Đăng nhập nhanh bằng OTP';
    actionDesc = 'đăng nhập vào hệ thống AI Turbo Pro';
  }

  const htmlContent = `
    <div style="margin:0;padding:0;background-color:#0b0f19;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f3f4f6;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0b0f19;padding:40px 10px;">
        <tr>
          <td align="center">
            <div style="max-width:540px;background:linear-gradient(135deg, #111827 0%, #1e1b4b 100%);border:1px solid #374151;border-radius:18px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.6);text-align:left;">
              <div style="background:linear-gradient(90deg, #6366f1, #06b6d4);padding:24px 30px;text-align:center;">
                <h1 style="margin:0;font-size:24px;color:#ffffff;letter-spacing:1px;font-weight:800;">⚡ AI TURBO PRO</h1>
                <p style="margin:4px 0 0 0;font-size:13px;color:#e0e7ff;letter-spacing:2px;text-transform:uppercase;">THUCGPT SECURITY SYSTEM</p>
              </div>
              <div style="padding:32px 30px;">
                <h2 style="margin:0 0 12px 0;font-size:20px;color:#f9fafb;">` + actionTitle + `</h2>
                <p style="margin:0 0 24px 0;font-size:15px;color:#9ca3af;line-height:1.6;">
                  Xin chào, bạn đang thực hiện yêu cầu ` + actionDesc + `. Dưới đây là mã xác thực OTP bảo mật:
                </p>
                <div style="background:rgba(99, 102, 241, 0.12);border:2px dashed #6366f1;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
                  <span style="display:inline-block;font-size:36px;font-weight:900;letter-spacing:8px;color:#38bdf8;text-shadow:0 0 15px rgba(56,189,248,0.5);">` + code + `</span>
                </div>
                <p style="margin:0 0 8px 0;font-size:13px;color:#f87171;">
                  ⚠️ <strong>Lưu ý quan trọng:</strong> Mã này có hiệu lực trong vòng <strong>5 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai!
                </p>
                <p style="margin:0;font-size:13px;color:#6b7280;">
                  Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email. Tài khoản của bạn vẫn được bảo mật an toàn.
                </p>
              </div>
              <div style="background:#0f172a;padding:16px 30px;border-top:1px solid #1f2937;text-align:center;font-size:12px;color:#6b7280;">
                © 2026 AI Turbo Pro • ThucGPT Engine • Secured by FaceCheck SMTP
              </div>
            </div>
          </td>
        </tr>
      </table>
    </div>
  `;

  const mailOptions = {
    from: '"AI Turbo Pro / ThucGPT" <' + (process.env.EMAIL_FROM || process.env.SMTP_USER) + '>',
    to: cleanEmail,
    subject: '[' + code + '] Mã xác thực OTP cho ' + actionTitle + ' - AI Turbo Pro',
    html: htmlContent
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('[Auth] OTP sent successfully to ' + cleanEmail + ' (MessageId: ' + info.messageId + ')');
    return { success: true, message: 'Mã OTP đã được gửi đến email của bạn!' };
  } catch (err) {
    console.error('[Auth] Failed to send OTP email:', err);
    throw new Error('Không thể gửi mã OTP qua Gmail. Lỗi: ' + (err.message || 'SMTP Error'));
  }
}

// Verify OTP
function verifyOtp(email, code, type = 'register') {
  if (!email || !code) return { valid: false, message: 'Thiếu email hoặc mã OTP.' };
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.toString().trim();
  const key = cleanEmail + '_' + type;

  const entry = otpStore.get(key);
  if (!entry) {
    return { valid: false, message: 'Chưa có mã OTP nào được gửi đến email này hoặc mã đã hết hạn.' };
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(key);
    return { valid: false, message: 'Mã OTP đã hết hạn (sau 5 phút). Vui lòng yêu cầu mã mới.' };
  }

  entry.attempts += 1;
  if (entry.attempts > 3) {
    otpStore.delete(key);
    return { valid: false, message: 'Bạn đã nhập sai mã OTP quá 3 lần. Mã đã bị hủy.' };
  }

  if (entry.code !== cleanCode) {
    return { valid: false, message: 'Mã OTP không chính xác. Bạn còn ' + (3 - entry.attempts) + ' lần thử.' };
  }

  otpStore.delete(key);
  return { valid: true };
}

// Register User
async function registerUser({ email, username, password, confirmPassword, otp }) {
  if (!email || !email.includes('@')) {
    throw new Error('Email không hợp lệ.');
  }
  if (!username || username.trim().length < 3) {
    throw new Error('Tên tài khoản phải có ít nhất 3 ký tự.');
  }
  if (password !== confirmPassword) {
    throw new Error('Mật khẩu xác nhận không khớp.');
  }

  const passCheck = validatePassword(password);
  if (!passCheck.valid) {
    throw new Error(passCheck.message);
  }

  const otpRes = verifyOtp(email, otp, 'register');
  if (!otpRes.valid) {
    throw new Error(otpRes.message);
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = username.trim();

  const users = getUsers();
  if (users.some(u => u.email && u.email.toLowerCase() === cleanEmail)) {
    throw new Error('Email này đã được đăng ký tài khoản.');
  }
  if (users.some(u => u.username && u.username.toLowerCase() === cleanUsername.toLowerCase())) {
    throw new Error('Tên tài khoản này đã có người sử dụng. Vui lòng chọn tên khác.');
  }

  const { hash, salt } = hashPassword(password);
  const newUser = {
    id: 'usr_' + crypto.randomBytes(8).toString('hex'),
    username: cleanUsername,
    email: cleanEmail,
    passwordHash: hash,
    salt,
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(cleanUsername),
    role: 'user',
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);

  const token = generateToken(newUser);
  return {
    user: {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      avatar: newUser.avatar,
      role: newUser.role
    },
    token
  };
}

// Login User
async function loginUser({ login, password }) {
  if (!login || !password) {
    throw new Error('Vui lòng nhập đầy đủ tài khoản/email và mật khẩu.');
  }

  const cleanLogin = login.trim().toLowerCase();
  const users = getUsers();
  const user = users.find(u => 
    (u.email && u.email.toLowerCase() === cleanLogin) || 
    (u.username && u.username.toLowerCase() === cleanLogin)
  );

  if (!user || !user.passwordHash || !user.salt) {
    throw new Error('Tài khoản hoặc mật khẩu không chính xác.');
  }

  const isValid = verifyPassword(password, user.passwordHash, user.salt);
  if (!isValid) {
    throw new Error('Tài khoản hoặc mật khẩu không chính xác.');
  }

  const token = generateToken(user);
  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      role: user.role
    },
    token
  };
}

// Login via OTP
async function loginWithOtp({ email, otp }) {
  if (!email || !otp) {
    throw new Error('Vui lòng cung cấp email và mã OTP.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const otpRes = verifyOtp(cleanEmail, otp, 'login');
  if (!otpRes.valid) {
    throw new Error(otpRes.message);
  }

  const users = getUsers();
  let user = users.find(u => u.email && u.email.toLowerCase() === cleanEmail);

  if (!user) {
    const defaultUsername = cleanEmail.split('@')[0] || ('user_' + Math.floor(1000 + Math.random() * 9000));
    user = {
      id: 'usr_' + crypto.randomBytes(8).toString('hex'),
      username: defaultUsername,
      email: cleanEmail,
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(defaultUsername),
      role: 'user',
      createdAt: new Date().toISOString()
    };
    users.push(user);
    saveUsers(users);
  }

  const token = generateToken(user);
  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      role: user.role
    },
    token
  };
}

// Reset Password
async function resetPassword({ email, otp, newPassword, confirmPassword }) {
  if (!email || !otp || !newPassword) {
    throw new Error('Vui lòng điền đầy đủ thông tin.');
  }
  if (newPassword !== confirmPassword) {
    throw new Error('Mật khẩu xác nhận không khớp.');
  }

  const passCheck = validatePassword(newPassword);
  if (!passCheck.valid) {
    throw new Error(passCheck.message);
  }

  const cleanEmail = email.trim().toLowerCase();
  const otpRes = verifyOtp(cleanEmail, otp, 'forgot_password');
  if (!otpRes.valid) {
    throw new Error(otpRes.message);
  }

  const users = getUsers();
  const userIndex = users.findIndex(u => u.email && u.email.toLowerCase() === cleanEmail);
  if (userIndex === -1) {
    throw new Error('Không tìm thấy tài khoản tương ứng với email này.');
  }

  const { hash, salt } = hashPassword(newPassword);
  users[userIndex].passwordHash = hash;
  users[userIndex].salt = salt;
  users[userIndex].updatedAt = new Date().toISOString();
  saveUsers(users);

  return { success: true, message: 'Mật khẩu đã được cập nhật thành công! Vui lòng đăng nhập bằng mật khẩu mới.' };
}

// Google Sign-In
async function loginWithGoogle({ credential, email, name, picture, googleId }) {
  let googleEmail = email;
  let googleName = name;
  let googlePic = picture;
  let sub = googleId;

  if (credential) {
    try {
      const parts = credential.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        googleEmail = payload.email;
        googleName = payload.name || payload.given_name;
        googlePic = payload.picture;
        sub = payload.sub;
      }
    } catch (err) {
      console.error('[Auth] Error parsing Google credential:', err);
    }
  }

  if (!googleEmail) {
    throw new Error('Không thể xác thực thông tin tài khoản Google.');
  }

  const cleanEmail = googleEmail.trim().toLowerCase();
  const users = getUsers();
  let user = users.find(u => 
    (u.googleId && u.googleId === sub) || 
    (u.email && u.email.toLowerCase() === cleanEmail)
  );

  if (!user) {
    const baseUsername = (googleName || cleanEmail.split('@')[0]).replace(/[^a-zA-Z0-9_]/g, '_');
    user = {
      id: 'usr_' + crypto.randomBytes(8).toString('hex'),
      username: baseUsername || ('google_user_' + Math.floor(1000 + Math.random() * 9000)),
      email: cleanEmail,
      googleId: sub,
      avatar: googlePic || ('https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(cleanEmail)),
      role: 'user',
      createdAt: new Date().toISOString()
    };
    users.push(user);
    saveUsers(users);
  } else {
    if (!user.googleId && sub) user.googleId = sub;
    if (googlePic && (!user.avatar || user.avatar.includes('dicebear'))) user.avatar = googlePic;
    saveUsers(users);
  }

  const token = generateToken(user);
  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      role: user.role
    },
    token
  };
}

// Get user by token
function getUserByToken(token) {
  const payload = verifyToken(token);
  if (!payload || !payload.id) return null;
  const users = getUsers();
  const user = users.find(u => u.id === payload.id);
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    role: user.role
  };
}

module.exports = {
  validatePassword,
  sendOtp,
  verifyOtp,
  registerUser,
  loginUser,
  loginWithOtp,
  resetPassword,
  loginWithGoogle,
  getUserByToken,
  verifyToken,
  generateToken
};
