const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 3000;
const url = `http://localhost:${PORT}`;
const serverScript = path.join(__dirname, 'backend', 'server.js');

function openBrowser() {
  if (process.platform === 'win32') {
    spawn('powershell', ['-NoProfile', '-Command', `Start-Process "${url}"`], {
      stdio: 'ignore',
      detached: true,
    }).unref();
    return;
  }

  if (process.platform === 'darwin') {
    spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
    return;
  }

  spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
}

function waitForServer() {
  return new Promise((resolve) => {
    let attempts = 0;
    let opened = false;
    const timer = setInterval(() => {
      attempts += 1;

      // Ưu tiên dùng 127.0.0.1 để tránh trễ phân giải IPv6 trên Windows
      const req = http.get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
        if (!opened && res.statusCode === 200) {
          opened = true;
          clearInterval(timer);
          resolve(true);
        }
        res.resume();
      });

      req.on('error', () => {
        // Sau 30 lần thử (15 giây) nếu chưa kết nối được, KHÔNG được tắt backend, chỉ thông báo
        if (attempts >= 30) {
          clearInterval(timer);
          resolve(false);
        }
      });

      req.setTimeout(1000, () => {
        req.destroy();
      });
    }, 500);
  });
}

console.log('🚀 Đang khởi động AI Turbo Pro...');

const child = spawn(process.execPath, [serverScript], {
  stdio: 'inherit',
  cwd: path.join(__dirname, 'backend'),
});

child.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.log(`[Start] Backend đã dừng (mã thoát: ${code})`);
  }
  process.exit(code ?? 0);
});

// Chuyển tiếp tín hiệu tắt Ctrl+C để giải phóng cổng ngay lập tức
const cleanShutdown = () => {
  try {
    child.kill('SIGINT');
  } catch (e) {}
  setTimeout(() => process.exit(0), 500);
};

process.on('SIGINT', cleanShutdown);
process.on('SIGTERM', cleanShutdown);

waitForServer().then((isReady) => {
  if (isReady) {
    console.log(`\n🌐 Đang mở giao diện trên trình duyệt: ${url}`);
    openBrowser();
  } else {
    console.log(`\n💡 Máy chủ đang chạy tại: ${url} (Bạn có thể mở link này trên trình duyệt)`);
  }
});
