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

## Cấu hình bảo mật khi triển khai

- Đặt `CREATOR_PASSCODE` thành bí mật ngẫu nhiên tối thiểu 32 byte qua secret store/biến môi trường. Mẫu `.env.example` để trống; các mã quản trị cũ nhúng trong mã nguồn không còn được chấp nhận.
- Chạy sau reverse proxy có TLS khi công khai Internet; giới hạn egress bằng firewall của hệ điều hành/nền tảng triển khai và chạy Node.js bằng tài khoản không đặc quyền. Các quyền này không thể được bảo đảm chỉ bằng cấu hình JavaScript.
- Các tệp JS/CSS cùng nguồn được gắn SRI trong bản `npm run build`. Tài nguyên CDN có nội dung thay đổi theo nhà cung cấp không được ghim bằng hash cố định để tránh làm hỏng đăng nhập khi họ cập nhật.
- API chat chỉ chấp nhận lịch sử có role `user`/`assistant`, giới hạn kích thước cấu trúc DTO và quota tối đa 5 tác vụ/phút, 1 tác vụ đồng thời trên mỗi tài khoản. Bộ đếm chạy trong RAM của tiến trình; triển khai nhiều worker/replica cần một kho giới hạn dùng chung để có quota toàn cụm.
- AES/HMAC/DPoP bí mật phía trình duyệt, WASM, fingerprinting, PoW và jitter không thể thay thế TLS hoặc xác thực/giới hạn phía máy chủ: mã và khóa phía client đều có thể bị xem hoặc giả lập. Ứng dụng không sử dụng chúng như ranh giới bảo mật.
