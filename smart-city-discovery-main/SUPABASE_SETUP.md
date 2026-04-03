# Supabase Setup Guide

## Step 1: Setup Supabase Database

### 1.1 Create Tables
Go to your Supabase Dashboard:
1. Navigate to **SQL Editor**
2. Click **New Query**
3. Paste the content from: `backend/database/migrations/supabase_schema.sql`
4. Click **Run**

This will create:
- `users` table - Store user accounts
- `profiles` table - Extended user information
- `posts` table - Merchant posts

### 1.2 Insert Sample Data

After tables are created:
1. Go to **SQL Editor**
2. Run this query:

```sql
-- Insert sample users
INSERT INTO users (username, email, fullname, password_hash, phone, birthDate, address, gender, bio, role) VALUES
('huynh', 'huynh@example.com', 'Huynh Duc Loc', 'password123', '0932123456', '1998-01-15', '123 Nguyen Hue, Da Nang', 'Nam', 'Love technology and good food', 'merchant'),
('user2', 'user2@example.com', 'John Doe', 'password123', '0901234567', '1995-05-20', '456 Le Duan, Da Nang', 'Nam', 'Explorer', 'user');
```

## Step 2: Setup Backend

### 2.1 Install Dependencies
```bash
cd backend
npm install @supabase/supabase-js jsonwebtoken
```

### 2.2 Configure Environment Variables

Create `.env` file in `backend/` folder with your Supabase credentials:

```env
SUPABASE_URL=https://ywgmkbxibgognsuzxacd.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
JWT_SECRET=your-jwt-secret-key
```

Get these from Supabase Dashboard → **Settings** → **API**

### 2.3 Start Backend Server
```bash
npm start
```

## Step 3: Test API Endpoints

### Login
```bash
POST http://localhost:5000/api/v1/auth/login
Content-Type: application/json

{
  "username": "huynh",
  "password": "password123"
}
```

### Get Profile
```bash
GET http://localhost:5000/api/v1/users/profile
```

### Update Profile
```bash
PUT http://localhost:5000/api/v1/users/profile
Content-Type: application/json

{
  "fullname": "Huynh Duc Loc",
  "email": "huynh@example.com",
  "phone": "0932123456",
  "address": "123 Nguyen Hue, Da Nang",
  "gender": "Nam",
  "bio": "Developer"
}
```

## Important Notes

⚠️ **Security**
- Change `JWT_SECRET` in production
- Never commit `.env` file to git
- Use `SUPABASE_SERVICE_ROLE_KEY` only on server-side
- Implement proper password hashing (bcrypt) before production
- Enable Row Level Security (RLS) in Supabase for production

📝 **Password Hashing (TODO)**
- Currently passwords are stored as plain text (NOT SECURE)
- Implement bcrypt in auth.controller.js before production deployment

🔒 **Next Steps**
- Setup JWT token validation middleware
- Implement password hashing with bcrypt
- Setup RLS policies in Supabase
- Add email verification
- Add password reset functionality

## Troubleshooting

**Error: "Relation does not exist"**
→ Make sure you ran the SQL migrations in Supabase SQL Editor

**Error: "Invalid credentials"**
→ Check SUPABASE_URL and SUPABASE_ANON_KEY in .env

**Error: "User not found"**
→ Make sure sample data was inserted correctly

For more help: https://supabase.com/docs
