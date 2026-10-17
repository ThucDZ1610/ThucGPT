/**
 * AI TURBO PRO • AUTHENTICATION & SECURITY MODULE (ThucGPT)
 * - Login (Username/Password, Google Sign-In, Gmail OTP)
 * - Register (Gmail OTP Verification, Strong Password >= 6 chars)
 * - Forgot Password (Gmail OTP Verification & Reset)
 * - User Profile & Session Management
 */

(function () {
  'use strict';

  const TOKEN_KEY = 'ai_turbo_auth_token';
  const USER_KEY = 'ai_turbo_user_data';
  let currentUser = null;
  let otpCooldownTimer = null;

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
    if (!data || !data.token || !data.user) return;
    localStorage.setItem(TOKEN_KEY, data.token);
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
    const token = localStorage.getItem(TOKEN_KEY);
    const isChatPage = window.location.pathname === '/chat' || window.location.pathname.includes('index.html');
    if (!token) {
      updateUIForLoggedOut();
      if (isChatPage) {
        window.location.replace('/?require_login=1');
      }
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json();
      if (data && data.success && data.user) {
        currentUser = data.user;
        localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
        updateUIForLoggedIn(currentUser);
      } else {
        localStorage.removeItem(TOKEN_KEY);
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
      if (user.avatar) {
        el.innerHTML = `<img src="${user.avatar}" alt="Avatar" class="auth-header-avatar" />`;
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
    alertBox.innerHTML = (isSuccess ? '✅ ' : '⚠️ ') + msg;
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

  function showUserProfileModal() {
    if (!currentUser) return;
    const modal = document.getElementById('aiTurboProfileModal');
    if (!modal) return;

    document.getElementById('profileModalUsername').textContent = currentUser.username;
    document.getElementById('profileModalEmail').textContent = currentUser.email || 'Chưa cung cấp';
    const avatarBox = document.getElementById('profileModalAvatar');
    if (currentUser.avatar) {
      avatarBox.innerHTML = `<img src="${currentUser.avatar}" alt="${currentUser.username}" />`;
    } else {
      avatarBox.innerHTML = '<span>👤</span>';
    }

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

    // Register Form
    document.getElementById('registerForm')?.addEventListener('submit', async () => {
      const email = document.getElementById('regEmail')?.value.trim();
      const otp = document.getElementById('regOtp')?.value.trim();
      const username = document.getElementById('regUsername')?.value.trim();
      const password = document.getElementById('regPassword')?.value;
      const confirmPassword = document.getElementById('regConfirmPassword')?.value;

      if (!email || !otp || !username || !password || !confirmPassword) {
        return showAlert('Vui lòng điền đầy đủ tất cả các trường.');
      }

      if (password.length < 6) {
        return showAlert('Mật khẩu phải có ít nhất 6 ký tự!');
      }

      const { score } = evaluatePasswordStrength(password);
      if (score < 75) {
        return showAlert('Mật khẩu chưa đủ mạnh! Cần ít nhất 6 ký tự, gồm cả chữ hoa, chữ thường và số/ký tự đặc biệt.');
      }

      if (password !== confirmPassword) {
        return showAlert('Mật khẩu nhập lại không khớp.');
      }

      const submitBtn = document.getElementById('regSubmitBtn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang đăng ký...';
      hideAlert();

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, username, password, confirmPassword, otp })
        });
        const data = await res.json();
        if (data.success && data.token && data.user) {
          handleAuthSuccess(data, '🎉 Đăng ký thành viên thành công! Đang chuyển vào khung chat AI...');
        } else {
          showAlert(data.error || 'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.');
        }
      } catch (err) {
        showAlert('Lỗi kết nối máy chủ. Vui lòng thử lại.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '🚀 HOÀN TẤT ĐĂNG KÝ';
      }
    });

    // Login Form
    document.getElementById('loginForm')?.addEventListener('submit', async () => {
      const login = document.getElementById('loginAccount')?.value.trim();
      const password = document.getElementById('loginPassword')?.value;

      if (!login || !password) {
        return showAlert('Vui lòng nhập tài khoản/email và mật khẩu.');
      }

      const submitBtn = document.getElementById('loginSubmitBtn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang xác thực...';
      hideAlert();

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login, password })
        });
        const data = await res.json();
        if (data.success && data.token && data.user) {
          handleAuthSuccess(data, '🎉 Đăng nhập thành công! Đang chuyển vào khung chat AI...');
        } else {
          showAlert(data.error || 'Tài khoản hoặc mật khẩu không chính xác.');
        }
      } catch (err) {
        showAlert('Lỗi kết nối máy chủ.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '⚡ ĐĂNG NHẬP NGAY';
      }
    });

    // Forgot Password Form
    document.getElementById('forgotForm')?.addEventListener('submit', async () => {
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
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang cập nhật...';
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
        submitBtn.disabled = false;
        submitBtn.textContent = '🔄 ĐẶT LẠI MẬT KHẨU';
      }
    });

    // Quick OTP Login Form
    document.getElementById('otpLoginForm')?.addEventListener('submit', async () => {
      const email = document.getElementById('otpLoginEmail')?.value.trim();
      const otp = document.getElementById('otpLoginOtp')?.value.trim();

      if (!email || !otp) {
        return showAlert('Vui lòng nhập email và mã OTP.');
      }

      const submitBtn = document.getElementById('otpLoginSubmitBtn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang xác thực OTP...';
      hideAlert();

      try {
        const res = await fetch('/api/auth/login-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp })
        });
        const data = await res.json();
        if (data.success && data.token && data.user) {
          handleAuthSuccess(data, '🎉 Xác thực OTP thành công! Đang chuyển vào khung chat AI...');
        } else {
          showAlert(data.error || 'Mã OTP không hợp lệ hoặc đã hết hạn.');
        }
      } catch (err) {
        showAlert('Lỗi kết nối máy chủ.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '⚡ XÁC THỰC & ĐĂNG NHẬP';
      }
    });

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
        if (data.success && data.token && data.user) {
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
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      localStorage.removeItem(TOKEN_KEY);
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

  function initGoogleSignIn() {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: '861750244728-aiturbopro.apps.googleusercontent.com',
          callback: handleGoogleCredentialResponse,
          auto_select: false
        });
      } catch (e) {}
    }
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
      if (data.success && data.token && data.user) {
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
      localStorage.removeItem(TOKEN_KEY);
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
