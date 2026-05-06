# 🔐 Hệ Thống Quên Mật Khẩu - Smart City Discovery

## 📋 Tổng Quan

Hệ thống "Quên Mật Khẩu" (Forgot Password) được xây dựng với thiết kế hiện đại, an toàn và dễ sử dụng. Người dùng có thể:

1. **Yêu cầu đặt lại mật khẩu** bằng cách nhập email
2. **Nhận email** với liên kết đặt lại mật khẩu (có thời hạn 1 giờ)
3. **Đặt mật khẩu mới** thông qua liên kết trong email
4. **Xác thực token** trước khi thay đổi mật khẩu

---

## 🏗️ Cấu Trúc Dự Án

### Backend
```
backend/src/
├── modules/auth/
│   ├── auth.controller.js       (Xử lý logic - 3 endpoint mới)
│   ├── auth.routes.js           (Routes - 3 route mới)
│   └── auth.service.js
├── services/
│   ├── emailService.js          (Gửi email)
│   └── passwordResetService.js  (Quản lý token)
└── config/env.js
```

### Frontend
```
frontend/src/pages/auth/
├── ForgotPasswordPage.jsx       (Trang quên mật khẩu)
├── ResetPasswordPage.jsx        (Trang đặt lại mật khẩu)
├── forgot-password.css          (Style trang quên mật khẩu)
├── reset-password.css           (Style trang đặt lại)
└── LoginPage.jsx                (Cập nhật thêm nút "Quên mật khẩu")
```

### Database
```
backend/database/migrations/
└── 20260505_create_password_reset_tokens.sql  (Bảng token)
```

---

## ⚙️ Cài Đặt & Cấu Hình

### 1. **Backend Configuration**

#### a) Cài đặt biến môi trường (`.env`)

```env
# Email Configuration
EMAIL_SERVICE=gmail              # hoặc SendGrid, Mailgun, v.v.
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Frontend URL (dùng cho reset link)
FRONTEND_URL=http://localhost:5173
# Hoặc cho production:
# FRONTEND_URL=https://yourdomain.com
```

#### b) Cài đặt Gmail (nếu dùng Gmail)

1. Bật **2-Step Verification** trong tài khoản Google
2. Tạo **App Password**:
   - Vào: https://myaccount.google.com/apppasswords
   - Chọn "Mail" và "Windows Computer"
   - Copy password được tạo
   - Dùng password này trong `EMAIL_PASSWORD`

#### c) Chạy migration

```bash
# Kết nối tới Supabase và chạy migration:
cd backend
npm run migrate  # Hoặc chạy SQL trực tiếp trong Supabase

# Hoặc sao chép nội dung file SQL:
# backend/database/migrations/20260505_create_password_reset_tokens.sql
# Và chạy trong Supabase SQL Editor
```

### 2. **Frontend Configuration**

Frontend tự động cấu hình qua môi trường backend. Không cần setup thêm.

---

## 🔌 Endpoints API

### POST `/api/auth/forgot-password`

**Yêu cầu:**
```json
{
  "email": "user@example.com"
}
```

**Phản hồi:**
```json
{
  "success": true,
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

**Mô tả:**
- Tìm user theo email
- Tạo token reset với thời hạn 1 giờ
- Gửi email chứa reset link
- Trả về success không phân biệt email có tồn tại hay không (vì lý do bảo mật)

---

### POST `/api/auth/verify-reset-token`

**Yêu cầu:**
```json
{
  "token": "abc123xyz..."
}
```

**Phản hồi (thành công):**
```json
{
  "success": true,
  "message": "Token is valid",
  "email": "user@example.com"
}
```

**Phản hồi (lỗi):**
```json
{
  "success": false,
  "message": "Token has expired"
}
```

**Mô tả:**
- Xác thực token có tồn tại không
- Kiểm tra token chưa bị sử dụng
- Kiểm tra token chưa hết hạn
- Trả về email tương ứng

---

### POST `/api/auth/reset-password`

**Yêu cầu:**
```json
{
  "token": "abc123xyz...",
  "password": "newpassword123",
  "confirmPassword": "newpassword123"
}
```

**Phản hồi:**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Mô tả:**
- Xác thực token
- Kiểm tra mật khẩu mới hợp lệ (ít nhất 6 ký tự)
- Cập nhật mật khẩu user
- Đánh dấu token là đã sử dụng (để prevent reuse)

---

## 🎨 Giao Diện

### Trang Forgot Password

**Tính năng:**
- ✅ Input email với validation
- ✅ Thông báo success với email được gửi
- ✅ Error handling đẹp
- ✅ Help text cho các tình huống lỗi
- ✅ Responsive trên mọi device
- ✅ Nền Vietnam map đẹp (giống trang login)

**Màu sắc:**
- Chính: Purple gradient (#667eea → #764ba2)
- Nền: Warm beige (#f4e5c8)
- Success: Green (#22c55e)
- Error: Red (#dc2626)

### Trang Reset Password

**Tính năng:**
- ✅ Xác thực token trước khi hiển thị form
- ✅ Input password với toggle show/hide
- ✅ Báo mật khẩu yếu/mạnh
- ✅ Confirm password matching validation
- ✅ Success screen với countdown
- ✅ Error state nếu token invalid

**States:**
1. **Verifying**: Đang xác thực token
2. **Form**: Nhập mật khẩu mới (nếu token hợp lệ)
3. **Success**: Thành công + auto redirect
4. **Error**: Token không hợp lệ

---

## 🔒 Bảo Mật

### ✅ Các biện pháp bảo mật:

1. **Token Generation**
   - Random 32-byte hex tokens
   - Unique constraints trên database

2. **Token Expiration**
   - Mỗi token hết hạn sau 1 giờ
   - Auto cleanup expired tokens

3. **One-Time Use**
   - Mỗi token chỉ dùng được 1 lần
   - Đánh dấu `used = true` sau khi sử dụng

4. **Email Verification**
   - Không reveal user email trong API response
   - Trả về generic message cho cả email có/không tồn tại

5. **Password Validation**
   - Minimum 6 characters
   - Confirm password matching
   - Hashing (cần implement bcrypt - TODO)

6. **RLS (Row Level Security)**
   - Supabase RLS policies trên bảng tokens
   - Chỉ user sở hữu hoặc admin mới xem được

---

## 📧 Email Template

Email được gửi có giao diện HTML đẹp với:
- Logo Smart City Discovery
- Thông báo rõ ràng
- Nút "Đặt lại mật khẩu" bắt mắt
- Fallback URL (copy-paste)
- Thông báo thời hạn 1 giờ
- Footer thông tin công ty

---

## 🧪 Testing

### Test Email Service (Development)

Nếu muốn test mà không config Gmail:
1. Comment out `initializeTransporter()` trong `emailService.js`
2. Service sẽ log token thay vì gửi email
3. Copy token từ console

### Test Flow

```bash
# 1. Request password reset
curl -X POST http://localhost:3001/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'

# 2. Verify token (copy từ database hoặc console log)
curl -X POST http://localhost:3001/api/auth/verify-reset-token \
  -H "Content-Type: application/json" \
  -d '{"token":"YOUR_TOKEN_HERE"}'

# 3. Reset password
curl -X POST http://localhost:3001/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token":"YOUR_TOKEN_HERE",
    "password":"newpass123",
    "confirmPassword":"newpass123"
  }'
```

---

## 🚀 Deployment Checklist

- [ ] Cấu hình EMAIL_USER, EMAIL_PASSWORD, FRONTEND_URL trong production
- [ ] Chạy migration database
- [ ] Test forgot password flow end-to-end
- [ ] Kiểm tra email delivery
- [ ] Kiểm tra reset link trên domain production
- [ ] Setup rate limiting để prevent abuse (optional)
- [ ] Setup email service (Gmail, SendGrid, v.v.)
- [ ] Verify CORS settings cho reset email link

---

## 📝 TODO & Improvements

### High Priority
- [ ] Implement bcrypt password hashing (currently plain text in TODO comment)
- [ ] Rate limiting trên forgot-password endpoint
- [ ] Email resend logic (sau 5 phút)
- [ ] Password strength requirements (uppercase, number, special char)

### Medium Priority
- [ ] Multi-language support trong email
- [ ] SMS fallback nếu email fail
- [ ] Account recovery options (security questions, phone)
- [ ] Two-factor authentication (2FA)

### Low Priority
- [ ] Email templates customization
- [ ] Analytics tracking
- [ ] Admin dashboard xem password reset logs

---

## ✨ Features Highlights

| Feature | Status | Notes |
|---------|--------|-------|
| Email validation | ✅ | Regex validation + DB check |
| Token generation | ✅ | Secure random 32-byte tokens |
| Token expiration | ✅ | 1 hour default |
| One-time use tokens | ✅ | Marked used after consumption |
| Beautiful UI | ✅ | Gradient, animations, responsive |
| Error handling | ✅ | User-friendly messages |
| Success messages | ✅ | Clear feedback |
| Email sending | ✅ | Nodemailer + Gmail support |
| Token verification | ✅ | Validate before showing form |
| Password matching | ✅ | Confirm password field |
| Responsive design | ✅ | Mobile, tablet, desktop |
| Loading states | ✅ | Spinners, disabled buttons |
| Accessibility | ⚠️ | Basic - can improve |
| Password hashing | ❌ | TODO: Implement bcrypt |
| Rate limiting | ❌ | TODO: Add express-rate-limit |

---

## 📞 Support

Nếu có vấn đề:
1. Kiểm tra `.env` configuration
2. Xem logs backend để debug
3. Kiểm tra database migration chạy thành công
4. Verify email service credentials

---

## 📄 License

Part of Smart City Discovery platform - © 2026
