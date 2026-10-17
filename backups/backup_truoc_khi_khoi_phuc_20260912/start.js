const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const url = 'http://localhost:3000';
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
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;

      const req = http.get(`${url}/api/health`, (res) => {
        res.resume();
        res.on('end', () => {
          clearInterval(timer);
          resolve();
        });
      });

      req.on('error', () => {
        if (attempts >= 30) {
          clearInterval(timer);
          reject(new Error('Server failed to start in time.'));
        }
      });
    }, 500);
  });
}

const child = spawn(process.execPath, [serverScript], {
  stdio: 'inherit',
});

child.on('exit', (code) => {
  console.log(`Backend process exited with code ${code}`);
  process.exit(code ?? 0);
});

waitForServer()
  .then(() => {
    console.log(`Opening browser: ${url}`);
    openBrowser();
  })
  .catch((error) => {
    console.error(error.message);
    child.kill('SIGTERM');
    process.exit(1);
  });
