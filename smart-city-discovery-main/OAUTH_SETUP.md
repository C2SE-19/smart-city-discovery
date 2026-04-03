# OAuth Setup Guide

## 🚀 Google OAuth Configuration

### Step 1: Get Google OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (if you don't have one)
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Choose **Web application**
6. Add **Authorized redirect URIs**:
   - `http://localhost:5173`
   - `http://localhost:5000`
   - `http://localhost:5000/api/auth/google/callback`
7. Copy the **Client ID**

### Step 2: Update Frontend .env.local
Edit `frontend/.env.local`:
```
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
VITE_FACEBOOK_APP_ID=your_facebook_app_id_here
```

### Step 3: Update Backend .env
Edit `backend/.env`:
```
DATABASE_URL=postgresql://...
PORT=5000
GOOGLE_CLIENT_ID=your_google_client_id_here
FACEBOOK_APP_ID=your_facebook_app_id_here
FACEBOOK_APP_SECRET=your_facebook_app_secret_here
```

---

## 🎭 Facebook OAuth Configuration

### Step 1: Get Facebook OAuth Credentials
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app
3. Choose **Facebook Login**
4. Go to **Settings** → **Basic**
5. Copy **App ID** and **App Secret**
6. Add **App Domains**:
   - `localhost`
7. Add **Valid OAuth Redirect URIs**:
   - `http://localhost:5173/`
   - `http://localhost:5000/api/auth/facebook/callback`

---

## 🔧 Testing OAuth

### Test Google Login:
1. Click the Google button on Login page
2. Select your Google account
3. Should auto-login and redirect to Overview

### Test Facebook Login:
1. Click the Facebook button on Login page
2. Login with your Facebook account
3. Grant permissions
4. Should auto-login and redirect to Overview

---

## 📝 What Happens:

1. **Frontend** sends OAuth token to Backend
2. **Backend** verifies token with Google/Facebook servers
3. **Backend** checks if user exists in database
4. If user doesn't exist → **Creates new user** with OAuth name/email
5. **Returns user data** to Frontend
6. **Frontend** saves user in UserContext & localStorage
7. **Redirects** to Overview page

---

## 🐛 Troubleshooting

**"Failed to authenticate with Google"**
- Check VITE_GOOGLE_CLIENT_ID is correct in `.env.local`
- Make sure Google SDK is loaded (check browser DevTools)

**"Failed to authenticate with Facebook"**
- Check VITE_FACEBOOK_APP_ID is correct in `.env.local`
- Check Facebook app is in Development mode
- Make sure Facebook SDK is loaded

**"CORS Error"**
- Backend must allow frontend origin
- Check `app.use(cors())` is in server.js

---

## ✅ Completed Setup:
- ✅ Backend OAuth APIs (`/api/auth/google`, `/api/auth/facebook`)
- ✅ Frontend OAuth handlers
- ✅ Auto-user creation from OAuth
- ✅ Translation support for OAuth buttons
- ✅ Styling for OAuth buttons
- ✅ Loading states during OAuth
