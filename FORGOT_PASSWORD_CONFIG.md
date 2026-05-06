# Forgot Password Feature - Configuration Example

## .env Configuration (Backend)

```env
# =====================================================
# EMAIL CONFIGURATION - FORGOT PASSWORD FEATURE
# =====================================================

# Email Service Provider
# Options: gmail, sendgrid, mailgun, smtp, etc.
EMAIL_SERVICE=gmail

# Email account credentials
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password  # Use App Password, not regular password

# Frontend URL - Used in password reset link
# For development:
FRONTEND_URL=http://localhost:5173

# For production:
# FRONTEND_URL=https://yourdomain.com

# Password Reset Token Settings
# Token expiration time in seconds (default: 3600 = 1 hour)
PASSWORD_RESET_TOKEN_EXPIRY=3600

# =====================================================
# OPTIONAL EMAIL CONFIGURATION
# =====================================================

# For custom SMTP servers
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=true

# For SendGrid
SENDGRID_API_KEY=your-sendgrid-api-key

# For Mailgun
MAILGUN_DOMAIN=mail.yourdomain.com
MAILGUN_API_KEY=your-mailgun-api-key

# =====================================================
```

## Gmail Setup Instructions

### Step 1: Enable 2-Step Verification
1. Go to: https://myaccount.google.com/security
2. Find "2-Step Verification"
3. Click "Enable 2-Step Verification"
4. Follow the steps

### Step 2: Generate App Password
1. Go to: https://myaccount.google.com/apppasswords
2. Select "Mail" from the first dropdown
3. Select "Windows Computer" from the second dropdown
4. Click "Generate"
5. Copy the 16-character password

### Step 3: Configure .env
```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx  # The 16-char password you just copied
```

---

## SendGrid Setup (Alternative)

### Step 1: Create SendGrid Account
1. Sign up at: https://sendgrid.com
2. Go to Settings → API Keys
3. Create new API key

### Step 2: Configure .env
```env
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=SG.your-api-key-here
EMAIL_USER=no-reply@yourdomain.com
```

---

## Custom SMTP Setup (Alternative)

```env
EMAIL_SERVICE=smtp
SMTP_HOST=smtp.yourmailserver.com
SMTP_PORT=587
SMTP_SECURE=false  # true for port 465, false for 587
EMAIL_USER=your-email@yourdomain.com
EMAIL_PASSWORD=your-password
FRONTEND_URL=https://yourdomain.com
```

---

## Testing Email Service

### Test 1: Without Email Configuration
- Leave EMAIL_USER and EMAIL_PASSWORD empty
- Service will log tokens to console
- Use tokens for manual testing

### Test 2: Test Email Server Connection
```bash
# Add this to backend/test-email.js
const emailService = require('./src/services/emailService');

(async () => {
  const result = await emailService.sendPasswordResetEmail(
    'test@example.com',
    'test-token-abc123',
    'http://localhost:5173/reset-password?token=test-token-abc123'
  );
  console.log('Email result:', result);
})();

# Run: node test-email.js
```

### Test 3: Full Flow
```bash
# 1. Request forgot password
curl -X POST http://localhost:3001/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'

# 2. Check email (should receive link)
# 3. Click link in email
# 4. Enter new password
```

---

## Production Checklist

- [ ] EMAIL_SERVICE configured
- [ ] EMAIL_USER set correctly
- [ ] EMAIL_PASSWORD set (use secure method)
- [ ] FRONTEND_URL set to production domain
- [ ] Database migration ran successfully
- [ ] Email templates customized (optional)
- [ ] Rate limiting configured (optional)
- [ ] Bcrypt password hashing enabled (optional)
- [ ] CORS headers allow reset link domain
- [ ] Email service tested with real email

---

## Environment Variables Reference

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| EMAIL_SERVICE | Yes | gmail | Service provider |
| EMAIL_USER | Yes | user@gmail.com | Email account |
| EMAIL_PASSWORD | Yes | xxxx xxxx xxxx xxxx | App password (not regular) |
| FRONTEND_URL | Yes | https://yourdomain.com | For reset links |
| SMTP_HOST | Optional | smtp.gmail.com | Only if custom SMTP |
| SMTP_PORT | Optional | 587 | Only if custom SMTP |
| SENDGRID_API_KEY | Optional | SG.xxx... | Only if SendGrid |

---

## Troubleshooting

### Email Not Sending

**Problem**: Emails not being sent, no errors in logs

**Solution**:
1. Check EMAIL_USER and EMAIL_PASSWORD are correct
2. For Gmail: Use App Password, not regular password
3. For Gmail: Enable 2-Step Verification first
4. Check email service rate limits
5. Verify SMTP credentials if using custom SMTP

### Invalid Token Error

**Problem**: "Token is invalid or expired" when clicking reset link

**Solution**:
1. Token expires after 1 hour - request new one
2. Token can only be used once - request new one
3. Check database has password_reset_tokens table
4. Verify FRONTEND_URL is correct in .env

### Reset Link Not Working

**Problem**: Clicking email link gives blank page or 404

**Solution**:
1. Check FRONTEND_URL in .env matches frontend URL
2. Verify frontend routes are registered
3. Check browser console for errors
4. Ensure /reset-password route exists in App.jsx

### SMTP Connection Errors

**Problem**: "Error connecting to SMTP server"

**Solution**:
1. Verify SMTP_HOST is correct
2. Check SMTP_PORT (usually 587 or 465)
3. Verify EMAIL_USER and EMAIL_PASSWORD
4. Check firewall isn't blocking SMTP port
5. Some email providers block certain regions

---

## Security Best Practices

1. **Never commit .env to version control**
   - Add `.env` to `.gitignore`
   - Use `.env.example` for documentation

2. **Use strong email passwords**
   - Use Gmail App Passwords, not regular passwords
   - Rotate passwords periodically

3. **HTTPS in production**
   - Reset links should only work over HTTPS
   - Prevents man-in-the-middle attacks

4. **Rate limiting**
   - Limit forgot password requests per IP
   - Prevent email spam abuse

5. **Monitor email delivery**
   - Check email provider logs
   - Set up alerts for failed sends

6. **Sanitize user input**
   - Validate email format
   - Check for injection attacks

---

## Maintenance Tasks

### Weekly
- [ ] Monitor email service logs
- [ ] Check for failed password resets

### Monthly
- [ ] Review token cleanup job is running
- [ ] Verify email delivery rates
- [ ] Update email templates if needed

### Quarterly
- [ ] Security audit of password reset flow
- [ ] Performance review of token queries
- [ ] Check database indexes

---

## Quick Start Example

```bash
# 1. Update .env
EMAIL_SERVICE=gmail
EMAIL_USER=myapp@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
FRONTEND_URL=http://localhost:5173

# 2. Run migration (Supabase SQL Editor)
# Copy-paste contents of:
# backend/database/migrations/20260505_create_password_reset_tokens.sql

# 3. Test locally
npm run dev  # backend
npm run dev  # frontend (in another terminal)

# 4. Visit http://localhost:5173/login
# 5. Click "Quên mật khẩu?"
# 6. Enter email
# 7. Check email for reset link
# 8. Click link and reset password
```

---

**Last Updated**: May 6, 2026
