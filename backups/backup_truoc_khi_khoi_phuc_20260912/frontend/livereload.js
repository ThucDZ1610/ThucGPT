/**
 * AI TURBO PRO • REALTIME LIVE RELOAD CLIENT (WebSocket & SSE)
 * Tự động cập nhật và reload giao diện thời gian thực khi sửa mã nguồn
 * Tương thích cả Localhost và Hosting Web (Render, VPS, Cloudflare, Railway)
 */
(function () {
  'use strict';

  let socket = null;
  let sseSource = null;
  let reconnectTimer = null;
  let isReloading = false;

  function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      socket = new WebSocket(wsUrl);

      socket.onopen = function () {
        console.log('%c⚡ [Realtime LiveReload] Đã kết nối WebSocket thời gian thực!', 'color: #00f0ff; font-weight: bold;');
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      };

      socket.onmessage = function (event) {
        try {
          const data = JSON.parse(event.data);
          handleRealtimeMessage(data);
        } catch (e) {}
      };

      socket.onclose = function () {
        scheduleReconnect();
      };

      socket.onerror = function () {
        tryFallbackSSE();
      };
    } catch (err) {
      tryFallbackSSE();
    }
  }

  function tryFallbackSSE() {
    if (sseSource) return;
    try {
      sseSource = new EventSource('/api/realtime/events');
      sseSource.onopen = function () {
        console.log('%c⚡ [Realtime LiveReload] Đã kết nối kênh dự phòng SSE!', 'color: #34d399; font-weight: bold;');
      };
      sseSource.onmessage = function (event) {
        try {
          const data = JSON.parse(event.data);
          handleRealtimeMessage(data);
        } catch (e) {}
      };
      sseSource.onerror = function () {
        if (sseSource) {
          sseSource.close();
          sseSource = null;
        }
        scheduleReconnect();
      };
    } catch (e) {
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 2000);
  }

  function handleRealtimeMessage(data) {
    if (!data || isReloading) return;

    if (data.type === 'reload') {
      if (data.isCss) {
        const links = document.querySelectorAll('link[rel="stylesheet"]');
        links.forEach((link) => {
          const href = link.href.split('?')[0];
          link.href = href + '?reload=' + Date.now();
        });
        console.log(`%c🎨 [Realtime CSS] Đã cập nhật stylesheet (${data.file}) tức thì!`, 'color: #eab308;');
      } else {
        isReloading = true;
        console.log(`%c🔄 [Realtime LiveReload] Phát hiện sửa đổi (${data.file}) -> Đang tải lại trang...`, 'color: #00f0ff; font-weight: bold;');
        showReloadBadge(data.file);
        setTimeout(() => {
          window.location.reload();
        }, 300);
      }
    }
  }

  function showReloadBadge(file) {
    let badge = document.getElementById('aiRealtimeReloadBadge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'aiRealtimeReloadBadge';
      badge.style.cssText = `
        position: fixed;
        bottom: 16px;
        right: 16px;
        background: rgba(15, 23, 42, 0.95);
        color: #00f0ff;
        border: 1px solid #00f0ff;
        border-radius: 8px;
        padding: 8px 14px;
        font-family: monospace;
        font-size: 12px;
        box-shadow: 0 4px 20px rgba(0, 240, 255, 0.4);
        z-index: 999999;
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      document.body.appendChild(badge);
    }
    badge.innerHTML = `<span>⚡</span> <span>Đang cập nhật mã nguồn (<strong>${file || 'code'}</strong>)...</span>`;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connect);
  } else {
    connect();
  }
})();
