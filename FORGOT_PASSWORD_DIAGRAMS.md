# 🎨 Forgot Password Feature - Visual Guide

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SMART CITY DISCOVERY                      │
│              Forgot Password Feature Architecture            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────┐        ┌────────────────────┐       │
│  │   LoginPage        │        │ ForgotPasswordPage │       │
│  │  ✏️ + "Quên PW?"   │        │  📧 Email Input    │       │
│  │  Link              │───────→│  ✅ Success Message│       │
│  └────────────────────┘        │  ↩️ Back Button    │       │
│                                 └────────────────────┘       │
│                                         │                    │
│                                         ↓                    │
│                                 ┌────────────────────┐       │
│                                 │ ResetPasswordPage  │       │
│                                 │  🔒 New Password   │       │
│                                 │  ✓ Confirm        │       │
│                                 │  💪 Strength Bar   │       │
│                                 │  ✅ Success Screen │       │
│                                 └────────────────────┘       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                    HTTP/HTTPS │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND (Node.js)                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────┐         │
│  │  auth.controller.js                            │         │
│  │  ├─ forgotPassword()                           │         │
│  │  ├─ verifyResetToken()                         │         │
│  │  └─ resetPassword()                            │         │
│  └────────────────────────────────────────────────┘         │
│           ↑                          ↑                       │
│           │ Email Service            │ Token Service        │
│           ↓                          ↓                       │
│  ┌─────────────────┐      ┌──────────────────────┐         │
│  │ emailService.js │      │passwordResetService  │         │
│  │ ✉️ HTML Email   │      │ 🔑 Generate Token    │         │
│  │ 📧 Send via SMTP│      │ ✅ Verify Token      │         │
│  └─────────────────┘      │ 🚫 Mark Used         │         │
│                            └──────────────────────┘         │
│                                     ↓                        │
│                         ┌──────────────────────┐             │
│                         │  users.service.js    │             │
│                         │  Update Password     │             │
│                         └──────────────────────┘             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                    Database  │
                    (Supabase)│
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      DATABASE (PostgreSQL)                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────┐   ┌──────────────────────────┐ │
│  │     users table         │   │password_reset_tokens tbl │ │
│  │ ├─ id (UUID)            │   │ ├─ id (serial)           │ │
│  │ ├─ username             │   │ ├─ user_id (FK)          │ │
│  │ ├─ email                │   │ ├─ email                 │ │
│  │ ├─ password_hash ⬅──────┼───┤ ├─ token (unique)        │ │
│  │ ├─ created_at           │   │ ├─ expires_at            │ │
│  │ └─ updated_at           │   │ ├─ used (boolean)        │ │
│  └─────────────────────────┘   │ └─ created_at            │ │
│                                 └──────────────────────────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📨 Email Flow

```
┌───────────────────────────────────┐
│ User clicks "Quên mật khẩu?"       │
└───────────────────┬───────────────┘
                    │
                    ↓
        ┌───────────────────────┐
        │ Email Input Form      │
        │ (ForgotPasswordPage)  │
        └───────────────┬───────┘
                        │
                        ↓
        ┌───────────────────────────────────────┐
        │ POST /api/auth/forgot-password        │
        │ {email: "user@example.com"}           │
        └───────────────┬───────────────────────┘
                        │
                        ↓
        ┌───────────────────────────────────────┐
        │ Backend: forgotPassword()              │
        │ 1. Find user by email                  │
        │ 2. Generate random token              │
        │ 3. Store token in DB (1h expiry)      │
        │ 4. Create reset link                  │
        │ 5. Send email via SMTP                │
        └───────────────┬───────────────────────┘
                        │
                        ↓
        ┌───────────────────────────────────────┐
        │ Email Sent!                            │
        │ ┌─────────────────────────────────┐  │
        │ │ Smart City Discovery            │  │
        │ │                                 │  │
        │ │ Click to reset password:        │  │
        │ │ ┌─────────────────────────────┐ │  │
        │ │ │ Reset Password Button       │ │  │
        │ │ └─────────────────────────────┘ │  │
        │ │ Link expires in 1 hour          │  │
        │ └─────────────────────────────────┘  │
        └───────────────┬───────────────────────┘
                        │
                        ↓
        ┌───────────────────────────────────────┐
        │ User clicks link in email             │
        │ /reset-password?token=abc123xyz...    │
        └───────────────┬───────────────────────┘
                        │
                        ↓
        ┌───────────────────────────────────────┐
        │ Frontend verifies token               │
        │ POST /api/auth/verify-reset-token     │
        └───────────────┬───────────────────────┘
                        │
                    ┌───┴───┐
                    │       │
                  Valid   Invalid
                    │       │
                    ↓       ↓
              ┌─────────┐ ┌────────────┐
              │ Form    │ │ Error Page │
              └────┬────┘ │ "Link is   │
                   │      │  expired"  │
                   ↓      └────────────┘
        ┌─────────────────────────────┐
        │ Password Input Fields       │
        │ 1. New Password             │
        │ 2. Confirm Password         │
        │ 3. Strength Indicator       │
        │ 4. Submit Button            │
        └────────────┬────────────────┘
                     │
                     ↓
        ┌────────────────────────────────────┐
        │ POST /api/auth/reset-password      │
        │ {token, password, confirmPassword} │
        └────────────┬─────────────────────┘
                     │
                     ↓
        ┌────────────────────────────────────┐
        │ Backend: resetPassword()           │
        │ 1. Verify token                    │
        │ 2. Validate password               │
        │ 3. Update user password            │
        │ 4. Mark token as used              │
        │ 5. Return success                  │
        └────────────┬─────────────────────┘
                     │
                     ↓
        ┌────────────────────────────────────┐
        │ Frontend: Success Screen           │
        │ ✅ Password reset successfully!    │
        │ Redirecting to login... (3s)       │
        └────────────┬─────────────────────┘
                     │
                     ↓
        ┌────────────────────────────────────┐
        │ LoginPage                          │
        │ User logs in with new password     │
        └────────────────────────────────────┘
```

---

## 🔄 Request/Response Flow

### Request 1: Forgot Password

```
CLIENT (ForgotPasswordPage)
    │
    ├─ User enters: user@example.com
    │
    ├─ Validates email format
    │
    └─ POST /api/auth/forgot-password
        │
        ├─ Content-Type: application/json
        │
        └─ Body: { "email": "user@example.com" }
            │
            ↓
SERVER (auth.controller.js)
    │
    ├─ Extract email from request
    │
    ├─ Find user in database
    │
    ├─ If found:
    │   ├─ Generate token (32-byte hex)
    │   ├─ Store in password_reset_tokens table
    │   ├─ Create reset link
    │   └─ Send email via SMTP
    │
    └─ Return success (regardless of email exists)
        │
        └─ Response: 200 OK
            {
              "success": true,
              "message": "If an account exists with this email..."
            }
            │
            ↓
CLIENT
    │
    └─ Show success message to user
```

### Request 2: Verify Token

```
CLIENT (ResetPasswordPage)
    │
    ├─ Extract token from URL: ?token=ABC123
    │
    └─ POST /api/auth/verify-reset-token
        │
        ├─ Content-Type: application/json
        │
        └─ Body: { "token": "ABC123..." }
            │
            ↓
SERVER (auth.controller.js)
    │
    ├─ Query token from database
    │
    ├─ Check if token exists
    │
    ├─ Check if token not used
    │
    ├─ Check if not expired
    │
    └─ Return result
        │
        ├─ If valid: 200 OK
        │   {
        │     "success": true,
        │     "message": "Token is valid",
        │     "email": "user@example.com"
        │   }
        │
        └─ If invalid: 400 Bad Request
            {
              "success": false,
              "message": "Token has expired"
            }
            │
            ↓
CLIENT
    │
    ├─ If valid: show password form
    │
    └─ If invalid: show error page
```

### Request 3: Reset Password

```
CLIENT (ResetPasswordPage)
    │
    ├─ User enters password
    │
    ├─ User confirms password
    │
    ├─ Validates locally
    │
    └─ POST /api/auth/reset-password
        │
        ├─ Content-Type: application/json
        │
        └─ Body: {
            "token": "ABC123...",
            "password": "newpass123",
            "confirmPassword": "newpass123"
           }
            │
            ↓
SERVER (auth.controller.js)
    │
    ├─ Extract data from request
    │
    ├─ Validate passwords match
    │
    ├─ Verify token
    │
    ├─ Find user by email from token
    │
    ├─ Update password in database
    │
    ├─ Mark token as used
    │
    └─ Return success
        │
        └─ Response: 200 OK
            {
              "success": true,
              "message": "Password reset successfully"
            }
            │
            ↓
CLIENT
    │
    ├─ Show success screen
    │
    ├─ Display countdown (3s)
    │
    └─ Auto-redirect to /login
```

---

## 🗄️ Database Schema

```
users table
┌─────────────┬──────────┬─────────────────────┐
│ id          │ UUID     │ PRIMARY KEY         │
├─────────────┼──────────┼─────────────────────┤
│ username    │ VARCHAR  │ UNIQUE              │
├─────────────┼──────────┼─────────────────────┤
│ email       │ VARCHAR  │ UNIQUE              │
├─────────────┼──────────┼─────────────────────┤
│ password_ha │ VARCHAR  │ Stores hashed pass  │
│ sh          │          │ (TODO: bcrypt)      │
├─────────────┼──────────┼─────────────────────┤
│ fullname    │ VARCHAR  │                     │
├─────────────┼──────────┼─────────────────────┤
│ created_at  │ DATETIME │ TIMESTAMP           │
└─────────────┴──────────┴─────────────────────┘

password_reset_tokens table
┌─────────────┬──────────┬─────────────────────┐
│ id          │ SERIAL   │ PRIMARY KEY         │
├─────────────┼──────────┼─────────────────────┤
│ user_id     │ UUID     │ FOREIGN KEY→users   │
├─────────────┼──────────┼─────────────────────┤
│ email       │ VARCHAR  │                     │
├─────────────┼──────────┼─────────────────────┤
│ token       │ VARCHAR  │ UNIQUE              │
│             │          │ (32-byte hex)       │
├─────────────┼──────────┼─────────────────────┤
│ expires_at  │ DATETIME │ NOW() + 1 hour      │
├─────────────┼──────────┼─────────────────────┤
│ used        │ BOOLEAN  │ Default: FALSE      │
├─────────────┼──────────┼─────────────────────┤
│ created_at  │ DATETIME │ TIMESTAMP           │
└─────────────┴──────────┴─────────────────────┘
```

---

## 🎨 UI Component Hierarchy

```
App.jsx
├─ Route: /forgot-password
│  └─ ForgotPasswordPage.jsx
│     ├─ Header
│     │  ├─ Logo
│     │  ├─ Title: "Quên mật khẩu?"
│     │  └─ Subtitle
│     │
│     ├─ Form
│     │  ├─ Error Message (conditional)
│     │  ├─ Form Group
│     │  │  ├─ Label
│     │  │  └─ Email Input
│     │  ├─ Submit Button
│     │  └─ Divider
│     │
│     ├─ Success Message (conditional)
│     │  ├─ Success Icon
│     │  ├─ Title
│     │  ├─ Email info
│     │  └─ Timer info
│     │
│     └─ Back Button
│
├─ Route: /reset-password
│  └─ ResetPasswordPage.jsx
│     ├─ Verifying State (loading)
│     │  ├─ Spinner
│     │  └─ "Verifying link..."
│     │
│     ├─ Error State (invalid token)
│     │  ├─ Error Icon
│     │  ├─ Error Title
│     │  ├─ Error Message
│     │  └─ Back Button
│     │
│     ├─ Success State (after reset)
│     │  ├─ Success Icon
│     │  ├─ Success Title
│     │  ├─ Success Message
│     │  └─ Countdown
│     │
│     └─ Form State (valid token)
│        ├─ Header
│        │  ├─ Logo
│        │  ├─ Title
│        │  ├─ Subtitle
│        │  └─ Email display
│        │
│        ├─ Form
│        │  ├─ Error Message (conditional)
│        │  ├─ Password Form Group
│        │  │  ├─ Label
│        │  │  ├─ Password Input
│        │  │  ├─ Show/Hide Toggle
│        │  │  └─ Hint Text
│        │  │
│        │  ├─ Confirm Password Form Group
│        │  │  ├─ Label
│        │  │  ├─ Password Input
│        │  │  └─ Show/Hide Toggle
│        │  │
│        │  ├─ Password Strength Indicator
│        │  │  ├─ Strength Bar
│        │  │  └─ Strength Text
│        │  │
│        │  ├─ Submit Button
│        │  └─ Divider
│        │
│        └─ Back Button
│
└─ LoginPage.jsx (modified)
   └─ "Quên mật khẩu?" link
      └─ → /forgot-password
```

---

## 🔐 Security Layers

```
Layer 1: Frontend Validation
├─ Email format validation (regex)
├─ Password length check (min 6)
├─ Confirm password matching
└─ Input sanitization

Layer 2: API Validation
├─ Email existence check
├─ Token format validation
├─ Password strength validation
└─ Request validation (POST, JSON)

Layer 3: Database Security
├─ RLS (Row Level Security) policies
├─ Unique constraints on tokens
├─ Foreign key relationships
├─ Indexes on frequently queried columns
└─ Soft delete/archive old tokens

Layer 4: Token Security
├─ Secure random generation (32-byte)
├─ Time-based expiration (1 hour)
├─ One-time use enforcement
├─ Email verification (no enumeration)
└─ Database encryption (optional)

Layer 5: Password Security
├─ Password hashing (TODO: bcrypt)
├─ Salt generation (TODO)
├─ Secure storage in database
├─ No logging of passwords
└─ HTTPS transmission (production)
```

---

## 📊 State Diagram

```
                    ┌─────────────────┐
                    │  Initial State  │
                    │  (Login Page)   │
                    └────────┬────────┘
                             │
                    Click "Quên PW?"
                             │
                             ↓
                    ┌─────────────────┐
                    │ Forgot Password │
                    │  Form Showing   │
                    └────────┬────────┘
                             │
                  Email entered, form submitted
                             │
                    ┌────────┴────────┐
                    │                 │
                Invalid Email    Valid Email
                    │                 │
                    ↓                 ↓
            ┌──────────────┐  ┌──────────────┐
            │ Error Message│  │ Success      │
            │ Show again   │  │ Email sent   │
            └──────────────┘  │ Auto-hide 5s │
                             │ (no action)   │
                             └──────┬────────┘
                                    │
                         User clicks email link
                                    │
                             ↓─────────────┐
                             │             │
                      Token Valid    Token Invalid
                             │             │
                             ↓             ↓
                  ┌──────────────────┐  ┌──────────────┐
                  │ Reset Password   │  │ Error Page   │
                  │ Form with inputs │  │ "Link expired"
                  └────────┬─────────┘  │ Offer retry  │
                           │             └──────────────┘
                           │
              Password entered and validated
                           │
                    ┌──────┴──────┐
                    │             │
              Passwords don't  Passwords
              match/invalid    valid
                    │             │
                    ↓             ↓
            ┌──────────────┐  ┌──────────────┐
            │ Error Message│  │ Success Page │
            │ Allow retry  │  │ Countdown    │
            └──────────────┘  │ Auto-redirect│
                             │ to login     │
                             └──────┬───────┘
                                    │
                             User logs in
                                    │
                                    ↓
                           ┌─────────────────┐
                           │  Dashboard      │
                           │  (success!)     │
                           └─────────────────┘
```

---

## 🚀 Deployment Flow

```
Development
    ↓
Create files (✓ Done)
    ↓
Test locally (✓ Ready)
    ↓
Stage to QA
    ↓
Test end-to-end
    ↓
Deploy to Production
    ├─ Push code changes
    ├─ Configure .env on server
    │  ├─ EMAIL_SERVICE
    │  ├─ EMAIL_USER
    │  ├─ EMAIL_PASSWORD
    │  └─ FRONTEND_URL
    ├─ Run database migration
    │  └─ CREATE TABLE password_reset_tokens
    ├─ Test email sending
    ├─ Monitor logs
    └─ User testing
        ├─ Request reset
        ├─ Check email
        ├─ Click link
        ├─ Reset password
        └─ Login with new password
```

---

**Diagrams Created**: May 6, 2026
