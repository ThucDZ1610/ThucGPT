(function () {
  'use strict';

  const blockedKeys = new Set(['F12', 'u', 's']);
  let overlay = null;
  let locked = false;

  document.addEventListener('contextmenu', (event) => event.preventDefault(), true);
  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    const developerShortcut = event.key === 'F12'
      || ((event.ctrlKey || event.metaKey) && blockedKeys.has(key))
      || ((event.ctrlKey || event.metaKey) && event.shiftKey && ['i', 'j', 'c'].includes(key));
    if (developerShortcut) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  function setLocked(value) {
    if (locked === value) return;
    locked = value;
    if (value) {
      overlay = document.createElement('div');
      overlay.setAttribute('role', 'alert');
      overlay.textContent = 'Đã phát hiện công cụ kiểm tra trình duyệt. Hãy đóng DevTools để tiếp tục.';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:#090e17;color:#fff;font:600 18px/1.5 sans-serif;text-align:center';
      document.body.appendChild(overlay);
    } else {
      overlay?.remove();
      overlay = null;
    }
  }

  function checkWindowSize() {
    const widthGap = window.outerWidth - window.innerWidth;
    const heightGap = window.outerHeight - window.innerHeight;
    setLocked(widthGap > 160 || heightGap > 160);
  }

  window.addEventListener('resize', checkWindowSize);
  window.setInterval(checkWindowSize, 1000);
  checkWindowSize();
})();