# 🐛 WormGPT Enhanced — Linux Edition v2

A local AI chat interface powered by Ollama LLMs.  
Supports **Pop!_OS · Kali Linux · Arch Linux · Ubuntu · Debian · Fedora · Manjaro · Mint · OpenSUSE** and more.

---

## ⚡ Quick Install (One Command)

```bash
chmod +x install-linux.sh && ./install-linux.sh
```

Then launch:

```bash
./launch.sh          # ← Starts server + opens browser automatically
# or
./start.sh           # ← Server only (visit http://localhost:3001)
# or
./run-electron.sh    # ← Native desktop window (optional)
```

**URL:** `http://localhost:3001`  
**Password:** `Realnojokepplwazy1234`

---

## 🔧 What the installer does

1. Detects your distro and package manager
2. Installs Node.js 20 LTS (if not installed or too old)
3. Installs Ollama (local LLM runtime)
4. Waits for Ollama to be ready (proper readiness check)
5. Pulls `godmoded/llama3-lexi-uncensored` (~5GB model)
6. Installs all npm dependencies
7. Builds the React frontend
8. Creates a systemd user service for auto-start
9. Creates a `.desktop` file for your app launcher

---

## 🐧 Distro Notes

### Pop!_OS / Ubuntu / Kali / Linux Mint / Debian
```bash
chmod +x install-linux.sh && ./install-linux.sh
```
Uses NodeSource for Node.js 20 LTS.

### Arch Linux / Manjaro / EndeavourOS
```bash
chmod +x install-linux.sh && ./install-linux.sh
```
Uses `pacman`.

### Fedora / CentOS Stream / RHEL
```bash
chmod +x install-linux.sh && ./install-linux.sh
```
Uses `dnf`.

---

## 🚀 Launch Options

| Script | What it does |
|---|---|
| `./launch.sh` | Start server + auto-open browser (recommended) |
| `./start.sh` | Start server only — visit http://localhost:3001 |
| `./dev.sh` | Dev mode with hot-reload |
| `./run-electron.sh` | Native desktop window via Electron |

### Auto-start on login (systemd)
```bash
systemctl --user enable wormgpt
systemctl --user start wormgpt
# Check status:
systemctl --user status wormgpt
```

---

## 🤖 Changing AI Models

```bash
# Pull other models
ollama pull llama3
ollama pull mistral
ollama pull phi3
ollama pull deepseek-r1

# List installed models
ollama list
```

Then select the model in the Settings panel in the UI.

---

## 🔌 Architecture

```
wormgpt_linux/
├── install-linux.sh     ← Universal Linux installer
├── uninstall-linux.sh   ← Uninstaller
├── launch.sh            ← Start + browser (auto-created by installer)
├── start.sh             ← Start server only
├── dev.sh               ← Dev mode (hot-reload)
├── run-electron.sh      ← Native window (auto-created by installer)
├── app/                 ← React + Vite frontend
│   ├── src/App.tsx      ← All UI components (20+ features)
│   └── dist/            ← Built frontend (after install)
└── server/
    └── index.js         ← Express + WebSocket backend + Ollama proxy
```

---

## 🗑 Uninstall
```bash
./uninstall-linux.sh
```

---

## 🐛 Troubleshooting

**Port 3001 in use:**
```bash
kill $(lsof -ti:3001)
./start.sh
```

**Ollama not connecting:**
```bash
ollama serve &
curl http://localhost:11434/api/tags  # should return JSON
```

**Model not found:**
```bash
ollama pull godmoded/llama3-lexi-uncensored
```

**Frontend not loading (blank page):**
```bash
cd app && npm run build
./start.sh
```

**Node.js too old:**
```bash
./install-linux.sh  # will upgrade Node.js automatically
```
