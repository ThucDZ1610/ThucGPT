# Phân tích cấu trúc WormGPT Enhanced

## Phạm vi

Tài liệu này ghi lại toàn bộ nội dung đã phân tích trong cuộc trao đổi, tập trung vào project đang mở:

```text
WormGPTForLinux/wormgpt_linux_v2/
```

Project có ba bản triển khai gần như song song:

- `wormgpt_enhanced/`: bản gốc ở workspace root.
- `WormGPTForLinux/wormgpt_linux_v2/`: bản Linux mới nhất và đầy đủ nhất.
- `WormgptWindowsEdition/wormgpt_enhanced/`: bản Windows, có cấu trúc tương tự nhưng backend cũ hơn.

## Cấu trúc tổng quát

Mỗi bản triển khai gồm:

```text
wormgpt_linux_v2/
├── app/
│   ├── public/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── App.css
│   │   ├── index.css
│   │   ├── main.tsx
│   │   ├── components/ui/
│   │   ├── hooks/
│   │   └── lib/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig*.json
├── server/
│   ├── index.js
│   └── package.json
├── install-linux.sh
├── install.sh
├── start.sh
├── launch.sh
├── dev.sh
├── uninstall-linux.sh
└── README*.md
```

### Frontend

Frontend dùng React, TypeScript, Vite, Tailwind CSS, Radix UI và Lucide icons. Phần lớn UI và logic được tập trung trong `app/src/App.tsx`.

Các tính năng được triển khai trong frontend gồm:

- Chat interface.
- Password screen.
- Terminal panel.
- Chạy code Python, JavaScript và Bash.
- Live HTML preview.
- Website builder.
- Artifact viewer.
- Project editor.
- Knowledge base/RAG đơn giản phía client.
- Mermaid diagram renderer.
- Git panel.
- Mind map.
- Command palette.
- Multi-model variants.
- Session persistence.
- Theme và settings.

Các component trong `app/src/components/ui/` chủ yếu là các component giao diện dùng lại theo Radix/shadcn-style.

### Backend

`server/index.js` là trung tâm hệ thống. Nó tạo một HTTP server duy nhất, bên trong có:

```text
HTTP server :3001
├── Express REST API
├── Static frontend server
└── WebSocket server
```

Backend dùng các thư viện chính:

- `express`: HTTP API.
- `cors`: CORS middleware.
- `ws`: WebSocket.
- `multer`: upload file.
- `adm-zip`: đọc ZIP.
- `simple-git`: thao tác Git.
- Node.js built-in `fetch`, `child_process`, `fs`, `path`, `os`.

## Luồng khởi động

1. `install-linux.sh` kiểm tra hoặc cài Node.js, Ollama và các dependency.
2. Frontend được build thành `app/dist`.
3. Backend chạy bằng Node.js từ thư mục `server`.
4. Backend lắng nghe cổng `3001`.
5. Ollama mặc định chạy tại `http://localhost:11434`.
6. Production backend phục vụ trực tiếp frontend trong `app/dist`.
7. Development dùng Vite tại cổng `5173`, proxy `/api` sang `http://localhost:3001`.

`start.sh` tự kiểm tra frontend build, cài server dependency nếu thiếu, khởi động Ollama nếu có và chạy backend.

`launch.sh` chạy server nền, chờ cổng `3001` sẵn sàng rồi mở trình duyệt.

`dev.sh` chạy backend với `node --watch` và frontend bằng Vite dev server.

## Khởi tạo trong `server/index.js`

Backend thực hiện các bước chính:

- Tạo Express app.
- Tạo HTTP server bằng `createServer(app)`.
- Gắn `WebSocketServer` vào HTTP server.
- Cho phép CORS từ mọi origin.
- Nhận JSON body tối đa `50 MB`.
- Nhận file upload tối đa `100 MB` và giữ trong memory.
- Kiểm tra Ollama ban đầu và định kỳ mỗi 10 giây.
- Phục vụ static frontend nếu `app/dist` tồn tại.
- Lắng nghe trên `PORT`, mặc định là `3001`.

## Các tuyến REST API

| Method | Route | Chức năng |
|---|---|---|
| `POST` | `/api/chat` | Proxy chat request tới Ollama |
| `GET` | `/api/ollama/status` | Kiểm tra trạng thái Ollama |
| `GET` | `/api/ollama/models` | Lấy danh sách model Ollama |
| `POST` | `/api/ollama/pull` | Tải model Ollama và stream tiến độ |
| `POST` | `/api/project/upload` | Đọc file hoặc ZIP và trả nội dung |
| `POST` | `/api/save-file` | Ghi nội dung vào đường dẫn file được gửi lên |
| `POST` | `/api/git/status` | Lấy trạng thái Git |
| `POST` | `/api/git/diff` | Lấy Git diff |
| `POST` | `/api/git/commit` | Stage và commit file |
| `POST` | `/api/git/branch` | Tạo local branch mới |

### `POST /api/chat`

Frontend gửi các trường:

- `messages`.
- `model`.
- `temperature`.
- `stream`.
- `ollamaUrl`.

Backend chuyển tiếp request tới:

```text
{ollamaUrl}/api/chat
```

Nếu không chỉ định URL, mặc định là:

```text
http://localhost:11434
```

Model mặc định:

```text
godmoded/llama3-lexi-uncensored
```

Khi `stream !== false`, backend chuyển dữ liệu streaming của Ollama thành Server-Sent Events:

```text
data: {...}

data: [DONE]
```

Bản Linux có timeout 180 giây, hỗ trợ hủy request khi client đóng kết nối và trả HTTP `408` khi request bị timeout.

### Ollama status và models

`/api/ollama/status` gọi `/api/tags` của Ollama và trả về trạng thái kết nối.

`/api/ollama/models` cũng gọi `/api/tags`, sau đó trả danh sách model. Bản Linux dùng timeout riêng khoảng 5 giây cho request này.

Backend giữ trạng thái:

```text
ollamaHealthy
ollamaBaseUrl
```

Health-check được gọi lúc khởi động và lặp lại sau mỗi 10 giây.

### `POST /api/ollama/pull`

Nhận tên model, gọi endpoint `/api/pull` của Ollama và forward tiến độ theo SSE cho frontend.

### `POST /api/project/upload`

Nhận multipart field tên `file`.

- File thường được đọc thành text.
- File ZIP được đọc trong memory bằng `AdmZip`.
- Các file text được trả về với tên, nội dung và type `text`.
- File nhị phân được biểu diễn bằng chuỗi `[binary: extension]`.
- ZIP không được ghi trực tiếp xuống disk.

### `POST /api/save-file`

Nhận `path` và `content`, sau đó gọi `fsp.writeFile` để ghi file.

### Git API

Git backend dùng `simple-git`.

- `status`: trả trạng thái repository.
- `diff`: trả diff toàn repository hoặc một file.
- `commit`: stage file chỉ định hoặc toàn bộ repository rồi commit.
- `branch`: tạo local branch mới.

`repoPath` được nhận từ request client. Nếu path không hợp lệ, bản Linux fallback về thư mục hiện tại của process.

## WebSocket

WebSocket dùng chung cổng `3001` với HTTP server.

Frontend kết nối tới URL được xây dựng từ host hiện tại:

- Development: backend ở cổng `3001`.
- Production: WebSocket cùng host/cổng với trang hiện tại.

### Message type `run_code`

Hỗ trợ:

- `python` hoặc `py`.
- `javascript` hoặc `js`.
- `bash` hoặc `sh`.

Code được ghi vào thư mục tạm `/tmp/wgpt-*`, sau đó chạy bằng `spawn` thông qua `sh -c`.

Server stream các message về client:

```text
start
stdout
stderr
exit
```

Khi process kết thúc, thư mục tạm được xóa.

### Message type `shell`

Client gửi:

```json
{
  "type": "shell",
  "command": "...",
  "cwd": "..."
}
```

Server chạy command bằng:

```text
sh -c <command>
```

Process sử dụng environment của Node.js và thư mục làm việc do client cung cấp nếu thư mục tồn tại.

### Message type `kill`

Server gửi `SIGTERM` cho process hiện tại.

Khi WebSocket đóng hoặc gặp lỗi, process đang chạy cũng được terminate.

## Kết nối frontend/backend

Trong Linux `App.tsx` có hai URL chính:

```text
SERVER_URL
WS_URL
```

Các call site chính:

- `POST /api/chat` cho chat streaming.
- `POST /api/chat` với `stream: false` cho summary và multi-model variants.
- `GET /api/ollama/status`.
- `GET /api/ollama/models`.
- `POST /api/project/upload`.
- `POST /api/git/status`.
- `POST /api/git/diff`.
- `POST /api/git/commit`.
- `POST /api/git/branch`.
- WebSocket cho terminal và code runner.

Frontend xây dựng context chat gồm system prompt, các message gần đây, conversation summary và một phần knowledge base.

## Khác biệt giữa ba phiên bản

### Bản Linux

Bản Linux là bản hoàn thiện nhất:

- Có Ollama health-check.
- Có model pull.
- Có timeout cho các request quan trọng.
- Có graceful shutdown.
- Có xử lý `uncaughtException` và `unhandledRejection`.
- Có fallback HTML khi frontend chưa build.
- Bind rõ ràng trên `0.0.0.0`.
- Có `safeSend` để tránh gửi WebSocket khi socket đã đóng.

### Bản Windows và bản gốc

Hai bản này có cấu trúc và UI tương tự nhưng backend đơn giản hơn:

- Không có endpoint pull model.
- Ít timeout hơn.
- Không có graceful shutdown đầy đủ.
- Xử lý WebSocket và lỗi process cơ bản hơn.
- Vẫn chạy shell bằng `sh`, nên không thật sự thuần Windows.

## Rủi ro kỹ thuật

1. **Backend không có xác thực thật sự**

   Password được hardcode trong frontend. Người dùng có thể bypass màn hình password và gọi API trực tiếp.

2. **WebSocket cho phép thực thi lệnh hệ thống**

   Các message `shell` và `run_code` có thể chạy lệnh với quyền của user đang chạy Node.js.

3. **CORS mở toàn bộ**

   Backend cho phép request từ mọi origin bằng `origin: '*'`.

4. **Có thể ghi file tùy ý**

   `/api/save-file` nhận đường dẫn từ client và ghi trực tiếp bằng `writeFile`.

5. **Git path do client kiểm soát**

   Client có thể yêu cầu thao tác trên repository bất kỳ mà process có quyền truy cập.

6. **Bind trên toàn bộ interface mạng**

   Bản Linux dùng `0.0.0.0`. Nếu firewall không chặn, service có thể bị truy cập từ mạng LAN.

7. **`ollamaUrl` do client cung cấp**

   Nếu expose service ra ngoài, tham số này có thể bị lợi dụng để gửi request tới địa chỉ nội bộ khác.

8. **SSE parser có thể mất dữ liệu**

   Backend tách dữ liệu theo từng network chunk. Một JSON line bị chia giữa hai chunk có thể bị bỏ qua.

9. **Upload giữ file trong memory**

   File upload tối đa 100 MB và ZIP được xử lý trong memory, có thể gây áp lực bộ nhớ.

10. **Import chưa sử dụng**

    `exec` và `execAsync` được import trong `server/index.js` nhưng không được dùng.

## Kết luận

Đây là ứng dụng React/Express chạy local, trong đó `server/index.js` đồng thời là:

- API gateway tới Ollama.
- Chat streaming server.
- Terminal backend.
- Code execution backend.
- File upload và file write service.
- Git service.
- Static frontend server.
- WebSocket server.

Thiết kế hiện tại phù hợp với môi trường local đáng tin cậy. Không nên expose trực tiếp ra Internet hoặc mạng không tin cậy nếu chưa bổ sung authentication, authorization, giới hạn command execution, sandbox process, giới hạn path, kiểm soát CORS và bảo vệ các endpoint Git/file/Ollama.
