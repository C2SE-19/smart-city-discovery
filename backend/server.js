require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcryptjs = require('bcryptjs');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const turf = require('@turf/turf');
const { OAuth2Client } = require('google-auth-library');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Google OAuth2 Client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const FALLBACK_JWT_SECRET = 'smart-city-discovery-dev-secret-change-me';
const jwtSecret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || FALLBACK_JWT_SECRET;
const accessTokenTtl = process.env.ACCESS_TOKEN_TTL || '7d';

if (jwtSecret === FALLBACK_JWT_SECRET) {
    console.warn('⚠️ JWT_SECRET is not set. Using development fallback secret. Please set JWT_SECRET in production.');
}

function normalizeRole(role) {
    const normalizedRole = (role || '').toString().trim().toLowerCase();
    if (['admin', 'merchant', 'user'].includes(normalizedRole)) {
        return normalizedRole;
    }

    return 'user';
}

function generateAccessToken(user) {
    return jwt.sign(
        {
            sub: user.id,
            email: user.email,
            role: normalizeRole(user.role)
        },
        jwtSecret,
        { expiresIn: accessTokenTtl }
    );
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
  } else {
    console.log('✅ Database connected:', res.rows[0]);
  }
});

// ==========================================
// CORE SYSTEM APIs
// ==========================================

// API 1: Get ward boundary data to send to Frontend for map drawing
app.get('/api/wards', async (req, res) => {
    try {
        const result = await pool.query('SELECT ward_id, name, boundary FROM wards');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// API 1.5: Get all venues list to draw markers on map
app.get('/api/venues', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM venues ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API 2: Receive venue coordinates, use AI to detect Ward and save to Database
app.post('/api/venues', async (req, res) => {
    const { name, address, latitude, longitude } = req.body;

    try {
        // 1. Use Turf.js to convert coordinates [Longitude, Latitude] into a "Point" on the map
        const pt = turf.point([longitude, latitude]);

        // 2. Get all Wards from Database
        const wardsResult = await pool.query('SELECT ward_id, name, boundary FROM wards');
        
        let detectedWardId = null;
        let detectedWardName = 'Not detected (Outside boundary)';

        // 3. MATCHING ALGORITHM: Which ward contains this venue?
        for (let ward of wardsResult.rows) {
            const features = ward.boundary.features;
            
            // Iterate through polygon segments of the ward
            for (let feature of features) {
                if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                    // Magic with Turf.js: Check if Point is inside Polygon?
                    if (turf.booleanPointInPolygon(pt, feature)) {
                        detectedWardId = ward.ward_id;
                        detectedWardName = ward.name;
                        break;
                    }
                }
            }
            if (detectedWardId) break; // Found ward, stop loop to save resources
        }

        // 4. Save venue in DB with automatically detected ward ID
        const insertQuery = `
            INSERT INTO venues (name, address, latitude, longitude, ward_id)
            VALUES ($1, $2, $3, $4, $5) RETURNING *;
        `;
        const newVenue = await pool.query(insertQuery, [name, address, latitude, longitude, detectedWardId]);

        // Return result to UI
        res.json({
            message: 'Venue saved successfully!',
            detected_ward: detectedWardName,
            data: newVenue.rows[0]
        });

    } catch (err) {
        console.error('API error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==========================================
// REGISTRATION AND LOGIN APIS
// ==========================================

// API: Register new user
app.post('/api/register', async (req, res) => {
    const { fullname, username, email, password } = req.body;

    try {
        // Check input data
        if (!fullname || !username || !email || !password) {
            return res.status(400).json({ message: 'Please provide all required information' });
        }

        // Validate password: 8+ characters with uppercase letter and special character
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};:'",.<>?\/\\|`~]/.test(password);
        
        if (password.length < minLength) {
            return res.status(400).json({ message: `Password must be at least ${minLength} characters long` });
        }
        
        if (!hasUpperCase) {
            return res.status(400).json({ message: 'Password must contain at least 1 uppercase letter (A-Z)' });
        }
        
        if (!hasSpecialChar) {
            return res.status(400).json({ message: 'Password must contain at least 1 special character (!@#$%^&*)' });
        }

        // Check if email already exists
        const emailCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (emailCheck.rows.length > 0) {
            return res.status(400).json({ message: 'This email is already registered' });
        }

        // Check if username already exists
        const usernameCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (usernameCheck.rows.length > 0) {
            return res.status(400).json({ message: 'This username is already taken' });
        }

        // Hash password
        const hashedPassword = await bcryptjs.hash(password, 10);

        // Add user to database
        const insertQuery = `
            INSERT INTO users (fullname, username, email, password, role)
            VALUES ($1, $2, $3, $4, $5) RETURNING id, fullname, username, email, role;
        `;
        const result = await pool.query(insertQuery, [fullname, username, email, hashedPassword, 'user']);

        const createdUser = result.rows[0];

        res.status(201).json({
            message: 'Registration successful!',
            user: {
                ...createdUser,
                role: normalizeRole(createdUser.role)
            }
        });

    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ message: 'Server error, please try again later' });
    }
});

// API: User login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Check input data
        if (!username || !password) {
            return res.status(400).json({ message: 'Please enter username and password' });
        }

        // Find user by username
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Username does not exist' });
        }

        const user = result.rows[0];

        // Check password
        const isPasswordValid = await bcryptjs.compare(password, user.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Incorrect password' });
        }

        const userRole = normalizeRole(user.role);
        const accessToken = generateAccessToken({
            id: user.id,
            email: user.email,
            role: userRole
        });

        // Login successful
        res.json({
            message: 'Login successful!',
            token: accessToken,
            user: {
                id: user.id,
                fullname: user.fullname,
                username: user.username,
                email: user.email,
                role: userRole
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error, please try again later' });
    }
});

// ==========================================
// GOOGLE OAUTH
// ==========================================
app.post('/api/auth/google', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ message: 'Token is required' });
        }

        // Verify Google ID Token
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const email = payload.email;
        const name = payload.name;

        if (!email) {
            return res.status(400).json({ message: 'Failed to get email from Google' });
        }

        // Check if user exists
        let user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (user.rows.length === 0) {
            // Create new user from Google
            const username = email.split('@')[0] + '_' + Math.random().toString(36).substring(7);
            const hashedPassword = await bcryptjs.hash(Math.random().toString(), 10);

            const insertQuery = `
                INSERT INTO users (fullname, username, email, password, role)
                VALUES ($1, $2, $3, $4, $5) RETURNING id, fullname, username, email, role;
            `;
            user = await pool.query(insertQuery, [name || username, username, email, hashedPassword, 'user']);
        }

        const userData = user.rows[0];
        const userRole = normalizeRole(userData.role);

        // Generate JWT token
        const jwtToken = generateAccessToken({
            id: userData.id,
            email: userData.email,
            role: userRole
        });

        res.json({
            message: 'Login with Google successful!',
            token: jwtToken,
            user: {
                id: userData.id,
                fullname: userData.fullname,
                username: userData.username,
                email: userData.email,
                role: userRole
            }
        });

    } catch (err) {
        console.error('Google OAuth error:', err.message);
        res.status(500).json({ message: 'Failed to authenticate with Google: ' + err.message });
    }
});

// ==========================================
// FACEBOOK OAUTH
// ==========================================
app.post('/api/auth/facebook', async (req, res) => {
    try {
        const { accessToken } = req.body;

        if (!accessToken) {
            return res.status(400).json({ message: 'Access token is required' });
        }

        // Get user info from Facebook
        const response = await axios.get(
            `https://graph.facebook.com/me?access_token=${accessToken}&fields=id,name,email,picture`
        );

        const { email, name } = response.data;

        if (!email) {
            return res.status(400).json({ message: 'Failed to get email from Facebook' });
        }

        // Check if user exists
        let user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (user.rows.length === 0) {
            // Create new user from Facebook
            const username = email.split('@')[0] + '_' + Math.random().toString(36).substring(7);
            const hashedPassword = await bcryptjs.hash(Math.random().toString(), 10);

            const insertQuery = `
                INSERT INTO users (fullname, username, email, password, role)
                VALUES ($1, $2, $3, $4, $5) RETURNING id, fullname, username, email, role;
            `;
            user = await pool.query(insertQuery, [name || username, username, email, hashedPassword, 'user']);
        }

        const userData = user.rows[0];
        const userRole = normalizeRole(userData.role);

        // Generate JWT token
        const jwtToken = generateAccessToken({
            id: userData.id,
            email: userData.email,
            role: userRole
        });

        res.json({
            message: 'Login with Facebook successful!',
            token: jwtToken,
            user: {
                id: userData.id,
                fullname: userData.fullname,
                username: userData.username,
                email: userData.email,
                role: userRole
            }
        });

    } catch (err) {
        console.error('Facebook OAuth error:', err.message);
        res.status(500).json({ message: 'Failed to authenticate with Facebook: ' + err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Backend server is running at http://localhost:${PORT}`);
});