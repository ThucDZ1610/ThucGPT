const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const url = 'http://localhost:3000';
const backendDir = path.resolve(__dirname, '../backend');
const backendEntry = path.join(backendDir, 'server.js');

function isChromeRunning() {
  return new Promise((resolve) => {
    execFile('tasklist', ['/FI', 'IMAGENAME eq chrome.exe', '/NH'], { windowsHide: true }, (error, stdout = '') => {
      if (error) return resolve(false);
      resolve(/chrome\.exe\s+/i.test(stdout));
    });
  });
}

async function openBrowser() {
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Users\\%USERNAME%\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  ];

  const resolvedChromePath = chromePaths
    .map((chromePath) => chromePath.replace('%USERNAME%', process.env.USERNAME || ''))
    .find((chromePath) => fs.existsSync(chromePath));

  if (resolvedChromePath) {
    const chromeRunning = await isChromeRunning();
    const result = spawn(resolvedChromePath, [url], { stdio: 'ignore', detached: true });
    result.unref();
    console.log(chromeRunning
      ? 'Chrome đang chạy: đã mở ứng dụng trong tab mới.'
      : 'Chrome chưa chạy: đã khởi động Chrome và mở ứng dụng.');
    return true;
  }

  try {
    spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true }).unref();
    return true;
  } catch (error) {
    return false;
  }
}

const isLive = () => {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get(url, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode === 200));
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
};

function startBackendIfNeeded() {
  try {
    const child = spawn(process.execPath, [backendEntry], {
      cwd: backendDir,
      stdio: 'ignore',
      detached: true,
    });
    child.unref();
    return true;
  } catch (error) {
    return false;
  }
}

(async () => {
  let serverReady = await isLive();

  if (!serverReady) {
    console.log('Backend chưa chạy. Đang khởi động backend trước...');
    startBackendIfNeeded();

    for (let i = 0; i < 30; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      serverReady = await isLive();
      if (serverReady) break;
    }
  }

  if (!serverReady) {
    console.log('Backend chưa sẵn sàng trên http://localhost:3000');
    console.log('Hãy chạy thủ công:');
    console.log('cd ..');
    console.log('cd backend');
    console.log('npm install');
    console.log('npm start');
    console.log('Script frontend sẽ giữ cửa sổ này mở để bạn xem hướng dẫn.');
    setInterval(() => {}, 60000);
    return;
  }

  console.log(`Đang mở trình duyệt: ${url}`);
  await openBrowser();
  console.log('Ứng dụng đã mở. Nhấn Ctrl+C để đóng terminal.');
  setInterval(() => {}, 60000);
})();
