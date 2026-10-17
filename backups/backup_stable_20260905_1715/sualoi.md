# Tổng Hợp Sửa Lỗi AI Turbo Pro

**Ngày:** 2026-09-05

## Mục Tiêu

- AI mặc định chỉ trả code, không tự tạo hoặc ghi file vào project.
- Chỉ tạo hoặc ghi file khi người dùng yêu cầu rõ ràng.
- Nếu yêu cầu ghi file nhưng thiếu tên hoặc đường dẫn, AI phải hỏi lại.

## Yêu Cầu Đã Thống Nhất

- Viết code thông thường: chỉ hiển thị code.
- Phân tích lỗi: chỉ đưa nguyên nhân và code sửa.
- Tạo file, lưu file, ghi file, cập nhật file hoặc tạo thư mục: chỉ thực hiện khi người dùng nói rõ.
- Không tự chọn `workspace` làm nơi lưu nếu người dùng chưa chỉ định.

## Nguyên Nhân Lỗi

1. `backend/thucgpt.js` từng bắt AI luôn sinh thẻ `FILE_WRITE` và `FOLDER_CREATE`.
2. `backend/server.js` từng hướng dẫn tự động lưu vào workspace khi người dùng không nêu đường dẫn.
3. `frontend/app.js` tự động gọi API ghi file khi phát hiện thẻ `FILE_WRITE`.
4. Có thời điểm file trong editor và file Node đang nạp không đồng bộ.

## Các File Đã Sửa

### `backend/thucgpt.js`

- Thêm `FILE_WRITE_POLICY` ở cuối system prompt.
- Mặc định chỉ trả code trong Markdown.
- Không tự tạo, sửa, lưu hoặc ghi file.
- Chỉ cho phép thẻ `FILE_WRITE` và `FOLDER_CREATE` khi người dùng yêu cầu rõ.
- Nếu thiếu tên hoặc đường dẫn file thì phải hỏi lại.
- Phân tích ảnh lỗi cũng không tự động ghi file.

### `backend/server.js`

- Bỏ quy tắc tự động lưu vào workspace khi người dùng không chỉ định nơi lưu.
- Chỉ sinh hướng dẫn `FILE_WRITE` khi người dùng đồng thời yêu cầu ghi hoặc sửa file.
- Khi không có yêu cầu ghi file, AI chỉ cung cấp code Markdown.

### `frontend/app.js`

- Thêm hàm `shouldWriteFilesForRequest(message)`.
- Chỉ gọi `scanAndApplyAiFileWrites()` khi tin nhắn hiện tại có ý định ghi file rõ ràng.
- Không tự động ghi file khi AI chỉ trả code thông thường.
- Đổi prompt phân tích ảnh thành chỉ cung cấp code để xem.

## Ví Dụ Không Được Ghi File

- “Viết code Python cho tôi.”
- “Cho tôi code HTML.”
- “Sửa đoạn code này.”
- “Phân tích lỗi này.”

## Ví Dụ Được Phép Ghi File

- “Tạo file `src/app.js` và lưu code vào đó.”
- “Ghi code vào `workspace/index.html`.”
- “Sửa file `backend/server.js`.”
- “Tạo thư mục `frontend/components`.”

## Kiểm Tra Đã Thực Hiện

```powershell
node --check backend/thucgpt.js
node --check backend/server.js
node --check frontend/app.js
```

Các file JavaScript chính đã kiểm tra cú pháp thành công.

## Kết Luận

Hành vi mới của AI là:

> Không tự ghi file. Chỉ ghi file khi người dùng yêu cầu rõ ràng và cung cấp tên hoặc đường dẫn phù hợp.
