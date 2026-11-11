# THAPP2 — Bài Thực Hành Số 6

Ứng dụng nhắn tin realtime phát triển từ Bài thực hành 5 bằng **React Native CLI 0.86.3 + Firebase JS SDK + Cloudinary**.

---

## 1. Tính năng đã hoàn thiện

### PHẦN A – BẮT BUỘC (8 điểm)
1. **Trạng thái trong cuộc trò chuyện (1,5đ):**
   - Hiển thị `"đang soạn tin…"` khi đối phương đang gõ trên thanh tiêu đề header. Tự tắt sau 3 giây không gõ, khi gửi tin hoặc khi rời màn hình.
   - Tin nhắn cuối cùng của mình hiển thị trạng thái `"Đã gửi"` hoặc `"Đã xem"` kèm mốc thời gian đọc (ví dụ: *Đã xem 14:05*), cập nhật thời gian thực.
   - Hiển thị thời gian offline chi tiết: `"Hoạt động X phút trước"`, `"Hoạt động X giờ trước"`, `"Hoạt động X ngày trước"` thay vì chỉ ghi `"offline"`.
   - Sử dụng `onDisconnect()` của Firebase Realtime Database đảm bảo trạng thái đang gõ và trạng thái online không bị kẹt khi ứng dụng bị đóng đột ngột.

2. **Thu hồi và tương tác với tin nhắn (1,5đ):**
   - Nhấn giữ một tin nhắn để mở Action Menu: **Sao chép**, **Thu hồi** (chỉ hiển thị với tin do chính mình gửi) và thanh thả cảm xúc (**👍, ❤️, 😂, 😮, 😢**).
   - Tin đã thu hồi được cập nhật `recalled: true` (không xóa node khỏi database), hiển thị *"Tin nhắn đã được thu hồi"* đồng bộ ở tất cả các thiết bị.
   - Nếu tin nhắn cuối của cuộc trò chuyện bị thu hồi, dòng tin nhắn cuối tại màn hình Home cũng tự động cập nhật thành *"Tin nhắn đã được thu hồi"*.
   - Cảm xúc hiển thị dưới dạng badge ngay bên dưới bong bóng tin nhắn, kèm số lượng người thả (ví dụ: `❤️ 2`, `👍 1`).

3. **Gửi hình ảnh (2đ):**
   - Nút 📷 với 2 lựa chọn: **Chụp ảnh** (Camera) hoặc **Chọn từ thư viện ảnh** (dùng `react-native-image-picker`).
   - Tự động xin quyền Camera trên Android/iOS; hiển thị thông báo cảnh báo rõ ràng nếu người dùng từ chối cấp quyền.
   - Ảnh được tự động nén và thu nhỏ kích thước (cạnh dài ≤ 1024px) trước khi gửi.
   - Tải ảnh lên **Cloudinary** qua Unsigned Upload Preset; chỉ lưu URL ảnh an toàn vào Realtime Database.
   - Trong lúc tải ảnh, hiển thị bong bóng tin nhắn tạm có vòng xoay loading `ActivityIndicator`. Nếu tải lỗi thì xuất hiện nút **"Thử lại"**.
   - Nhấn vào ảnh để phóng to và xem toàn màn hình (Modal full screen image viewer).
   - Tại màn hình Home, tin nhắn ảnh hiển thị biểu tượng `"📷 Hình ảnh"`, tin nhắn vị trí hiển thị `"📍 Vị trí"`.

4. **Chat nhóm (2đ):**
   - Màn hình **Tạo nhóm** (`CreateGroupScreen`): nhập tên nhóm và chọn danh sách thành viên từ Danh bạ với checkbox (ràng buộc tối thiểu 2 người khác ngoài bản thân).
   - Trong giao diện nhóm: tin nhắn của thành viên khác hiển thị tên người gửi phía trên bong bóng. Tiêu đề hiển thị tên nhóm và số thành viên đang online (ví dụ: *Nhóm Dự Án (3/5 trực tuyến)*).
   - Màn hình Home hiển thị đồng thời cả cuộc trò chuyện 1-1 và chat nhóm, sắp xếp theo thời gian tin mới nhất. Mỗi thành viên có số lượng tin chưa đọc riêng biệt.
   - Nhóm hỗ trợ đầy đủ tin nhắn văn bản, tin nhắn vị trí GPS và tin nhắn ảnh.

5. **Màn hình Thông báo với dữ liệu thật (1đ):**
   - Dữ liệu thông báo được lưu thật tại nhánh `notifications/{uid}` trong các trường hợp:
     + Có tin nhắn mới trong cuộc trò chuyện;
     + Được thêm vào nhóm trò chuyện mới;
     + Có người thả cảm xúc vào tin nhắn của mình.
   - Tab Thông báo có badge hiển thị số lượng thông báo chưa đọc.
   - Nhấn vào một thông báo sẽ tự động đánh dấu đã đọc (`read: true`) và điều hướng trực tiếp vào đúng cuộc trò chuyện tương ứng.
   - Có nút **"Đọc tất cả"** để đánh dấu tất cả thông báo là đã đọc.

---

### PHẦN B – YÊU CẦU KỸ THUẬT
- **Multi-path atomic update**: Ghi tin nhắn, cập nhật `lastMessage` và tăng `unread` của các thành viên bằng lệnh `update()` nhiều đường dẫn đồng thời, sử dụng `increment(1)` của Firebase Database.
- **Security Rules (`database.rules.json`)**:
  + Chỉ thành viên mới đọc và ghi được tin nhắn của cuộc trò chuyện.
  + Chỉ người gửi mới được phép thu hồi tin nhắn của mình (`recalled: true`).
  + Mỗi người dùng chỉ có thể ghi trạng thái đang gõ và cảm xúc của chính mình.
  + Thông báo và trạng thái kết nối được phân quyền nghiêm ngặt theo UID.
- **Tải tin nhắn theo trang (Pagination)**: Ban đầu lấy 20 tin nhắn mới nhất bằng `limitToLast(20)`. Khi kéo lên đầu danh sách sẽ tải thêm 20 tin nhắn cũ hơn một cách mượt mà không bị nhảy giao diện.
- **Tổ chức code chuẩn Modular**: Các service được phân tách độc lập trong thư mục `src/services/` (`chatService.js`, `groupService.js`, `uploadService.js`, `notificationService.js`, `presenceService.js`, `authService.js`).
- **An toàn bảo mật Cloudinary**: Không chứa API Secret trong mã nguồn client; sử dụng Unsigned Preset.

---

### PHẦN C – TÍNH NĂNG NÂNG CAO (+2 điểm)
1. **Quản trị nhóm**:
   - Cho phép đổi tên nhóm.
   - Xem danh sách thành viên và trạng thái online/offline của từng thành viên.
   - Rời khỏi nhóm (tự động phát sinh tin nhắn hệ thống *"A đã rời nhóm"*).
2. **Trả lời tin nhắn cụ thể (Reply / Quote)**:
   - Trong menu nhấn giữ tin nhắn, chọn **"Trả lời"** để trích dẫn tin nhắn đang trả lời ngay phía trên thanh nhập.
   - Tin nhắn gửi đi hiển thị trích dẫn kèm tên người gửi gốc; nhấn vào phần trích dẫn sẽ tự động cuộn đến vị trí tin nhắn gốc.
3. **Cập nhật hồ sơ cá nhân**:
   - Trong màn hình Cài đặt, người dùng có thể đổi họ tên và đổi ảnh đại diện (chụp ảnh hoặc chọn từ máy tải lên Cloudinary).
   - Tên và ảnh mới được cập nhật realtime đồng bộ ở Danh bạ, Home và trong Chat.
4. **Tìm kiếm nội dung tin nhắn trong cuộc trò chuyện**:
   - Tích hợp nút tìm kiếm trên header của màn hình Chat, cho phép lọc nhanh các tin nhắn chứa từ khóa.

---

## 2. Hướng dẫn cấu hình

### A. Cấu hình Firebase
1. Truy cập [Firebase Console](https://console.firebase.google.com/), tạo project mới.
2. Bật dịch vụ **Authentication** → **Email/Password**.
3. Bật dịch vụ **Realtime Database**, chọn chế độ **Locked mode**.
4. Vào tab **Rules** của Realtime Database, sao chép nội dung file `database.rules.json` và nhấn **Publish**.
5. Đăng ký Web App (`</>`) để lấy cấu hình client và dán vào `src/services/firebaseConfig.js`:

```javascript
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.REGION.firebasedatabase.app",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

### B. Cấu hình Cloudinary (Gửi ảnh)
1. Đăng ký/Đăng nhập tài khoản miễn phí tại [Cloudinary](https://cloudinary.com/).
2. Trong Cloudinary Console:
   - Lấy giá trị **Cloud name**.
   - Vào **Settings** (biểu tượng bánh răng) → **Upload** → cuộn xuống mục **Upload presets** → nhấn **Add upload preset**.
   - Đặt tên cho preset (ví dụ `thapp_preset`).
   - Chọn mục **Signing Mode** là **Unsigned** (quan trọng!).
   - Nhấn **Save**.
3. Điền cấu hình vào file `src/services/cloudinaryConfig.js`:

```javascript
export const cloudinaryConfig = {
  cloudName: 'TÊN_CLOUD_CỦA_BẠN',
  uploadPreset: 'TÊN_UNSIGNED_PRESET',
};
```

---

## 3. Cài đặt và chạy ứng dụng

```sh
# 1. Cài đặt thư viện
npm install

# 2. Khởi động Metro bundler
npm start

# 3. Chạy trên Android (thiết bị thật hoặc emulator đã bật USB debugging)
npm run android

# 4. Kiểm tra mã nguồn và kiểu dữ liệu
npm run lint
npm run typecheck
npm test
```

---

## 4. Báo cáo luật bảo mật (Security Rules)
Xem chi tiết báo cáo giải thích các luật và minh chứng PERMISSION_DENIED tại [SECURITY_RULES_REPORT.md](./SECURITY_RULES_REPORT.md).
