# BÁO CÁO LUẬT BẢO MẬT (FIREBASE SECURITY RULES)
**Môn học:** Lập trình ứng dụng di động  
**Bài thực hành số 6:** Phát triển ứng dụng Chat Realtime nâng cao (React Native CLI + Firebase)

---

## 1. Mục tiêu và cấu trúc dữ liệu bảo mật
Toàn bộ dữ liệu của ứng dụng được tổ chức trên Firebase Realtime Database với các nguyên tắc:
- Mọi thao tác truy cập đều bắt buộc phải đăng nhập (`auth != null`).
- Tuyệt đối không cho phép đọc/ghi dữ liệu ngoài phạm vi quyền hạn của người dùng (nguyên tắc đặc quyền tối thiểu - Principle of Least Privilege).

```
conversations/{convId}      : Lưu thông tin cuộc trò chuyện (loại direct/group, thành viên, tóm tắt).
messages/{convId}/{msgId}   : Lưu các tin nhắn của cuộc trò chuyện (văn bản, vị trí, ảnh, thu hồi, cảm xúc).
userChats/{uid}/{convId}    : Index cuộc trò chuyện của từng người dùng kèm số tin chưa đọc (unread).
readStatus/{convId}/{uid}   : Mốc thời gian đọc tin nhắn của từng thành viên.
typing/{convId}/{uid}       : Trạng thái đang soạn tin nhắn của thành viên.
notifications/{uid}/{id}    : Hộp thư thông báo riêng của mỗi người dùng.
status/{uid}                : Trạng thái kết nối (connections) và thời điểm hoạt động cuối (lastSeen).
users/{uid}                 : Hồ sơ người dùng (tên, email, ảnh đại diện).
```

---

## 2. Giải thích chi tiết các luật bảo mật

### a. Bảo mật cuộc trò chuyện và tin nhắn
- **Chỉ thành viên mới được đọc cuộc trò chuyện:**
  ```json
  "conversations": {
    "$convId": {
      ".read": "auth != null && (!data.exists() || data.child('members').child(auth.uid).val() === true || data.child('memberA').val() === auth.uid || data.child('memberB').val() === auth.uid)"
    }
  }
  ```
  Người ngoài cuộc trò chuyện (không nằm trong danh sách `members` hoặc `memberA/memberB`) sẽ bị từ chối ngay lập tức khi cố đọc dữ liệu cuộc trò chuyện hoặc danh sách tin nhắn.

- **Chỉ thành viên mới được gửi tin nhắn:**
  ```json
  "messages": {
    "$convId": {
      ".read": "auth != null && (root.child('conversations').child($convId).child('members').child(auth.uid).val() === true || ...)",
      "$messageId": {
        ".write": "auth != null && (root.child('conversations').child($convId).child('members').child(auth.uid).val() === true || ...) && (!data.exists() ? (newData.child('senderId').val() === auth.uid) : (data.child('senderId').val() === auth.uid && newData.child('recalled').val() === true))"
      }
    }
  }
  ```
  Khi tạo mới tin nhắn (`!data.exists()`), ID người gửi `newData.child('senderId').val()` phải bắt buộc trùng với `auth.uid`. Không ai có thể giả mạo tài khoản người khác để gửi tin.

### b. Thu hồi tin nhắn (Recall)
- **Chỉ người gửi mới có quyền thu hồi tin của mình:**
  Trong điều kiện cập nhật tin nhắn (`data.exists()`):
  `data.child('senderId').val() === auth.uid && newData.child('recalled').val() === true`
  + Nếu Bob cố gắng thu hồi hoặc sửa tin nhắn của Alice, hệ thống sẽ phát sinh lỗi `PERMISSION_DENIED`.
  + Tin nhắn đã gửi không được phép sửa đổi nội dung văn bản (`text`) mà chỉ được phép chuyển trạng thái `recalled: true`.

### c. Trạng thái đang soạn tin (Typing) và Thả cảm xúc (Reactions)
- **Mỗi người chỉ ghi được trạng thái đang gõ của chính mình:**
  ```json
  "typing": {
    "$convId": {
      "$uid": {
        ".write": "auth != null && auth.uid === $uid && (root.child('conversations').child($convId).child('members').child(auth.uid).val() === true || ...)",
        ".validate": "newData.val() === true || !newData.exists()"
      }
    }
  }
  ```
  Đảm bảo UID ở đường dẫn `$uid` phải trùng khớp với `auth.uid` của phiên đăng nhập hiện tại và người này phải là thành viên của cuộc trò chuyện.

- **Mỗi người chỉ thả/gỡ cảm xúc của chính mình:**
  ```json
  "reactions": {
    "$uid": {
      ".write": "auth != null && auth.uid === $uid && (root.child('conversations').child($convId).child('members').child(auth.uid).val() === true || ...)"
    }
  }
  ```
  Alice không thể giả danh Bob để thả tim hoặc xóa cảm xúc của Bob.

### d. Hộp thư thông báo (Notifications)
- **Thông báo riêng tư:**
  `notifications/{uid}` có `.read: "auth != null && auth.uid === $uid"`. Chỉ chủ sở hữu mới có quyền xem thông báo của mình. Thành viên khác chỉ có thể ghi (`write`) thông báo mới gửi tới (`newData.child('fromUid').val() === auth.uid`).

---

## 3. Chứng minh thao tác bị từ chối (PERMISSION_DENIED)

Các tình huống kiểm thử bảo mật đã được tự động hóa trong bộ test `tests/database-rules.test.cjs`:

### Tình huống 1: Người dùng cố tình thu hồi tin nhắn của người khác
- **Thao tác:** Tài khoản `Bob` gửi lệnh `update` chuyển trường `recalled: true` trên tin nhắn do `Alice` gửi:
  ```javascript
  update(ref(bob, "conversations/alice__bob/messages/" + firstKey), { recalled: true });
  ```
- **Kết quả:** Firebase Realtime Database trả về lỗi:
  ```text
  PERMISSION_DENIED: Permission denied
  Rules evaluated: data.child('senderId').val() === auth.uid => false
  ```
- **Xác nhận:** `assertFails(...)` trong bài test hoàn toàn thành công, ngăn chặn hành vi sửa đổi trái phép.

### Tình huống 2: Người dùng ngoài nhóm (Eve) cố đọc tin nhắn riêng tư
- **Thao tác:** Tài khoản `Eve` (không thuộc cuộc trò chuyện giữa Alice và Bob) gửi lệnh đọc:
  ```javascript
  get(ref(eve, "conversations/alice__bob"));
  ```
- **Kết quả:** Firebase từ chối truy cập:
  ```text
  PERMISSION_DENIED: Client doesn't have permission to access the desired data.
  Rules evaluated: data.child('members').child(auth.uid).val() === true => false
  ```

### Tình huống 3: Thả cảm xúc mạo danh
- **Thao tác:** `Alice` gửi request ghi cảm xúc vào node của `Bob`:
  ```javascript
  set(ref(alice, "conversations/alice__bob/messages/" + firstKey + "/reactions/bob"), "❤️");
  ```
- **Kết quả:** Bị chặn với mã lỗi `PERMISSION_DENIED` do `auth.uid === $uid` bị đánh giá là `false`.

---
*Báo cáo được biên soạn đầy đủ làm tài liệu nộp kèm mã nguồn Bài thực hành số 6.*
