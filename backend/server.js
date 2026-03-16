require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const cors = require('cors');
const bcryptjs = require('bcryptjs');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const turf = require('@turf/turf');
const multer = require('multer');
const { OAuth2Client } = require('google-auth-library');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

function getAuthToken(req) {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
        return null;
    }

    return header.slice('Bearer '.length).trim();
}

function authenticateOptional(req, res, next) {
    const token = getAuthToken(req);

    if (!token) {
        return next();
    }

    try {
        const payload = jwt.verify(token, jwtSecret);
        req.user = {
            id: payload.sub,
            email: payload.email,
            role: payload.role
        };
        return next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}

function requireAuth(req, res, next) {
    if (!req.user?.id) {
        return res.status(401).json({ message: 'Bạn cần đăng nhập để thực hiện thao tác này.' });
    }

    return next();
}

function normalizeNullable(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    return value;
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
// FEEDBACK SUPPORT
// ==========================================
const feedbackUploadDir = path.join(__dirname, 'uploads', 'feedback');
if (!fs.existsSync(feedbackUploadDir)) {
    fs.mkdirSync(feedbackUploadDir, { recursive: true });
}

const feedbackStorage = multer.diskStorage({
    destination: feedbackUploadDir,
    filename: (_req, file, cb) => {
        const safeName = file.originalname.replace(/\s+/g, '-');
        cb(null, `${Date.now()}-${safeName}`);
    }
});

const uploadFeedback = multer({
    storage: feedbackStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/png', 'image/jpeg', 'application/pdf'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file type'));
        }
    }
});

const FEEDBACK_CATEGORIES = ['bug', 'feature', 'ui', 'data', 'performance', 'payment', 'other'];

const TERMS_OF_USE = {
    title: 'Quy định chung của SMART CITY DISCOVERY',
    intro: 'Bằng việc sử dụng nền tảng, bạn đồng ý tuân thủ các quy định dưới đây để đảm bảo trải nghiệm an toàn và minh bạch cho cộng đồng.',
    sections: [
        {
            heading: 'Quy định chung của SMART CITY DISCOVERY',
            items: [
                {
                    title: 'Nghiêm cấm đăng tải thông tin sai lệch.',
                    description: 'Người dùng phải đảm bảo thông tin về địa điểm, dịch vụ hoặc nội dung đăng tải là chính xác và không gây hiểu nhầm cho người khác.'
                },
                {
                    title: 'Nghiêm cấm hành vi quấy rối, xúc phạm.',
                    description: 'Không sử dụng nền tảng để đăng tải nội dung xúc phạm, phân biệt đối xử hoặc gây ảnh hưởng tiêu cực đến người dùng khác.'
                },
                {
                    title: 'Bảo mật thông tin cá nhân.',
                    description: 'Người dùng không được chia sẻ thông tin cá nhân của người khác khi chưa có sự đồng ý.'
                },
                {
                    title: 'Tôn trọng bản quyền nội dung.',
                    description: 'Không đăng tải hình ảnh, video hoặc nội dung thuộc bản quyền của người khác khi chưa được cho phép.'
                },
                {
                    title: 'Tuân thủ pháp luật hiện hành.',
                    description: 'Mọi hoạt động trên nền tảng phải tuân thủ pháp luật Việt Nam và các quy định liên quan.'
                }
            ]
        },
        {
            heading: 'Quy định của người đăng địa điểm / nội dung',
            items: [
                {
                    title: 'Thông tin chính xác.',
                    description: 'Người đăng địa điểm phải cung cấp thông tin chính xác về tên địa điểm, loại dịch vụ, vị trí và mô tả liên quan.'
                },
                {
                    title: 'Hình ảnh rõ ràng.',
                    description: 'Hình ảnh địa điểm hoặc dịch vụ phải là hình ảnh thực tế, không sử dụng hình ảnh không liên quan hoặc gây hiểu lầm.'
                },
                {
                    title: 'Nội dung phù hợp.',
                    description: 'Nội dung đăng tải phải phù hợp với mục đích của nền tảng, không chứa nội dung phản cảm, quảng cáo sai sự thật hoặc spam.'
                },
                {
                    title: 'Hợp tác với quản trị viên.',
                    description: 'Người đăng cần hợp tác với quản trị viên trong việc xác minh thông tin hoặc chỉnh sửa nội dung khi cần thiết.'
                }
            ]
        },
        {
            heading: 'Quy định của người sử dụng nền tảng',
            items: [
                {
                    title: 'Kiểm tra thông tin.',
                    description: 'Người dùng nên kiểm tra thông tin địa điểm và đánh giá từ cộng đồng trước khi quyết định sử dụng dịch vụ.'
                },
                {
                    title: 'Sử dụng nền tảng đúng mục đích.',
                    description: 'Người dùng không được lợi dụng nền tảng để spam, quảng cáo trái phép hoặc gây ảnh hưởng đến trải nghiệm của người khác.'
                },
                {
                    title: 'Phản hồi sau trải nghiệm.',
                    description: 'Người dùng được khuyến khích đánh giá và phản hồi về trải nghiệm của mình để giúp cộng đồng có thêm thông tin tham khảo.'
                },
                {
                    title: 'Báo cáo vi phạm.',
                    description: 'Nếu phát hiện nội dung sai lệch, spam hoặc vi phạm quy định, người dùng cần báo cáo cho quản trị viên để xử lý kịp thời.'
                }
            ]
        }
    ]
};

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
// USER PROFILE APIS
// ==========================================

app.get('/api/users/profile', authenticateOptional, async (req, res) => {
    try {
        const userId = req.user?.id;
        const email = req.query?.email;

        if (!userId && !email) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const result = userId
            ? await pool.query(
                `SELECT id, username, fullname, email, phone, birth_date AS "birthDate",
                        address, gender, bio, role
                 FROM users
                 WHERE id = $1`,
                [userId]
            )
            : await pool.query(
                `SELECT id, username, fullname, email, phone, birth_date AS "birthDate",
                        address, gender, bio, role
                 FROM users
                 WHERE email = $1`,
                [email]
            );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });
    } catch (err) {
        console.error('Profile fetch error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

app.put('/api/users/profile', authenticateOptional, requireAuth, async (req, res) => {
    const userId = req.user.id;
    const { fullname, email, phone, birthDate, address, gender, bio } = req.body;

    try {
        if (!fullname) {
            return res.status(400).json({ message: 'Vui lòng nhập họ tên.' });
        }

        if (phone && !/^\d{10}$/.test(phone)) {
            return res.status(400).json({ message: 'Số điện thoại không đúng định dạng.' });
        }

        if (birthDate && !/^\d{2}\/\d{2}\/\d{4}$/.test(birthDate)) {
            return res.status(400).json({ message: 'Ngày sinh phải theo định dạng DD/MM/YYYY.' });
        }

        if (email) {
            const emailCheck = await pool.query(
                'SELECT 1 FROM users WHERE email = $1 AND id <> $2 LIMIT 1',
                [email, userId]
            );
            if (emailCheck.rows.length > 0) {
                return res.status(409).json({ message: 'Email đã tồn tại.' });
            }
        }

        if (phone) {
            const phoneCheck = await pool.query(
                'SELECT 1 FROM users WHERE phone = $1 AND id <> $2 LIMIT 1',
                [phone, userId]
            );
            if (phoneCheck.rows.length > 0) {
                return res.status(409).json({ message: 'Số điện thoại đã tồn tại.' });
            }
        }

        if (address) {
            const addressCheck = await pool.query(
                'SELECT 1 FROM users WHERE address = $1 AND id <> $2 LIMIT 1',
                [address, userId]
            );
            if (addressCheck.rows.length > 0) {
                return res.status(409).json({ message: 'Địa chỉ đã tồn tại.' });
            }
        }

        const result = await pool.query(
            `UPDATE users
             SET fullname = $1,
                 phone = $2,
                 birth_date = $3,
                 address = $4,
                 gender = $5,
                 bio = $6,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $7
             RETURNING id, username, fullname, email, phone, birth_date AS "birthDate",
                       address, gender, bio, role`,
            [
                fullname,
                normalizeNullable(phone),
                normalizeNullable(birthDate),
                normalizeNullable(address),
                normalizeNullable(gender),
                normalizeNullable(bio),
                userId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: result.rows[0]
        });
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

app.put('/api/users/password', authenticateOptional, requireAuth, async (req, res) => {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    try {
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 8 ký tự.' });
        }

        if (!/[A-Z]/.test(newPassword)) {
            return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 1 chữ in hoa (A-Z).' });
        }

        if (!/[!@#$%^&*()_+\-=\[\]{};:'",.<>?\/\\|`~]/.test(newPassword)) {
            return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 1 ký tự đặc biệt.' });
        }

        const userResult = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        }

        const currentHash = userResult.rows[0].password;
        const isPasswordValid = await bcryptjs.compare(currentPassword, currentHash);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng.' });
        }

        const newHashedPassword = await bcryptjs.hash(newPassword, 10);
        await pool.query(
            'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newHashedPassword, userId]
        );

        res.json({ success: true, message: 'Đổi mật khẩu thành công.' });
    } catch (err) {
        console.error('Password update error:', err);
        res.status(500).json({ message: 'Server error' });
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
app.post('/api/v1/feedback', (req, res) => {
    uploadFeedback.single('attachment')(req, res, async (uploadErr) => {
        if (uploadErr) {
            return res.status(400).json({ message: uploadErr.message || 'Upload failed' });
        }

        const { category, message, contactEmail, contactPhone } = req.body;

        if (!category || !message || !message.trim()) {
            return res.status(400).json({ message: 'Category and message are required' });
        }

        const normalizedCategory = FEEDBACK_CATEGORIES.includes(category) ? category : 'other';
        const attachmentUrl = req.file ? `/uploads/feedback/${req.file.filename}` : null;

        try {
            const insertQuery = `
                INSERT INTO feedbacks (category, issue_type, message, contact_email, contact_phone, attachment_url)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *;
            `;

            const { rows } = await pool.query(insertQuery, [
                normalizedCategory,
                normalizedCategory,
                message.trim(),
                contactEmail || null,
                contactPhone || null,
                attachmentUrl
            ]);

            res.status(201).json({ message: 'Feedback submitted', feedback: rows[0] });
        } catch (err) {
            console.error('Feedback submission error:', err);
            res.status(500).json({ message: 'Unable to submit feedback' });
        }
    });
});

app.get('/api/v1/terms', (_req, res) => {
    res.json({
        lastUpdated: '2026-03-16',
        ...TERMS_OF_USE
    });
});

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
