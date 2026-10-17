/**
 * AI TURBO PRO • AUTHENTICATION & SECURITY MODULE (ThucGPT)
 * - Login (Username/Password, Google Sign-In, Gmail OTP)
 * - Register (Gmail OTP Verification, Strong Password >= 6 chars)
 * - Forgot Password (Gmail OTP Verification & Reset)
 * - User Profile & Session Management
 */

(function () {
  'use strict';

  const USER_KEY = 'ai_turbo_user_data';
  let currentUser = null;
  let otpCooldownTimer = null;
  localStorage.removeItem('ai_turbo_auth_token');

  const baseFetch = window.fetch.bind(window);
  window.fetch = (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.href);
    const method = String(options.method || input.method || 'GET').toUpperCase();
    const headers = new Headers(options.headers || input.headers || {});
    if (url.origin === window.location.origin && url.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const csrfCookie = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('ai_csrf='));
      if (csrfCookie) headers.set('X-CSRF-Token', decodeURIComponent(csrfCookie.slice('ai_csrf='.length)));
    }
    return baseFetch(input, { ...options, credentials: 'same-origin', headers });
  };

  function isSafeAvatarUrl(value) {
    if (typeof value !== 'string') return false;
    if (/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'https:'
        && (url.hostname === 'api.dicebear.com' || url.hostname.endsWith('.googleusercontent.com'));
    } catch (error) {
      return false;
    }
  }

  function init() {
    bindHeaderButtons();
    bindModalEvents();
    bindChatGuards();
    checkUrlParams();
    checkExistingSession();
    initGoogleSignIn();
  }

  function bindHeaderButtons() {
    const authBtns = document.querySelectorAll('#userAuthBtn, .auth-nav-btn');
    authBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentUser) {
          showUserProfileModal();
        } else {
          openAuthModal('login');
        }
      });
    });
  }

  function checkUrlParams() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('require_login') === '1') {
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => {
          openAuthModal('login');
          showAlert('🔒 Bạn cần có tài khoản để truy cập khung chat AI Turbo Pro. Vui lòng đăng nhập hoặc đăng ký thành viên mới!', false);
        }, 350);
      }
    } catch (e) {}
  }

  function bindChatGuards() {
    document.addEventListener('click', (e) => {
      const target = e.target.closest('.auth-chat-link, a[href="/chat"]');
      if (target) {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) {
          e.preventDefault();
          e.stopPropagation();
          openAuthModal('login');
          showAlert('🔒 Bạn cần có tài khoản để truy cập khung chat AI Turbo Pro. Vui lòng đăng nhập hoặc đăng ký thành viên mới!', false);
        }
      }
    }, true);
  }

  function handleAuthSuccess(data, customMessage) {
    if (!data || !data.user) return;
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    currentUser = data.user;
    updateUIForLoggedIn(currentUser);
    showAlert(customMessage || '🎉 Đăng nhập thành công! Đang chuyển vào khung chat AI...', true);
    setTimeout(() => {
      closeAuthModal();
      if (window.location.pathname !== '/chat') {
        window.location.href = '/chat';
      }
    }, 700);
  }

  async function checkExistingSession() {
    const isChatPage = window.location.pathname === '/chat' || window.location.pathname.includes('index.html');
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json();
      if (data && data.success && data.user) {
        currentUser = data.user;
        localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
        updateUIForLoggedIn(currentUser);
      } else {
        localStorage.removeItem(USER_KEY);
        currentUser = null;
        updateUIForLoggedOut();
        if (isChatPage) {
          window.location.replace('/?require_login=1');
        }
      }
    } catch (err) {
      console.warn('[Auth] Session check failed:', err);
      const cached = localStorage.getItem(USER_KEY);
      if (cached) {
        try {
          currentUser = JSON.parse(cached);
          updateUIForLoggedIn(currentUser);
        } catch (e) {
          if (isChatPage) window.location.replace('/?require_login=1');
        }
      } else {
        if (isChatPage) window.location.replace('/?require_login=1');
      }
    }
  }

  function updateUIForLoggedIn(user) {
    const labels = document.querySelectorAll('#userAuthLabel');
    const icons = document.querySelectorAll('#userAuthIcon');
    const btns = document.querySelectorAll('#userAuthBtn, .auth-nav-btn');

    labels.forEach(el => {
      el.textContent = user.username || 'Tài khoản';
    });

    icons.forEach(el => {
      if (isSafeAvatarUrl(user.avatar)) {
        const img = document.createElement('img');
        img.src = user.avatar;
        img.alt = 'Avatar';
        img.className = 'auth-header-avatar';
        el.replaceChildren(img);
      } else {
        el.textContent = '👤';
      }
    });

    btns.forEach(btn => {
      btn.classList.add('is-logged-in');
      btn.title = `Tài khoản: ${user.username} (${user.email}) - Bấm để xem thông tin`;
    });
  }

  function updateUIForLoggedOut() {
    currentUser = null;
    const labels = document.querySelectorAll('#userAuthLabel');
    const icons = document.querySelectorAll('#userAuthIcon');
    const btns = document.querySelectorAll('#userAuthBtn, .auth-nav-btn');

    labels.forEach(el => {
      el.textContent = 'Đăng nhập';
    });

    icons.forEach(el => {
      el.textContent = '👤';
    });

    btns.forEach(btn => {
      btn.classList.remove('is-logged-in');
      btn.title = 'Đăng nhập / Đăng ký tài khoản AI Turbo Pro';
    });
  }

  function evaluatePasswordStrength(password) {
    let score = 0;
    const checks = {
      length: (password || '').length >= 6,
      upper: /[A-Z]/.test(password || ''),
      lower: /[a-z]/.test(password || ''),
      digit: /[0-9\W_]/.test(password || '')
    };

    if (checks.length) score += 25;
    if (checks.upper) score += 25;
    if (checks.lower) score += 25;
    if (checks.digit) score += 25;

    let label = 'Rất yếu';
    let color = '#ef4444';

    if (score >= 100) {
      label = 'Cực mạnh (Chuẩn bảo mật)';
      color = '#10b981';
    } else if (score >= 75) {
      label = 'Khá mạnh';
      color = '#22c55e';
    } else if (score >= 50) {
      label = 'Trung bình (Cần thêm chữ hoa/số)';
      color = '#eab308';
    }

    return { score, label, color, checks };
  }

  function updateStrengthMeter(password, fillEl, labelEl, criteriaEls = null) {
    if (!fillEl || !labelEl) return;
    if (!password) {
      fillEl.style.width = '0%';
      fillEl.style.backgroundColor = '#ef4444';
      labelEl.textContent = 'Độ mạnh: Chưa nhập';
      labelEl.style.color = '#9ca3af';
      if (criteriaEls) {
        criteriaEls.length.className = '';
        criteriaEls.upper.className = '';
        criteriaEls.lower.className = '';
        criteriaEls.digit.className = '';
      }
      return;
    }

    const { score, label, color, checks } = evaluatePasswordStrength(password);
    fillEl.style.width = score + '%';
    fillEl.style.backgroundColor = color;
    labelEl.textContent = 'Độ mạnh: ' + label;
    labelEl.style.color = color;

    if (criteriaEls) {
      criteriaEls.length.className = checks.length ? 'valid' : 'invalid';
      criteriaEls.length.textContent = (checks.length ? '✓' : '✕') + ' Ít nhất 6 ký tự';

      criteriaEls.upper.className = checks.upper ? 'valid' : 'invalid';
      criteriaEls.upper.textContent = (checks.upper ? '✓' : '✕') + ' Có chữ hoa (A-Z)';

      criteriaEls.lower.className = checks.lower ? 'valid' : 'invalid';
      criteriaEls.lower.textContent = (checks.lower ? '✓' : '✕') + ' Có chữ thường (a-z)';

      criteriaEls.digit.className = checks.digit ? 'valid' : 'invalid';
      criteriaEls.digit.textContent = (checks.digit ? '✓' : '✕') + ' Có số hoặc ký tự đặc biệt';
    }
  }

  function showAlert(msg, isSuccess = false) {
    const alertBox = document.getElementById('authAlertBox');
    if (!alertBox) return;
    alertBox.style.display = 'block';
    alertBox.className = 'auth-alert-box ' + (isSuccess ? 'alert-success' : 'alert-danger');
    alertBox.textContent = (isSuccess ? '✅ ' : '⚠️ ') + msg;
  }

  function hideAlert() {
    const alertBox = document.getElementById('authAlertBox');
    if (alertBox) alertBox.style.display = 'none';
  }

  function startOtpCountdown(btnEl) {
    if (!btnEl) return;
    let sec = 45;
    btnEl.disabled = true;
    btnEl.classList.add('btn-disabled');
    btnEl.textContent = `Gửi lại (${sec}s)`;

    if (otpCooldownTimer) clearInterval(otpCooldownTimer);
    otpCooldownTimer = setInterval(() => {
      sec -= 1;
      if (sec <= 0) {
        clearInterval(otpCooldownTimer);
        btnEl.disabled = false;
        btnEl.classList.remove('btn-disabled');
        btnEl.textContent = 'Gửi OTP';
      } else {
        btnEl.textContent = `Gửi lại (${sec}s)`;
      }
    }, 1000);
  }

  function openAuthModal(tab = 'login') {
    const modal = document.getElementById('aiTurboAuthModal');
    if (!modal) return;
    hideAlert();
    switchTab(tab);
    modal.style.display = 'flex';
  }

  function closeAuthModal() {
    const modal = document.getElementById('aiTurboAuthModal');
    if (modal) modal.style.display = 'none';
  }

  function renderProfileAvatar(avatarUrl, username) {
    const avatarBox = document.getElementById('profileModalAvatar');
    if (!avatarBox) return;
    avatarBox.replaceChildren();
    if (isSafeAvatarUrl(avatarUrl)) {
      const img = document.createElement('img');
      img.src = avatarUrl;
      img.alt = username || 'User';
      avatarBox.appendChild(img);
    } else {
      const fallback = document.createElement('span');
      fallback.textContent = '👤';
      avatarBox.appendChild(fallback);
    }
    const overlay = document.createElement('div');
    overlay.className = 'avatar-hover-overlay';
    const icon = document.createElement('span');
    icon.className = 'overlay-icon';
    icon.textContent = '📷';
    const label = document.createElement('span');
    label.className = 'overlay-text';
    label.textContent = 'Đổi ảnh';
    overlay.append(icon, label);
    avatarBox.appendChild(overlay);
  }

  function resizeImageToAvatar(file, maxSize = 256) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxSize) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Nén định dạng JPEG 88% siêu nét nhưng nhẹ chỉ ~20-30KB
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Không thể xử lý định dạng ảnh này.'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Lỗi khi đọc file ảnh từ thiết bị.'));
      reader.readAsDataURL(file);
    });
  }

  async function handleAvatarUpload(file) {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      alert('Vui lòng chọn một tệp hình ảnh hợp lệ (PNG, JPG, WEBP, GIF).');
      return;
    }

    const progressEl = document.getElementById('avatarUploadProgress');
    if (progressEl) {
      progressEl.style.display = 'block';
      progressEl.style.color = '#38bdf8';
      progressEl.textContent = '⏳ Đang xử lý và tối ưu ảnh...';
    }

    try {
      const resizedDataUrl = await resizeImageToAvatar(file, 256);

      if (progressEl) progressEl.textContent = '🚀 Đang lưu ảnh đại diện...';

      const res = await fetch('/api/auth/update-avatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ avatar: resizedDataUrl })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Cập nhật ảnh đại diện thất bại.');
      }

      // Cập nhật bộ nhớ và localStorage
      currentUser.avatar = resizedDataUrl;
      localStorage.setItem(USER_KEY, JSON.stringify(currentUser));

      // Re-render UI
      renderProfileAvatar(currentUser.avatar, currentUser.username);
      updateUIForLoggedIn(currentUser);

      if (progressEl) {
        progressEl.style.color = '#34d399';
        progressEl.textContent = '✨ Cập nhật ảnh đại diện thành công!';
        setTimeout(() => {
          progressEl.style.display = 'none';
          progressEl.style.color = '#38bdf8';
        }, 2500);
      }
    } catch (err) {
      if (progressEl) {
        progressEl.style.color = '#f87171';
        progressEl.textContent = '❌ ' + (err.message || 'Lỗi khi tải ảnh');
        setTimeout(() => {
          progressEl.style.display = 'none';
          progressEl.style.color = '#38bdf8';
        }, 3000);
      }
    }
  }

  function showUserProfileModal() {
    if (!currentUser) return;
    const modal = document.getElementById('aiTurboProfileModal');
    if (!modal) return;

    document.getElementById('profileModalUsername').textContent = currentUser.username;
    document.getElementById('profileModalEmail').textContent = currentUser.email || 'Chưa cung cấp';
    renderProfileAvatar(currentUser.avatar, currentUser.username);

    modal.style.display = 'flex';
  }

  function closeProfileModal() {
    const modal = document.getElementById('aiTurboProfileModal');
    if (modal) modal.style.display = 'none';
  }

  function switchTab(tabName) {
    hideAlert();
    const tabBtns = document.querySelectorAll('.auth-tab-btn');
    const tabContents = document.querySelectorAll('.auth-tab-content');
    const titleEl = document.getElementById('authModalTitle');
    const subEl = document.getElementById('authModalSubtitle');

    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    tabContents.forEach(content => {
      content.classList.remove('active');
    });

    if (tabName === 'login') {
      document.getElementById('tabContentLogin')?.classList.add('active');
      if (titleEl) titleEl.textContent = 'ĐĂNG NHẬP HỆ THỐNG';
      if (subEl) subEl.textContent = 'Truy cập các tính năng lập trình và sửa code độc quyền';
    } else if (tabName === 'register') {
      document.getElementById('tabContentRegister')?.classList.add('active');
      if (titleEl) titleEl.textContent = 'ĐĂNG KÝ THÀNH VIÊN';
      if (subEl) subEl.textContent = 'Bảo mật bằng xác thực OTP Gmail & Mật khẩu chuẩn mã hóa';
    } else if (tabName === 'forgot') {
      document.getElementById('tabContentForgot')?.classList.add('active');
      if (titleEl) titleEl.textContent = 'ĐẶT LẠI MẬT KHẨU';
      if (subEl) subEl.textContent = 'Xác minh qua mã bảo mật gửi trực tiếp về Gmail';
    } else if (tabName === 'otp_login') {
      document.getElementById('tabContentOtpLogin')?.classList.add('active');
      if (titleEl) titleEl.textContent = 'ĐĂNG NHẬP BẰNG OTP';
      if (subEl) subEl.textContent = 'Đăng nhập nhanh an toàn chỉ trong vài giây';
    } else if (tabName === 'google') {
      document.getElementById('tabContentGoogle')?.classList.add('active');
      if (titleEl) titleEl.textContent = 'ĐĂNG KÝ / ĐĂNG NHẬP GOOGLE';
      if (subEl) subEl.textContent = 'Đồng bộ tài khoản Gmail với AI Turbo Pro';
      setTimeout(() => {
        document.getElementById('googleEmailInput')?.focus();
      }, 50);
    }
  }

  function bindModalEvents() {
    document.getElementById('closeAuthModalBtn')?.addEventListener('click', closeAuthModal);
    document.getElementById('closeProfileModalBtn')?.addEventListener('click', closeProfileModal);

    document.getElementById('aiTurboAuthModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'aiTurboAuthModal') closeAuthModal();
    });
    document.getElementById('aiTurboProfileModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'aiTurboProfileModal') closeProfileModal();
    });

    // Avatar upload handlers
    const avatarInput = document.getElementById('avatarFileInput');
    document.getElementById('changeAvatarBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      avatarInput?.click();
    });
    document.getElementById('profileModalAvatar')?.addEventListener('click', (e) => {
      e.stopPropagation();
      avatarInput?.click();
    });
    avatarInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        handleAvatarUpload(file);
      }
      e.target.value = '';
    });

    document.querySelectorAll('.auth-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.getAttribute('data-tab'));
      });
    });

    document.querySelectorAll('.switch-to-register').forEach(el => {
      el.addEventListener('click', (e) => { e.preventDefault(); switchTab('register'); });
    });
    document.querySelectorAll('.switch-to-login').forEach(el => {
      el.addEventListener('click', (e) => { e.preventDefault(); switchTab('login'); });
    });
    document.getElementById('forgotPassLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('forgot');
    });
    document.getElementById('loginWithOtpBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('otp_login');
    });

    document.querySelectorAll('.toggle-pass-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (input) {
          if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = '🙈';
          } else {
            input.type = 'password';
            btn.textContent = '👁️';
          }
        }
      });
    });

    const regPassInput = document.getElementById('regPassword');
    const fillEl = document.getElementById('strengthBarFill');
    const labelEl = document.getElementById('strengthLabelText');
    const critEls = {
      length: document.getElementById('critLength'),
      upper: document.getElementById('critUpper'),
      lower: document.getElementById('critLower'),
      digit: document.getElementById('critDigit')
    };

    regPassInput?.addEventListener('input', () => {
      updateStrengthMeter(regPassInput.value, fillEl, labelEl, critEls);
      checkPassMatch();
    });

    const regConfirmInput = document.getElementById('regConfirmPassword');
    const matchStatusEl = document.getElementById('passMatchStatus');
    function checkPassMatch() {
      if (!regConfirmInput || !matchStatusEl) return;
      if (!regConfirmInput.value) {
        matchStatusEl.textContent = '';
        return;
      }
      if (regPassInput && regPassInput.value === regConfirmInput.value) {
        matchStatusEl.textContent = '✓ Mật khẩu khớp hoàn toàn';
        matchStatusEl.className = 'pass-match-status match-ok';
      } else {
        matchStatusEl.textContent = '✕ Mật khẩu nhập lại không khớp';
        matchStatusEl.className = 'pass-match-status match-bad';
      }
    }
    regConfirmInput?.addEventListener('input', checkPassMatch);

    const forgotPassInput = document.getElementById('forgotNewPassword');
    const forgotFillEl = document.getElementById('forgotStrengthBarFill');
    const forgotLabelEl = document.getElementById('forgotStrengthLabelText');
    forgotPassInput?.addEventListener('input', () => {
      updateStrengthMeter(forgotPassInput.value, forgotFillEl, forgotLabelEl);
    });

    // Send OTP (Register)
    document.getElementById('regSendOtpBtn')?.addEventListener('click', async () => {
      const email = document.getElementById('regEmail')?.value.trim();
      if (!email || !email.includes('@')) {
        return showAlert('Vui lòng nhập địa chỉ email hợp lệ trước khi bấm gửi mã!');
      }
      const btn = document.getElementById('regSendOtpBtn');
      btn.disabled = true;
      btn.textContent = 'Đang gửi...';
      hideAlert();

      try {
        const res = await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, type: 'register' })
        });
        const data = await res.json();
        if (data.success) {
          showAlert(data.message || 'Mã OTP đã được gửi đến email của bạn!', true);
          startOtpCountdown(btn);
          document.getElementById('regOtp')?.focus();
        } else {
          showAlert(data.error || 'Không thể gửi mã OTP.');
          btn.disabled = false;
          btn.textContent = 'Gửi OTP';
        }
      } catch (err) {
        showAlert('Lỗi kết nối máy chủ. Vui lòng thử lại sau.');
        btn.disabled = false;
        btn.textContent = 'Gửi OTP';
      }
    });

    // Send OTP (Forgot Password)
    document.getElementById('forgotSendOtpBtn')?.addEventListener('click', async () => {
      const email = document.getElementById('forgotEmail')?.value.trim();
      if (!email || !email.includes('@')) {
        return showAlert('Vui lòng nhập email tài khoản của bạn!');
      }
      const btn = document.getElementById('forgotSendOtpBtn');
      btn.disabled = true;
      btn.textContent = 'Đang gửi...';
      hideAlert();

      try {
        const res = await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, type: 'forgot_password' })
        });
        const data = await res.json();
        if (data.success) {
          showAlert(data.message || 'Mã OTP đặt lại mật khẩu đã được gửi đến Gmail của bạn!', true);
          startOtpCountdown(btn);
          document.getElementById('forgotOtp')?.focus();
        } else {
          showAlert(data.error || 'Không thể gửi mã OTP.');
          btn.disabled = false;
          btn.textContent = 'Gửi OTP';
        }
      } catch (err) {
        showAlert('Lỗi kết nối máy chủ. Vui lòng thử lại sau.');
        btn.disabled = false;
        btn.textContent = 'Gửi OTP';
      }
    });

    // Send OTP (OTP Login)
    document.getElementById('otpLoginSendBtn')?.addEventListener('click', async () => {
      const email = document.getElementById('otpLoginEmail')?.value.trim();
      if (!email || !email.includes('@')) {
        return showAlert('Vui lòng nhập email hợp lệ!');
      }
      const btn = document.getElementById('otpLoginSendBtn');
      btn.disabled = true;
      btn.textContent = 'Đang gửi...';
      hideAlert();

      try {
        const res = await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, type: 'login' })
        });
        const data = await res.json();
        if (data.success) {
          showAlert(data.message || 'Mã OTP đăng nhập đã được gửi đến Gmail!', true);
          startOtpCountdown(btn);
          document.getElementById('otpLoginOtp')?.focus();
        } else {
          showAlert(data.error || 'Không thể gửi mã OTP.');
          btn.disabled = false;
          btn.textContent = 'Gửi OTP';
        }
      } catch (err) {
        showAlert('Lỗi kết nối máy chủ.');
        btn.disabled = false;
        btn.textContent = 'Gửi OTP';
      }
    });

    // Register Form Handler
    async function handleRegisterSubmit(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      const email = document.getElementById('regEmail')?.value.trim();
      const otp = document.getElementById('regOtp')?.value.trim();
      const username = document.getElementById('regUsername')?.value.trim();
      const password = document.getElementById('regPassword')?.value;
      const confirmPassword = document.getElementById('regConfirmPassword')?.value;

      if (!email || !email.includes('@')) {
        showAlert('Vui lòng nhập địa chỉ email hợp lệ!');
        const el = document.getElementById('regEmail');
        el?.focus();
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      if (!otp) {
        showAlert('Vui lòng nhập mã xác thực OTP (6 chữ số) đã gửi về Gmail!');
        const el = document.getElementById('regOtp');
        el?.focus();
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      if (!username || username.length < 3) {
        showAlert('Vui lòng chọn Tên tài khoản (tối thiểu 3 ký tự)!');
        const el = document.getElementById('regUsername');
        el?.focus();
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      if (!password) {
        showAlert('Vui lòng nhập Mật khẩu bảo mật!');
        const el = document.getElementById('regPassword');
        el?.focus();
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      if (password.length < 6) {
        showAlert('Mật khẩu phải có ít nhất 6 ký tự!');
        const el = document.getElementById('regPassword');
        el?.focus();
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      const { score } = evaluatePasswordStrength(password);
      if (score < 75) {
        showAlert('Mật khẩu chưa đủ mạnh! Cần ít nhất 6 ký tự, gồm cả chữ hoa, chữ thường và số/ký tự đặc biệt.');
        const el = document.getElementById('regPassword');
        el?.focus();
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      if (!confirmPassword) {
        showAlert('Vui lòng cuộn xuống và nhập lại Mật khẩu xác nhận!');
        const el = document.getElementById('regConfirmPassword');
        el?.focus();
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      if (password !== confirmPassword) {
        showAlert('Mật khẩu nhập lại không khớp với mật khẩu đã nhập.');
        const el = document.getElementById('regConfirmPassword');
        el?.focus();
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      const submitBtn = document.getElementById('regSubmitBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang đăng ký...';
      }
      hideAlert();

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, username, password, confirmPassword, otp })
        });
        const data = await res.json();
        if (data.success && data.user) {
          handleAuthSuccess(data, '🎉 Đăng ký thành viên thành công! Đang chuyển vào khung chat AI...');
        } else {
          showAlert(data.error || 'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.');
        }
      } catch (err) {
        showAlert('Lỗi kết nối máy chủ. Vui lòng thử lại.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '🚀 HOÀN TẤT ĐĂNG KÝ';
        }
      }
    }

    document.getElementById('registerForm')?.addEventListener('submit', handleRegisterSubmit);
    document.getElementById('regSubmitBtn')?.addEventListener('click', handleRegisterSubmit);

    // Login Form Handler
    async function handleLoginSubmit(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const login = document.getElementById('loginAccount')?.value.trim();
      const password = document.getElementById('loginPassword')?.value;

      if (!login || !password) {
        return showAlert('Vui lòng nhập tài khoản/email và mật khẩu.');
      }

      const submitBtn = document.getElementById('loginSubmitBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang xác thực...';
      }
      hideAlert();

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login, password })
        });
        const data = await res.json();
        if (data.success && data.user) {
          handleAuthSuccess(data, '🎉 Đăng nhập thành công! Đang chuyển vào khung chat AI...');
        } else {
          showAlert(data.error || 'Tài khoản hoặc mật khẩu không chính xác.');
        }
      } catch (err) {
        showAlert('Lỗi kết nối máy chủ.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '⚡ ĐĂNG NHẬP NGAY';
        }
      }
    }

    document.getElementById('loginForm')?.addEventListener('submit', handleLoginSubmit);
    document.getElementById('loginSubmitBtn')?.addEventListener('click', handleLoginSubmit);

    // Forgot Password Form Handler
    async function handleForgotSubmit(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const email = document.getElementById('forgotEmail')?.value.trim();
      const otp = document.getElementById('forgotOtp')?.value.trim();
      const newPassword = document.getElementById('forgotNewPassword')?.value;
      const confirmPassword = document.getElementById('forgotConfirmPassword')?.value;

      if (!email || !otp || !newPassword || !confirmPassword) {
        return showAlert('Vui lòng điền đầy đủ thông tin.');
      }

      if (newPassword !== confirmPassword) {
        return showAlert('Mật khẩu xác nhận không khớp.');
      }

      const { score } = evaluatePasswordStrength(newPassword);
      if (score < 75) {
        return showAlert('Mật khẩu mới phải mạnh: tối thiểu 6 ký tự, gồm chữ hoa, chữ thường và số/ký tự đặc biệt.');
      }

      const submitBtn = document.getElementById('forgotSubmitBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang cập nhật...';
      }
      hideAlert();

      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp, newPassword, confirmPassword })
        });
        const data = await res.json();
        if (data.success) {
          showAlert('🎉 Đổi mật khẩu thành công! Hãy đăng nhập bằng mật khẩu mới.', true);
          setTimeout(() => {
            switchTab('login');
          }, 1500);
        } else {
          showAlert(data.error || 'Không thể đặt lại mật khẩu.');
        }
      } catch (err) {
        showAlert('Lỗi kết nối máy chủ.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '🔄 ĐẶT LẠI MẬT KHẨU';
        }
      }
    }

    document.getElementById('forgotForm')?.addEventListener('submit', handleForgotSubmit);
    document.getElementById('forgotSubmitBtn')?.addEventListener('click', handleForgotSubmit);

    // Quick OTP Login Form Handler
    async function handleOtpLoginSubmit(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const email = document.getElementById('otpLoginEmail')?.value.trim();
      const otp = document.getElementById('otpLoginOtp')?.value.trim();

      if (!email || !otp) {
        return showAlert('Vui lòng nhập email và mã OTP.');
      }

      const submitBtn = document.getElementById('otpLoginSubmitBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang xác thực OTP...';
      }
      hideAlert();

      try {
        const res = await fetch('/api/auth/login-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp })
        });
        const data = await res.json();
        if (data.success && data.user) {
          handleAuthSuccess(data, '🎉 Xác thực OTP thành công! Đang chuyển vào khung chat AI...');
        } else {
          showAlert(data.error || 'Mã OTP không hợp lệ hoặc đã hết hạn.');
        }
      } catch (err) {
        showAlert('Lỗi kết nối máy chủ.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '⚡ XÁC THỰC & ĐĂNG NHẬP';
        }
      }
    }

    document.getElementById('otpLoginForm')?.addEventListener('submit', handleOtpLoginSubmit);
    document.getElementById('otpLoginSubmitBtn')?.addEventListener('click', handleOtpLoginSubmit);

    // Google Sign-In & Sign-Up Triggers
    document.getElementById('googleSignInBtn')?.addEventListener('click', triggerGoogleSignIn);
    document.getElementById('googleSignUpBtn')?.addEventListener('click', triggerGoogleSignIn);

    // Google Form Submit
    document.getElementById('googleAuthForm')?.addEventListener('submit', async () => {
      const email = document.getElementById('googleEmailInput')?.value.trim();
      const name = document.getElementById('googleNameInput')?.value.trim();

      if (!email || !email.includes('@')) {
        return showAlert('Vui lòng nhập địa chỉ Gmail hợp lệ!');
      }

      const submitBtn = document.getElementById('googleSubmitActionBtn');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>⏳ Đang đồng bộ tài khoản Google...</span>';
      hideAlert();

      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            name: name || email.split('@')[0],
            googleId: 'g_' + Math.floor(10000000 + Math.random() * 90000000)
          })
        });
        const data = await res.json();
        if (data.success && data.user) {
          handleAuthSuccess(data, '🎉 Đăng nhập tài khoản Google thành công! Đang chuyển vào khung chat AI...');
        } else {
          showAlert(data.error || 'Đăng ký bằng Google thất bại.');
        }
      } catch (err) {
        showAlert('Lỗi kết nối máy chủ. Vui lòng thử lại.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
            <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2c0 2.8.7 5.5 1.9 7.9l3.7-2.9z"/>
            <path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"/>
          </svg>
          <span>XÁC NHẬN VỚI TÀI KHOẢN GOOGLE</span>
        `;
      }
    });

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      localStorage.removeItem(USER_KEY);
      currentUser = null;
      updateUIForLoggedOut();
      closeProfileModal();
      if (window.location.pathname === '/chat' || window.location.pathname.includes('index.html')) {
        window.location.replace('/');
      } else {
        alert('Đã đăng xuất thành công khỏi hệ thống AI Turbo Pro.');
      }
    });
  }

  async function initGoogleSignIn() {
    try {
      const response = await fetch('/api/auth/config', { cache: 'no-store' });
      const { googleClientId } = await response.json();
      if (!googleClientId || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredentialResponse,
        auto_select: false
      });
    } catch (error) {}
  }

  async function handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) return;
    try {
      showAlert('Đang đăng nhập bằng tài khoản Google...', true);
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const data = await res.json();
      if (data.success && data.user) {
        handleAuthSuccess(data, '🎉 Đăng nhập Google thành công! Đang chuyển vào khung chat AI...');
      } else {
        showAlert(data.error || 'Đăng nhập Google không thành công.');
      }
    } catch (err) {
      showAlert('Lỗi kết nối Google API.');
    }
  }

  function triggerGoogleSignIn() {
    switchTab('google');
  }

  window.AITurboAuth = {
    showLogin: () => openAuthModal('login'),
    showRegister: () => openAuthModal('register'),
    showForgot: () => openAuthModal('forgot'),
    getCurrentUser: () => currentUser,
    logout: () => {
      fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      localStorage.removeItem(USER_KEY);
      currentUser = null;
      updateUIForLoggedOut();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
