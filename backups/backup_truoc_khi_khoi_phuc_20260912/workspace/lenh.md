# Tài liệu lệnh Tài Xỉu toàn cục

## 1. File triển khai và tên lệnh

- File xử lý: `modules/commands/txglobal.js`
- Tên command trong code: `txglobal`
- Prefix hiện tại trong `config.json`: `/`
- Cách gọi đúng theo dispatcher hiện tại: `/txglobal`
- `hasPermssion: 0`: bản thân command không yêu cầu quyền bot/admin chung, nhưng từng chức năng vẫn tự kiểm tra quyền.
- Cooldown: 1 giây cho mỗi người dùng.
- Command được phân loại: `Trò Chơi`.

> Lưu ý về `/tx`: trong source hiện tại không có file `tx.js`, không có alias `tx` trong `txglobal.js`, và dispatcher tìm command theo đúng `config.name`. Vì vậy `/tx` chưa được chứng minh là lệnh hợp lệ; hãy dùng `/txglobal ...`. Nếu hệ thống ngoài source có cấu hình alias thì `/tx` mới có thể hoạt động.

## 2. Tổng quan trò chơi

Đây là trò Tài Xỉu dùng chung dữ liệu cho tất cả các nhóm đã bật bàn:

1. Admin bot nạp tiền cho người chơi bằng `set`.
2. Quản trị viên nhóm bật trò chơi bằng `on`.
3. Người chơi chọn `tài` hoặc `xỉu` và đặt tiền.
4. Một phiên chạy theo bộ đếm nền của module.
5. Module gieo 3 viên xúc xắc, tính tổng và xác định kết quả.
6. Kết quả được gửi tới tất cả nhóm đang bật.
7. Tiền được cộng/trừ vào dữ liệu dùng chung.

Phân loại kết quả trong code:

- `xỉu`: tổng từ 4 đến 10.
- `tài`: tổng từ 11 đến 18.
- Tổng 3 viên xúc xắc luôn nằm trong khoảng 3 đến 18; tổng 3 hoặc 19 trở lên không xảy ra.
- Nếu ra `6-6-6` hoặc `1-1-1`, tiền cược của người thắng được nhân 5 thay vì cộng 1 lần tiền cược.

## 3. Cú pháp nhanh

```text
/txglobal on
/txglobal off
/txglobal tài <số_tiền>
/txglobal xỉu <số_tiền>
/txglobal tài all
/txglobal xỉu all
/txglobal set <UID> | <số_tiền>
/txglobal set <số_tiền>       (reply tin nhắn người cần nạp)
/txglobal set <số_tiền>       (tag người cần nạp)
/txglobal check
/txglobal check               (reply hoặc tag người cần kiểm tra)
```

Tin nhắn không có tham số hợp lệ sẽ trả về hướng dẫn tích hợp của module.

## 4. Chi tiết từng chức năng

### 4.1. Bật bàn cho nhóm: `on`

```text
/txglobal on
```

Quyền sử dụng: quản trị viên của nhóm.

Cách hoạt động:

1. Lấy thông tin nhóm từ `global.data.threadInfo` hoặc gọi `Threads.getInfo(threadID)`.
2. Kiểm tra `senderID` có nằm trong `adminIDs` của nhóm hay không.
3. Nếu chưa bật, thêm `threadID` vào danh sách nhóm đang chơi.
4. Ghi danh sách ra file `modules/commands/cache/data/taixiu/data/file_check.json`.
5. Từ đó nhóm nhận thông báo mở phiên, cảnh báo hết giờ và kết quả.

Thông báo lỗi:

- Không phải quản trị viên: `Bạn không đủ quyền hạn để sử dụng!`
- Nếu nhóm đã bật rồi: code không gửi thông báo mới.

### 4.2. Tắt bàn cho nhóm: `off`

```text
/txglobal off
```

Quyền sử dụng: quản trị viên của nhóm.

Cách hoạt động:

1. Kiểm tra quyền quản trị viên nhóm.
2. Tìm `threadID` trong `file_check.json`.
3. Xóa nhóm khỏi danh sách nếu có.
4. Ghi file lại.

Việc tắt nhóm chỉ ngừng nhận thông báo và không xóa số dư, lịch sử cược hoặc lịch sử phiên đã lưu.

### 4.3. Đặt cược Tài hoặc Xỉu

```text
/txglobal tài 10000
/txglobal xỉu 50000
/txglobal tài all
/txglobal xỉu all
```

Điều kiện:

- Nhóm phải được bật bằng `/txglobal on`.
- Phiên chưa đi tới thời điểm hết cược.
- Số tiền thông thường phải là số nguyên hợp lệ.
- Mức cược tối thiểu theo điều kiện code là `1000 VND`.
- Từ khóa `all` đặt theo toàn bộ số tiền đang có trong dữ liệu của người chơi.
- Mỗi người chỉ được tạo một bản ghi cược trong một phiên.

Dữ liệu bản cược được lưu tại:

```text
modules/commands/cache/data/taixiu/data/betHistory/<senderID>.json
```

Mỗi bản ghi gồm:

```json
{
  "senderID": "ID người chơi",
  "choice": "tài hoặc xỉu",
  "betAmount": 10000,
  "phien": 1,
  "time": 1710000000000
}
```

Sau khi đặt thành công, bot báo lựa chọn, số tiền, phiên và thời gian còn lại theo bộ đếm hiện tại.

Các thông báo lỗi có thể gặp:

- `Nhóm chưa bật bàn tài xỉu!`
- `Hết thời gian đặt cược`
- `Số tiền đặt cược phải là một số hợp lệ!`
- `Số tiền đặt cược phải lớn hơn 1000 VND!`
- `Bạn chỉ được đặt cược một lần mỗi phiên.`
- `Bạn không có tiền!`

### 4.4. Nạp/chỉnh số dư: `set`

Chỉ ADMINBOT trong `config.json` được dùng.

#### Nhập UID trực tiếp

```text
/txglobal set 61554802082578 | 100000
```

#### Reply tin nhắn người chơi

Reply tin nhắn của người chơi rồi gửi:

```text
/txglobal set 100000
```

#### Tag người chơi

```text
/txglobal set @TênNgườiChơi 100000
```

Cách module phân tích tham số:

- Có `messageReply`: lấy UID từ người gửi tin nhắn được reply, số tiền lấy từ `args[1]`.
- Có mention: lấy UID mention đầu tiên, số tiền lấy từ `args[2]`.
- Không reply/mention: ghép các tham số sau `set`, tách bằng ký tự `|`, rồi chuyển thành số.

Cách cập nhật:

1. Đọc `money.json`.
2. Nếu người dùng đã có dữ liệu, cộng thêm `input` vào số dư hiện tại.
3. Nếu chưa có, tạo bản ghi mới với `input` bằng số tiền được set.
4. Ghi lịch sử vào `lichsugiaodich/<UID>.json`.
5. Gửi thông báo UID, số tiền và thời gian nạp.

File số dư:

```text
modules/commands/cache/data/taixiu/money.json
```

File lịch sử nạp theo người dùng:

```text
modules/commands/cache/data/taixiu/data/lichsugiaodich/<UID>.json
```

> Tên biến `set` dễ gây hiểu nhầm, nhưng code thực tế là cộng thêm tiền (`input += số tiền`), không thay thế số dư cũ.

### 4.5. Kiểm tra số dư: `check`

Kiểm tra số dư của chính mình:

```text
/txglobal check
```

Kiểm tra người khác bằng reply:

```text
/txglobal check
```

Kiểm tra người khác bằng mention:

```text
/txglobal check @TênNgườiChơi
```

Thứ tự chọn UID:

1. UID người được reply.
2. UID mention đầu tiên.
3. UID của người gửi lệnh.

Kết quả trả về:

```text
Name: Tên người chơi
Money: Số dư
```

Nếu chưa có bản ghi số dư, bot trả về `Người chơi chưa có dữ liệu!`.

## 5. Chu kỳ một phiên

Module có `setInterval(..., 1000)`, tức chạy một nhịp mỗi giây. Biến `i` tăng từ 1 đến 60 rồi đặt lại về 0.

### Nhịp bắt đầu phiên: `i == 1`

- Đọc phiên gần nhất từ `phiên.json`.
- Gieo sẵn kết quả cho phiên kế tiếp bằng 3 lần `Math.random()`.
- Gửi tới mọi nhóm trong `file_check.json`:

```text
Bắt đầu phiên <số phiên>!
Bạn có 50 giây để đặt cược.
```

### Nhịp cảnh báo: `i == 45`

- Gửi thông báo hết thời gian đặt cược.
- Gửi đếm ngược 5 giây bằng cơ chế sửa tin nhắn MQTT.

### Nhịp chốt kết quả: `i == 50`

- Đọc tiền và toàn bộ file cược.
- Chỉ xử lý cược có `phien` trùng phiên hiện tại.
- Cược đúng kết quả: cộng tiền cược; nếu là `666` hoặc `111` thì cộng gấp 5.
- Cược sai: trừ tiền cược.
- Ghi lại `money.json`.
- Gửi xúc xắc, tổng điểm, kết quả, số người thắng/thua và tối đa 10 phiên gần đây tới mọi nhóm đang bật.
- Thêm phiên mới vào `phiên.json`.

### Nhịp reset: `i == 60`

- Đặt `i = 0` để chu kỳ bắt đầu lại.

Các thư mục/file được tự tạo khi module được nạp:

```text
modules/commands/cache/data/taixiu/
modules/commands/cache/data/taixiu/data/
modules/commands/cache/data/taixiu/data/lichsugiaodich/
modules/commands/cache/data/taixiu/data/betHistory/
modules/commands/cache/data/taixiu/money.json
modules/commands/cache/data/taixiu/phiên.json
modules/commands/cache/data/taixiu/file_check.json
```

Nếu chưa tồn tại, ba file JSON chính được khởi tạo bằng mảng rỗng `[]`.

## 6. Cách tính tiền theo code hiện tại

Ví dụ người chơi có `100000`:

- Cược `20000` vào `tài`, kết quả là `tài`: số dư được cộng `20000` ở thời điểm chốt.
- Cược `20000` vào `tài`, kết quả là `xỉu`: số dư bị trừ `20000` ở thời điểm chốt.
- Cược `20000` và kết quả là `666` hoặc `111` đúng lựa chọn: số dư được cộng `100000`.

Công thức code đang thực hiện:

```text
Đúng bình thường: số dư mới = số dư cũ + tiền cược
Đúng khi 111/666: số dư mới = số dư cũ + tiền cược * 5
Sai: số dư mới = số dư cũ - tiền cược
```

## 7. Các điểm cần lưu ý khi vận hành

1. **Tên lệnh là `txglobal`, không phải `tx`** theo source hiện tại.
2. **Dữ liệu dùng chung giữa các nhóm**: tiền, phiên và file cược nằm ở thư mục chung; nhóm chỉ được bật/tắt việc nhận thông báo.
3. **Kết quả được gieo ở `i == 1` nhưng xử lý ở `i == 50`**. Trong khoảng đó biến `results` giữ kết quả của phiên.
4. **Kiểm tra thiếu tiền trong code đang đặt trước khi gán `betAmount`**. Điều kiện `player.input < betAmount` vì thế không chặn đúng trường hợp cược vượt số dư. Đây là lỗi logic cần sửa nếu muốn ngăn cược quá tiền.
5. **Tiền cược không bị trừ ngay khi đặt**. Code chỉ cộng/trừ khi chốt kết quả.
6. **`set` không thay thế số dư** mà cộng thêm số tiền vào số dư hiện có.
7. **Không có kiểm tra `input` là số hợp lệ trong nhánh `set`**. Tham số sai có thể làm phát sinh `NaN` trong dữ liệu.
8. **`Users.getNameUser()` được gọi trong `set` nhưng kết quả tên không được đưa vào thông báo**.
9. **Một người chỉ được có một cược mỗi phiên**, nhưng code chỉ kiểm tra trùng `senderID` trong file của người đó và cùng số phiên.
10. **Việc ghi JSON là đồng bộ** (`readFileSync`/`writeFileSync`), nên file hỏng hoặc tiến trình dừng giữa lúc ghi có thể làm module không đọc được dữ liệu.
11. **`Threads` không được destructure trong `run`** nhưng được gọi ở nhánh `on/off` qua biến toàn cục. Điều này phụ thuộc vào việc hệ thống đã expose `Threads` global.
12. **Kết quả `phiên.json` chỉ lưu kết quả xúc xắc và phiên**, không lưu danh sách người thắng/thua hoặc tổng tiền giao dịch.

## 8. Ví dụ quy trình đầy đủ

### Admin bot nạp tiền

```text
/txglobal set @NguoiChoi 500000
```

### Quản trị viên nhóm bật trò chơi

```text
/txglobal on
```

### Người chơi xem số dư

```text
/txglobal check
```

### Người chơi đặt cược

```text
/txglobal tài 100000
```

hoặc:

```text
/txglobal xỉu all
```

### Kết thúc tự động

Chờ module chạy tới nhịp chốt phiên. Bot sẽ công bố 3 mặt xúc xắc, tổng điểm, kết quả và cập nhật số dư.

### Quản trị viên nhóm tắt trò chơi

```text
/txglobal off
```

## 9. Cấu hình liên quan

Trong `config.json`:

- `PREFIX`: prefix lệnh, hiện là `/`.
- `ADMINBOT`: danh sách UID có quyền dùng `set`.
- `allowInbox`, quyền admin chung và trạng thái ban command vẫn được dispatcher kiểm tra trước khi gọi module.

Trong `modules/commands/txglobal.js`:

- `hasPermssion: 0`
- `cooldowns: 1`
- `commandCategory: "Trò Chơi"`
- `usages: "[on/off]"` (mô tả này ngắn hơn các chức năng thật; phần hướng dẫn runtime mới liệt kê đầy đủ lệnh).
