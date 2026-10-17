# AI Chat Website with API Key

Dự án này đã tách thành 2 phần rõ ràng:
- Backend: `backend/server.js`
- Frontend: `frontend/index.html`, `frontend/styles.css`, `frontend/app.js`
- AI provider: OpenAI hoặc Gemini/Google AI

## Cài đặt

```bash
cd backend
npm install
```

## Cấu hình

1. Copy file `.env.example` trong `backend` thành `.env`
2. Chọn provider phù hợp với khóa API bạn có

### Nếu dùng Gemini/Google AI

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash
PORT=3000
```

### Nếu dùng OpenAI

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
PORT=3000
```

### Nếu dùng Ollama chạy cục bộ

Cài Ollama, sau đó tải hai model phù hợp:

```bash
```

Trong `backend/.env`:

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
OLLAMA_MODEL=qwen2.5-coder:3b
OLLAMA_KEEP_ALIVE=30m
OLLAMA_NUM_CTX=4096
OLLAMA_NUM_THREADS=12
PORT=3000
```

Ollama phải đang chạy trước khi gửi yêu cầu. Model vision cần đủ VRAM/RAM; có thể thay bằng model vision khác mà Ollama hỗ trợ.

### Nếu dùng DeepSeek

Trong `backend/.env`:

```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_MODEL=deepseek-chat
PORT=3000
```

DeepSeek dùng cho chat và lập trình. Ứng dụng hiện không bật chức năng phân tích hình ảnh.

## Chạy ứng dụng

```bash
cd backend
npm start
```

Sau đó mở trình duyệt và vào:

```text
http://localhost:3000
```

Backend sẽ phục vụ frontend từ thư mục `frontend` cho bạn xem trực tiếp.

## Tính năng

- Giao diện chat đẹp
- Gửi tin nhắn lên backend
- Backend gọi AI provider để trả lời
- Có thể tùy chỉnh giao diện và logic dễ dàng

## Lưu ý

- Không commit file `.env` lên Git
- Dự án hiện đang chạy theo mô hình 1 backend + 1 frontend, nhưng frontend vẫn được serve từ chính backend để bạn mở ngay trên localhost
