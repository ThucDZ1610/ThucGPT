# 📘 CẨM NANG TOÀN TẬP: CÁCH CHẠY VÀ PHÁT TRIỂN ZALO BOT

Sau khi phân tích toàn bộ mã nguồn tại `E:\Downloads\bot`, tôi nhận thấy đây là một hệ thống **Zalo Bot được viết bằng ngôn ngữ Python** (cụ thể là sử dụng thư viện `zlapi` tự phát triển để tương tác với Zalo). Nó hoạt động theo nguyên lý tương tự như Bot Messenger (Mirai) nhưng dành cho Zalo.

Dưới đây là cẩm nang chi tiết nhất để bạn làm chủ dự án Zalo Bot này:

---

## PHẦN 1: TỔNG QUAN VỀ DỰ ÁN ZALO BOT (PYTHON)

- **Ngôn ngữ**: Python (khác với Node.js của Messenger Bot).
- **Cách thức hoạt động**: Dùng Cookie, IMEI và User-Agent của tài khoản Zalo Web (chat.zalo.me) để đăng nhập ẩn danh vào hệ thống Zalo.
- **Tính năng**: Có thể vào các nhóm chat Zalo, gửi tin nhắn, tag tên, lấy dữ liệu... Các lệnh được chia nhỏ (như `sms.py`, `tele.py`, `locket.py`, `boty.py`).

---

## PHẦN 2: CHUẨN BỊ MÔI TRƯỜNG & CÔNG CỤ (RẤT QUAN TRỌNG)

1. **Cài đặt Python**: 
   - Tải [Python](https://www.python.org/downloads/) (khuyên dùng bản **3.9** đến **3.11**).
   - ⚠️ **Đặc biệt lưu ý**: Lúc cài đặt, ở màn hình đầu tiên, **BẮT BUỘC** phải tích vào ô vuông `[x] Add Python to PATH`.
2. **Cài đặt Visual Studio Code (VS Code)** để đọc và sửa code.
3. Chép toàn bộ thư mục `E:\Downloads\bot` ra một nơi an toàn để dễ quản lý.

---

## PHẦN 3: CÀI ĐẶT THƯ VIỆN (MODULES)

Dự án này sử dụng cực kỳ nhiều thư viện ngoài (aiohttp, bs4, Flask, gTTS, PyCryptodome...).

1. Mở thư mục Zalo Bot của bạn bằng VS Code.
2. Mở Terminal trong VS Code (phím tắt `` Ctrl + ` ``).
3. Gõ lệnh sau để cài đặt toàn bộ thư viện tự động dựa vào file `requirements.txt`:
   ```bash
   pip install -r requirements.txt
   ```
   *(Đợi máy tải xong, nếu có báo lỗi thư viện nào, bạn có thể gõ `pip install tên_thư_viện` để cài lẻ).*

---

## PHẦN 4: LẤY COOKIE VÀ IMEI ZALO (LINH HỒN CỦA BOT)

Để Bot đăng nhập được, nó cần Cookie và IMEI từ Zalo Web.

### Cách lấy Cookie & IMEI:
1. Mở trình duyệt Chrome/Cốc Cốc trên máy tính, vào [chat.zalo.me](https://chat.zalo.me) và đăng nhập nick Zalo bạn muốn làm bot.
2. Bấm phím **F12** -> Chuyển sang tab **Network** (Mạng).
3. Nhắn đại 1 tin nhắn hoặc bấm vào 1 nhóm bất kỳ để Zalo load dữ liệu.
4. Ở cột tên file bên trái, tìm một dòng bắt đầu bằng `api/message...` hoặc `poll...` -> Bấm vào đó.
5. Cửa sổ bên phải, cuộn xuống mục **Request Headers**:
   - Chép lại toàn bộ đoạn mã **`cookie: ...`** (Dán vào file `cookies.txt` hoặc file config của bot).
   - Cuộn tiếp xuống phần Payload/Cookie, bạn sẽ tìm thấy một chuỗi tên là **`imei`** (Dán vào file cấu hình `cfg.json`, `config.json` hoặc trong mã nguồn đăng nhập).

### Cấu hình Bot:
- Trong project của bạn có khá nhiều file `.json` như `settings.json`, `config.json`, `cfg.json`. Mở chúng lên và sửa các giá trị ID Admin (điền ID Zalo của bạn vào để có quyền quản lý), đổi Prefix gọi lệnh, và dán Cookie/IMEI vừa lấy vào đúng chỗ.

---

## PHẦN 5: KHỞI CHẠY BOT ZALO

Sau khi đã thiết lập xong xuôi thông tin tài khoản, tiến hành chạy Bot bằng cách mở Terminal và gõ:

```bash
python boty.py
```
*(Trong thư mục của bạn, file `boty.py` có kích thước rất lớn, nó là file điều khiển trung tâm chứa luồng khởi chạy chính của dự án).*
- Hoặc nếu bạn có dùng file khởi chạy khác thì sửa thành `python _client (1).py`.

**Dấu hiệu thành công**: Terminal sẽ báo Login Success, lấy được danh sách nhóm/bạn bè và hiện "Sẵn sàng nhận lệnh". Lúc này bạn vào nhóm Zalo gõ các phím lệnh để test.

---

## PHẦN 6: CÁCH QUẢN LÝ VÀ PHÁT TRIỂN LỆNH MỚI
Khác với cấu trúc bot Mirai chia thư mục rất rạch ròi, trong dự án Zalo này tôi thấy code được để khá "nguyên khối" (file `boty.py` chứa rất nhiều logic).
- Để sửa lệnh hoặc thêm tính năng, bạn nên dùng tính năng tìm kiếm của VS Code (`Ctrl + Shift + F`) để tìm cú pháp từ khóa của lệnh đó (ví dụ tìm `def handle_` hoặc `if cmd ==`) để xem cách mà bot đang trả lời lại tin nhắn Zalo.
- Thư viện `zlapi` nằm sẵn trong thư mục dự án của bạn (đóng vai trò kết nối), bạn không cần tải `zlapi` ở ngoài.

🎉 **Tóm tắt lại**: Làm Bot Zalo bằng Python khó và bảo mật gắt gao hơn Facebook, nhưng bù lại nhóm Zalo hiện nay rất phổ biến. Bạn hãy làm theo trình tự từ trên xuống để khởi động thành công hệ thống này nhé!
