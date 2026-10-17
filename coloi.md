# Các chức năng có lợi của module AI

## Phạm vi kiểm tra

Tài liệu này ghi lại các chức năng hữu ích được tìm thấy trong phiên bản đang hoạt động của project. Các bản trong thư mục `backups` không được xem là luồng đang chạy chính.

## 1. ThucGPT và ThucThinking Pro

### Bộ lọc an toàn

- File: `backend/thucgpt.js`
- Dòng 78: `inspectPromptSafety(prompt = '')`
- Dòng 80 trở đi: kiểm tra nội dung yêu cầu.
- Dòng 83-99: nhận diện mã độc, ransomware, keylogger, trojan, spyware và stealer.
- Dòng 102-118: nhận diện DDoS, DoS, botnet, flood và phá hoại máy chủ.
- Dòng 121-137: nhận diện phishing, hack tài khoản, đánh cắp mật khẩu và brute force.
- Dòng 140-155: nhận diện yêu cầu jailbreak hoặc bỏ qua chỉ thị an toàn.
- Dòng 158-182: nhận diện spam SMS/Call, bomber và quấy rối hàng loạt.
- Dòng 185-207: nhận diện exploit, payload, backdoor, reverse shell, C2 và cracking.

Tác dụng có lợi: giảm khả năng AI tạo ra nội dung độc hại, công cụ tấn công hoặc công cụ quấy rối.

### Chính sách hỗ trợ an toàn

- File: `backend/thucgpt.js`
- Dòng 188: `PUBLIC_SAFE_DIRECTIVE`.
- Dòng 190-195: giới hạn AI vào lập trình hợp pháp, tối ưu thuật toán và phòng thủ an ninh mạng.
- Dòng 197-204: yêu cầu không tạo file/công cụ khi yêu cầu nguy hiểm bị từ chối.

Tác dụng có lợi: định hướng model vào phát triển phần mềm, sửa lỗi, tối ưu hệ thống và defensive security.

### System prompt ThucGPT

- File: `backend/thucgpt.js`
- Dòng 241: `buildThucGptSystemPrompt(...)`.
- Dòng 246: chọn directive an toàn hoặc directive quản trị theo trạng thái phiên.
- Dòng 258-291: hỗ trợ đa ngôn ngữ Việt, Anh và Trung.
- Dòng 294-304: yêu cầu phân tích vấn đề, xử lý edge case và xuất code hoàn chỉnh.
- Dòng 323-359: quy tắc không tự ý tạo/sửa/xóa file nếu người dùng chưa yêu cầu rõ ràng.

Tác dụng có lợi: giúp AI trả lời đúng ngôn ngữ, tập trung vào lập trình và hạn chế thao tác file ngoài ý muốn.

### System prompt ThucThinking Pro

- File: `backend/thucgpt.js`
- Dòng 362: `buildThucThinkingPrompt(...)`.
- Dòng 365: chọn directive phù hợp.
- Dòng 377-401: định hướng phân tích nguyên nhân gốc, kiến trúc và giải pháp kỹ thuật.
- Dòng 403-454: quy tắc thao tác file và tạo hình ảnh tương tự module ThucGPT.

Tác dụng có lợi: hỗ trợ phân tích sâu, refactoring, debug, race condition, memory leak và thiết kế kiến trúc.

## 2. Backend bảo vệ và điều phối

### Giới hạn tốc độ

- File: `backend/server.js`
- Dòng 408-410: cấu hình rate limit 12 tin/phút cho khách.
- Dòng 412: `checkRateLimit(ip)`.
- Dòng 423-430: từ chối request vượt giới hạn và trả thời gian chờ.

Tác dụng có lợi: chống flood request, giảm tải model và bảo vệ tài nguyên server.

### Phiên quản trị ứng dụng

- File: `backend/server.js`
- Dòng 504: `isCreatorRequest(req)`.
- Dòng 534: `requireCreatorAuth(req, res, next)`.
- Dòng 535-542: chỉ cho phép endpoint quản trị khi xác thực hợp lệ.

Tác dụng có lợi: tách người dùng thông thường khỏi chức năng quản trị workspace.

### Chống flood nhiều tầng

- File: `backend/server.js`
- Dòng 676-682: bảo vệ endpoint xác thực/OTP.
- Dòng 685-690: bảo vệ endpoint chat và image.
- Dòng 693-698: bảo vệ API toàn cục.
- Dòng 703-707: endpoint xem thống kê bảo mật.

- File: `backend/anti-req.js`
- Dòng 198: `antiReqAuth`.
- Dòng 199: `antiReqAi`.
- Dòng 200: `antiReqGlobal`.

Tác dụng có lợi: hạn chế spam OTP, bot chat, request flood và tiêu hao tài nguyên.

### Chọn provider AI

- File: `backend/server.js`
- Dòng 729: `normalizeProvider(provider)`.
- Dòng 731: danh sách provider hợp lệ gồm DeepSeek, Ollama, Groq, OpenAI, Gemini, ThucGPT và ThucThinking.
- Dòng 789: `callGemini(...)`.
- Dòng 949: `callOpenAICompatible(...)`.
- Dòng 1606-1689: gọi provider tương ứng cho vision, ThucThinking và ThucGPT.

Tác dụng có lợi: cho phép chuyển giữa nhiều model/provider tùy nhu cầu, chi phí, tốc độ và khả năng vision.

### Giới hạn file được chạy

- File: `backend/server.js`
- Dòng 222: `runCommand(...)`.
- Dòng 225-229: timeout, giới hạn output và chạy trong workspace.
- Dòng 269: `getRunnableFile(filePath)`.
- Dòng 274-276: chỉ cho phép file `.js`, `.mjs`, `.cjs` và `.py` trong workspace.
- Dòng 1316: endpoint `/api/execute` yêu cầu creator auth.
- Dòng 1370: endpoint `/api/workspace/test` yêu cầu creator auth.

Tác dụng có lợi: hỗ trợ chạy test và kiểm tra code, đồng thời giảm việc chạy nhầm file ngoài phạm vi dự án.

### Lọc phản hồi nguy hiểm

- File: `backend/server.js`
- Dòng 1390: `sanitizeNonCreatorOutput(...)`.
- Dòng 1394-1400: phát hiện phản hồi từ chối hoặc nội dung nguy hiểm và loại bỏ thẻ tạo file.
- Dòng 1404: `shouldAllowFileWriteTags(...)`.
- Dòng 1408-1415: chỉ cho phép thẻ ghi file khi yêu cầu có hành động và mục tiêu file/workspace rõ ràng.

Tác dụng có lợi: giảm nguy cơ model tự ý tạo hoặc sửa file khi người dùng chỉ hỏi lý thuyết.

### Bộ điều phối chat

- File: `backend/server.js`
- Dòng 1427: `handleChatExecution(...)`.
- Dòng 1452: tính quyền creator hiệu lực.
- Dòng 1549: rate limit chỉ được áp dụng cho phiên không có quyền creator.
- Dòng 1563: kiểm tra safety prompt.
- Dòng 1631-1658: xử lý ThucThinking Pro và fallback provider.
- Dòng 1662-1689: xử lý ThucGPT và fallback provider.

Tác dụng có lợi: gom xác thực, safety check, rate limit, vision và gọi model vào một luồng xử lý thống nhất.

## 3. Frontend hỗ trợ người dùng

### Chọn model/provider

- File: `frontend/app.js`
- Dòng 86: lưu provider hiện tại.
- Dòng 132: `PROVIDER_LABELS`.
- Dòng 134-135: hiển thị ThucGPT và ThucThinking Pro.
- Dòng 154: `applyProvider(provider)`.
- Dòng 155-182: lưu lựa chọn và cập nhật trạng thái giao diện.

Tác dụng có lợi: người dùng dễ chuyển giữa các AI/provider.

### Xác thực creator

- File: `frontend/app.js`
- Dòng 85-91: quản lý trạng thái key.
- Dòng 98-106: gắn thông tin xác thực vào request API.
- Dòng 1180-1193: gọi endpoint xác thực và cập nhật trạng thái giao diện.
- Dòng 1750-1767: nhận diện mã và gửi tới backend xác minh.

Tác dụng có lợi: hỗ trợ chủ project truy cập các tính năng quản trị được bảo vệ ở backend.

### Chat streaming và lịch sử

- File: `frontend/app.js`
- Dòng 1857: gọi `/api/chat/stream`.
- Dòng 1860-1870: gửi message, history, provider, image, mode và thông tin xác thực.
- Dòng 1875 trở đi: đọc stream và cập nhật phản hồi theo thời gian thực.
- Các phần quản lý session/lịch sử ở khoảng dòng 250-520: lưu và khôi phục cuộc trò chuyện.

Tác dụng có lợi: phản hồi nhanh, giữ ngữ cảnh hội thoại và hỗ trợ phân tích hình ảnh.

### Kiểm soát thao tác file ở giao diện

- File: `frontend/app.js`
- Dòng 1270: bộ xử lý Markdown và syntax.
- Dòng 1294-1295: nhận diện thẻ `FILE_DELETE`.
- Dòng 1372-1380: hạ cấp hoặc hiển thị thẻ `FILE_WRITE` tùy việc người dùng có yêu cầu rõ ràng hay không.
- Sau khi nhận phản hồi chat: chỉ gọi thao tác ghi/xóa khi request hiện tại có yêu cầu tương ứng.

Tác dụng có lợi: tránh để câu trả lời code thông thường bị hiểu nhầm là lệnh sửa file.

## 4. Quản lý bypass tạm thời

- File: `backend/key-manager.js`
- Dòng 83: `generateBypassKey(...)` tạo key có thời hạn.
- Dòng 111: `validateBypassKey(...)` kiểm tra key.
- Dòng 130-155: kiểm tra key tồn tại, chưa hết hạn và trả thời gian còn lại.

Tác dụng có lợi: có thể cấp quyền tạm thời thay vì dùng quyền vĩnh viễn.

## 5. Kết luận về các chức năng có lợi

Các chức năng có lợi nhất của hệ thống là:

1. Hỗ trợ lập trình, debug, refactoring và tối ưu thuật toán.
2. Hỗ trợ ThucGPT và ThucThinking Pro qua nhiều provider model.
3. Hỗ trợ streaming, lịch sử chat, đa ngôn ngữ và vision.
4. Có firewall nhận diện nhiều nhóm yêu cầu nguy hiểm.
5. Có rate limit và anti-request defense.
6. Có giới hạn file chạy và timeout.
7. Có kiểm soát việc tạo/sửa/xóa file theo yêu cầu rõ ràng.
8. Có key tạm thời và creator authentication cho chức năng quản trị.

Các dòng trong tài liệu là số dòng của phiên bản file được kiểm tra tại thời điểm lập tài liệu. Đây là mô tả kỹ thuật, không phải chứng nhận an toàn hoặc chứng nhận pháp lý.
