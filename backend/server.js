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
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const { supabaseAdmin } = require('./src/lib/supabase');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
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

function registerVersionedRoute(method, path, ...handlers) {
    app[method](`/api${path}`, ...handlers);
    app[method](`/api/v1${path}`, ...handlers);
}

function extractBearerToken(req) {
    const authorizationHeader = req.headers.authorization || '';
    if (!authorizationHeader.startsWith('Bearer ')) {
        return '';
    }

    return authorizationHeader.slice(7).trim();
}

function authenticateRequest(req, res, next) {
    const token = extractBearerToken(req);

    if (!token) {
        return res.status(401).json({ message: 'Missing authentication token' });
    }

    try {
        const payload = jwt.verify(token, jwtSecret);

        req.authUser = {
            id: payload.sub,
            email: payload.email,
            role: normalizeRole(payload.role)
        };

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

function getAuthToken(req) {
    return extractBearerToken(req) || null;
}

function authenticateOptional(req, res, next) {
    const token = getAuthToken(req);

    if (!token) {
        return next();
    }

    try {
        const payload = jwt.verify(token, jwtSecret);

        req.authUser = {
            id: payload.sub,
            email: payload.email,
            role: normalizeRole(payload.role)
        };

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

function requireAdminRole(req, res, next) {
    const role = normalizeRole(req.authUser?.role);

    if (role !== 'admin') {
        return res.status(403).json({ message: 'Admin permission is required' });
    }

    return next();
}

function requireAuth(req, res, next) {
    if (!req.user?.id) {
        return res.status(401).json({ message: 'B???n c???n ????ng nh???p ????? th???c hi???n thao t??c n??y.' });
    }

    return next();
}

function normalizeStatusList(statusInput) {
    if (!statusInput) {
        return [];
    }

    const normalized = String(statusInput)
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);

    const allowedStatuses = new Set(['draft', 'pending', 'approved', 'rejected', 'hidden']);
    return normalized.filter((value) => allowedStatuses.has(value));
}

function normalizeCategoryId(value) {
    return normalizeNullableNumber(value);
}

function normalizeServiceIds(input) {
    if (!Array.isArray(input)) {
        return [];
    }

    const normalized = input
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0);

    return [...new Set(normalized)];
}

function parsePositiveIntegerList(input) {
    if (input === undefined || input === null || input === '') {
        return { values: [], invalid: false };
    }

    const rawItems = Array.isArray(input)
        ? input.flatMap((value) => String(value).split(','))
        : String(input).split(',');

    const values = [];

    for (const item of rawItems) {
        const trimmed = String(item).trim();

        if (!trimmed) {
            continue;
        }

        const parsed = Number(trimmed);

        if (!Number.isInteger(parsed) || parsed <= 0) {
            return { values: [], invalid: true };
        }

        values.push(parsed);
    }

    return { values: [...new Set(values)], invalid: false };
}

function parseTextList(input) {
    if (input === undefined || input === null || input === '') {
        return [];
    }

    const rawItems = Array.isArray(input)
        ? input.flatMap((value) => String(value).split(','))
        : String(input).split(',');

    return [...new Set(rawItems.map((value) => String(value).trim()).filter(Boolean))];
}

function normalizeNullableNumber(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return Number.NaN;
    }

    return parsed;
}

function normalizeNullableText(value) {
    if (value === undefined || value === null) {
        return null;
    }

    const trimmed = String(value).trim();
    return trimmed === '' ? null : trimmed;
}

function slugifyText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function sanitizeTextField(value) {
    if (value === undefined || value === null) {
        return null;
    }

    const text = String(value);
    if (text.toLowerCase() === 'nan') {
        return null;
    }

    return text;
}

function isValidEmail(value) {
    if (value === undefined || value === null) {
        return false;
    }

    const normalized = String(value).trim();
    if (!normalized) {
        return false;
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatMultilineHtml(value) {
    return escapeHtml(value).replace(/\n/g, '<br />');
}

function normalizeFeedbackStatusLabel(value) {
    const map = {
        new: 'New',
        in_progress: 'In Progress',
        replied: 'Replied',
        closed: 'Closed'
    };

    return map[String(value || '').toLowerCase()] || 'Replied';
}

function formatFeedbackTimestamp(value) {
    if (!value) {
        return 'N/A';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'N/A';
    }

    return date.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

function normalizeFeedbackStatusList(statusInput) {
    if (!statusInput) {
        return [];
    }

    const allowedStatuses = new Set(['new', 'in_progress', 'replied', 'closed']);

    return String(statusInput)
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter((value) => allowedStatuses.has(value));
}

function normalizePaginationValue(value, fallback, { min = 1, max = 100 } = {}) {
    const parsed = Number(value);

    if (!Number.isInteger(parsed)) {
        return fallback;
    }

    return Math.min(Math.max(parsed, min), max);
}

function shouldUseDatabaseSsl() {
    const sslValue = String(process.env.DB_SSL || process.env.PGSSLMODE || '').trim().toLowerCase();

    if (['false', '0', 'disable', 'off', 'no'].includes(sslValue)) {
        return false;
    }

    if (['true', '1', 'require', 'on', 'yes'].includes(sslValue)) {
        return true;
    }

    // Default to no SSL for local/self-hosted development to avoid connection failures.
    return false;
}

function buildDatabasePoolConfig() {
    const connectionString = String(process.env.DATABASE_URL || '').trim();
    const config = connectionString
        ? {
              connectionString
          }
        : {
              host: process.env.DB_HOST || '127.0.0.1',
              port: Number(process.env.DB_PORT) || 5432,
              user: process.env.DB_USER || 'postgres',
              password: String(process.env.DB_PASSWORD ?? ''),
              database: process.env.DB_NAME || 'postgres'
          };

    if (shouldUseDatabaseSsl()) {
        config.ssl = {
            rejectUnauthorized: false
        };
    }

    return config;
}

function resolveUploadPathFromUrl(fileUrl) {
    if (!fileUrl || typeof fileUrl !== 'string') {
        return null;
    }

    const normalizedUrl = fileUrl.replace(/\\/g, '/');
    if (!normalizedUrl.startsWith('/uploads/')) {
        return null;
    }

    const relativePath = normalizedUrl.replace('/uploads/', '');
    const uploadsRoot = path.resolve(path.join(__dirname, 'uploads'));
    const targetPath = path.resolve(path.join(uploadsRoot, relativePath));

    if (!targetPath.startsWith(uploadsRoot)) {
        return null;
    }

    return targetPath;
}

function safeDeleteUploadedFile(fileUrl) {
    const targetPath = resolveUploadPathFromUrl(fileUrl);

    if (!targetPath || !fs.existsSync(targetPath)) {
        return;
    }

    try {
        fs.unlinkSync(targetPath);
    } catch (error) {
        console.warn(`Unable to delete uploaded file ${targetPath}:`, error.message);
    }
}

async function generateWardIdFromName(name) {
                const fallbackSeed = Date.now().toString().slice(-6);
                const baseSlug = slugifyText(name).slice(0, 42) || `ward-${fallbackSeed}`;
                let candidate = baseSlug;
                let suffix = 1;

                // Keep deriving a suffix until the ward id is unique.
                while (true) {
                    const exists = await pool.query(
                        `
                SELECT 1
                FROM wards
                WHERE ward_id = $1
                LIMIT 1
            `,
                        [candidate]
                    );

                    if (!exists.rows.length) {
                        return candidate;
                    }

                    candidate = `${baseSlug.slice(0, 40)}-${suffix}`;
                    suffix += 1;
                }
            }

            function extractBoundaryFeatures(boundary) {
                if (!boundary || typeof boundary !== 'object') {
                    return [];
                }

                if (boundary.type === 'FeatureCollection' && Array.isArray(boundary.features)) {
                    return boundary.features;
                }

                if (boundary.type === 'Feature') {
                    return [boundary];
                }

                return [];
            }

            function validateBoundaryGeoJson(boundary) {
                const features = extractBoundaryFeatures(boundary);

                if (!features.length) {
                    return false;
                }

                return features.some((feature) => {
                    const geometryType = feature?.geometry?.type;
                    return geometryType === 'Polygon' || geometryType === 'MultiPolygon';
                });
            }

            function canonicalizeJsonValue(value) {
                if (Array.isArray(value)) {
                    return value.map((item) => canonicalizeJsonValue(item));
                }

                if (value && typeof value === 'object') {
                    return Object.keys(value)
                        .sort()
                        .reduce((result, key) => {
                            result[key] = canonicalizeJsonValue(value[key]);
                            return result;
                        }, {});
                }

                return value;
            }

            function areJsonValuesEqual(firstValue, secondValue) {
                return JSON.stringify(canonicalizeJsonValue(firstValue)) === JSON.stringify(canonicalizeJsonValue(secondValue));
            }

            function normalizeCoordinateValue(value) {
                if (typeof value !== 'number' || !Number.isFinite(value)) {
                    return value;
                }

                return Number(value.toFixed(6));
            }

            function normalizeGeometryCoordinates(coordinates) {
                if (!Array.isArray(coordinates)) {
                    return normalizeCoordinateValue(coordinates);
                }

                return coordinates.map((item) => normalizeGeometryCoordinates(item));
            }

            function buildBoundaryGeometrySignature(boundary) {
                const features = extractBoundaryFeatures(boundary);

                const geometrySignatures = features
                    .map((feature) => feature?.geometry)
                    .filter((geometry) => geometry && ['Polygon', 'MultiPolygon'].includes(geometry.type))
                    .map((geometry) =>
                        JSON.stringify(
                            canonicalizeJsonValue({
                                type: geometry.type,
                                coordinates: normalizeGeometryCoordinates(geometry.coordinates)
                            })
                        )
                    )
                    .sort();

                if (!geometrySignatures.length) {
                    return '';
                }

                return JSON.stringify(geometrySignatures);
            }

            function haveSameBoundaryGeometry(firstBoundary, secondBoundary) {
                const firstSignature = buildBoundaryGeometrySignature(firstBoundary);
                const secondSignature = buildBoundaryGeometrySignature(secondBoundary);

                return Boolean(firstSignature) && firstSignature === secondSignature;
            }

            async function detectWardByCoordinates(latitude, longitude) {
                const point = turf.point([longitude, latitude]);
                const wardsResult = await pool.query('SELECT ward_id, name, boundary FROM wards');

                let detectedWardId = null;
                let detectedWardName = 'Not detected (Outside boundary)';

                for (const ward of wardsResult.rows) {
                    const features = extractBoundaryFeatures(ward.boundary);

                    for (const feature of features) {
                        const geometryType = feature?.geometry?.type;

                        if (geometryType !== 'Polygon' && geometryType !== 'MultiPolygon') {
                            continue;
                        }

                        if (turf.booleanPointInPolygon(point, feature)) {
                            detectedWardId = ward.ward_id;
                            detectedWardName = ward.name;
                            break;
                        }
                    }

                    if (detectedWardId) {
                        break;
                    }
                }

                return {
                    wardId: detectedWardId,
                    wardName: detectedWardName
                };
            }

        const pool = new Pool(buildDatabasePoolConfig());
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

        const feedbackReplyUploadDir = path.join(feedbackUploadDir, 'admin-replies');
        if (!fs.existsSync(feedbackReplyUploadDir)) {
            fs.mkdirSync(feedbackReplyUploadDir, { recursive: true });
        }

        const feedbackStorage = multer.diskStorage({
            destination: feedbackUploadDir,
            filename: (_req, file, cb) => {
                const safeName = file.originalname.replace(/\s+/g, '-');
                cb(null, `${Date.now()}-${safeName}`);
            }
        });

        const feedbackReplyStorage = multer.diskStorage({
            destination: feedbackReplyUploadDir,
            filename: (_req, file, cb) => {
                const safeName = file.originalname.replace(/\s+/g, '-');
                cb(null, `${Date.now()}-admin-${safeName}`);
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

        // ==========================================
        // AVATAR UPLOAD
        // ==========================================
        const uploadAvatar = multer({
            storage: multer.memoryStorage(),
            limits: { fileSize: 20 * 1024 * 1024 },
            fileFilter: (_req, file, cb) => {
                const allowed = ['image/png', 'image/jpeg', 'image/webp'];
                if (allowed.includes(file.mimetype)) {
                    cb(null, true);
                } else {
                    cb(new Error('Unsupported file type'));
                }
            }
        });

        const FEEDBACK_CATEGORIES = ['bug', 'feature', 'ui', 'data', 'performance', 'payment', 'other'];
        const uploadFeedbackReply = multer({
            storage: feedbackReplyStorage,
            limits: { fileSize: 8 * 1024 * 1024 },
            fileFilter: (_req, file, cb) => {
                const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
                if (allowed.includes(file.mimetype)) {
                    cb(null, true);
                } else {
                    cb(new Error('Only image attachments are supported for admin replies'));
                }
            }
        });

        const DEFAULT_FEEDBACK_TYPES = [
            {
                code: 'bug',
                name: 'Feature Bug',
                description: 'Something is broken or not working as expected.',
                sortOrder: 10
            },
            {
                code: 'feature',
                name: 'Feature Request',
                description: 'Suggest a new capability or enhancement.',
                sortOrder: 20
            },
            {
                code: 'ui',
                name: 'UI/UX Suggestion',
                description: 'Feedback about layout, styling, or interaction flow.',
                sortOrder: 30
            },
            {
                code: 'data',
                name: 'Data/Map Issue',
                description: 'Report incorrect location data, map mismatch, or missing place.',
                sortOrder: 40
            },
            {
                code: 'performance',
                name: 'Performance Issue',
                description: 'Slow loading, lag, or stability concerns.',
                sortOrder: 50
            },
            {
                code: 'payment',
                name: 'Payment/Booking Issue',
                description: 'Problems related to payment or booking experience.',
                sortOrder: 60
            },
            {
                code: 'other',
                name: 'Other',
                description: 'Any issue that does not fit into predefined categories.',
                sortOrder: 70
            }
        ];

        const FEEDBACK_CATEGORY_CODES = new Set(DEFAULT_FEEDBACK_TYPES.map((item) => item.code));

        const DEFAULT_FEEDBACK_REPLY_GMAIL = 'smartcity.discovery2026@gmail.com';

        const feedbackReplySmtpUser = String(
            process.env.FEEDBACK_GMAIL_USER || process.env.GMAIL_USER || DEFAULT_FEEDBACK_REPLY_GMAIL
        ).trim();
        const feedbackReplySmtpPass = String(
            process.env.FEEDBACK_GMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD || ''
        ).trim();
        const feedbackReplyFromName =
            String(process.env.FEEDBACK_REPLY_FROM_NAME || '').trim() || 'Smart City Discovery Support';
        const feedbackReplyFromEmail =
            String(process.env.FEEDBACK_REPLY_FROM_EMAIL || '').trim() || feedbackReplySmtpUser || DEFAULT_FEEDBACK_REPLY_GMAIL;

        const feedbackReplyTransporter =
            feedbackReplySmtpUser && feedbackReplySmtpPass
                ? nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: feedbackReplySmtpUser,
                        pass: feedbackReplySmtpPass
                    }
                })
                : null;

        if (!feedbackReplyTransporter) {
            console.warn(
                '⚠️ FEEDBACK_GMAIL_USER/FEEDBACK_GMAIL_APP_PASSWORD is not configured. Admin feedback reply email is disabled.'
            );
        }

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

        async function listPublicWards(req, res) {
            try {
                const result = await pool.query(
                    `
                SELECT ward_id, name, boundary
                FROM wards
                ORDER BY name ASC
            `
                );
                res.json(result.rows);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        }

        async function listPublicVenues(req, res) {
            try {
                const statusFilter = normalizeStatusList(req.query.status);
                const isMineRequest = String(req.query.mine || '').trim().toLowerCase() === 'true';
                const requesterId = req.authUser?.id ? String(req.authUser.id).trim() : '';
                const isAdmin = normalizeRole(req.authUser?.role) === 'admin';
                const effectiveStatuses = isMineRequest
                    ? statusFilter.length
                        ? statusFilter
                        : ['approved', 'pending', 'rejected']
                    : isAdmin && statusFilter.length
                      ? statusFilter
                      : ['approved'];
                const categoryId = normalizeCategoryId(req.query.categoryId);
                const categoryIdsFilter = parsePositiveIntegerList(req.query.categoryIds);
                const serviceIdsFilter = parsePositiveIntegerList(req.query.serviceIds);
                const wardIdsFilter = parseTextList(req.query.wardIds);
                const singleWardId = normalizeNullableText(req.query.wardId);
                const searchKeyword = String(req.query.q ?? req.query.search ?? '').trim().toLowerCase();

                if (isMineRequest && !requesterId) {
                    return res.status(401).json({ message: 'Missing authentication token' });
                }

                if (Number.isNaN(categoryId)) {
                    return res.status(400).json({ message: 'categoryId must be a positive integer' });
                }

                if (categoryIdsFilter.invalid) {
                    return res
                        .status(400)
                        .json({ message: 'categoryIds must be a comma-separated list of positive integers' });
                }

                if (serviceIdsFilter.invalid) {
                    return res
                        .status(400)
                        .json({ message: 'serviceIds must be a comma-separated list of positive integers' });
                }

                const effectiveCategoryIds = [...categoryIdsFilter.values];

                if (categoryId !== null && !effectiveCategoryIds.includes(categoryId)) {
                    effectiveCategoryIds.push(categoryId);
                }

                const effectiveWardIds = [...wardIdsFilter];

                if (singleWardId && !effectiveWardIds.includes(singleWardId)) {
                    effectiveWardIds.push(singleWardId);
                }

                const values = [effectiveStatuses];
                const whereConditions = ['venues.status::text = ANY($1::text[])'];

                if (isMineRequest) {
                    values.push(requesterId);
                    whereConditions.push(`venues.submitted_by_user_id = $${values.length}`);
                }

                if (effectiveCategoryIds.length) {
                    values.push(effectiveCategoryIds);
                    whereConditions.push(`venues.category_id = ANY($${values.length}::int[])`);
                }

                if (effectiveWardIds.length) {
                    values.push(effectiveWardIds);
                    whereConditions.push(`venues.ward_id::text = ANY($${values.length}::text[])`);
                }

                if (serviceIdsFilter.values.length) {
                    values.push(serviceIdsFilter.values);
                    whereConditions.push(`
                        EXISTS (
                            SELECT 1
                            FROM jsonb_array_elements_text(COALESCE(venues.metadata->'selectedServices', '[]'::jsonb)) AS selected(value)
                            WHERE selected.value ~ '^[0-9]+$'
                              AND selected.value::int = ANY($${values.length}::int[])
                        )
                    `);
                }

                if (searchKeyword) {
                    values.push(`%${searchKeyword}%`);
                    const searchParamIndex = values.length;

                    whereConditions.push(`
                        (
                            LOWER(COALESCE(venues.name, '')) LIKE $${searchParamIndex}
                            OR LOWER(COALESCE(venues.title, '')) LIKE $${searchParamIndex}
                            OR LOWER(COALESCE(venues.address, '')) LIKE $${searchParamIndex}
                            OR LOWER(COALESCE(venues.description, '')) LIKE $${searchParamIndex}
                            OR LOWER(COALESCE(wards.name, '')) LIKE $${searchParamIndex}
                            OR LOWER(COALESCE(place_categories.name, '')) LIKE $${searchParamIndex}
                            OR EXISTS (
                                SELECT 1
                                FROM jsonb_array_elements_text(COALESCE(venues.metadata->'selectedServiceNames', '[]'::jsonb)) AS service_name(value)
                                WHERE LOWER(service_name.value) LIKE $${searchParamIndex}
                            )
                        )
                    `);
                }

                const result = await pool.query(
                    `
                SELECT
                    venues.id,
                    venues.name,
                    venues.title,
                    venues.address,
                    venues.description,
                    venues.phone,
                    venues.latitude,
                    venues.longitude,
                    venues.ward_id,
                    wards.name AS ward_name,
                    venues.category_id,
                    place_categories.name AS category_name,
                    place_categories.slug AS category_slug,
                    venues.cover_image_url,
                    venues.business_license_image_url,
                    venues.metadata,
                    venues.submitted_by_user_id,
                    venues.status::text AS status,
                    venues.submitted_at,
                    venues.approved_at,
                    venues.rejected_at,
                    venues.rejection_reason,
                    venues.created_at,
                    venues.updated_at
                FROM venues
                LEFT JOIN wards ON wards.ward_id = venues.ward_id
                LEFT JOIN place_categories ON place_categories.id = venues.category_id
                WHERE ${whereConditions.join(' AND ')}
                ORDER BY COALESCE(venues.approved_at, venues.created_at) DESC, venues.id DESC
            `,
                    values
                );

                res.json(result.rows);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        }

        async function getVenueDetails(req, res) {
            const venueId = Number(req.params.venueId);

            if (!Number.isFinite(venueId)) {
                return res.status(400).json({ message: 'Invalid venue id' });
            }

            try {
                const result = await pool.query(
                    `
                SELECT
                    venues.id,
                    venues.name,
                    venues.title,
                    venues.address,
                    venues.description,
                    venues.phone,
                    venues.latitude,
                    venues.longitude,
                    venues.ward_id,
                    wards.name AS ward_name,
                    venues.category_id,
                    place_categories.name AS category_name,
                    place_categories.slug AS category_slug,
                    venues.cover_image_url,
                    venues.business_license_image_url,
                    venues.metadata,
                    venues.submitted_by_user_id,
                    venues.status::text AS status,
                    venues.submitted_at,
                    venues.approved_at,
                    venues.rejected_at,
                    venues.rejection_reason,
                    venues.created_at,
                    venues.updated_at
                FROM venues
                LEFT JOIN wards ON wards.ward_id = venues.ward_id
                LEFT JOIN place_categories ON place_categories.id = venues.category_id
                WHERE venues.id = $1
                LIMIT 1
            `,
                    [venueId]
                );

                if (!result.rows.length) {
                    return res.status(404).json({ message: 'Venue not found' });
                }

                const venue = result.rows[0];
                const isAdmin = normalizeRole(req.authUser?.role) === 'admin';
                const requesterId = req.authUser?.id ? String(req.authUser.id).trim() : '';
                const venueOwnerId = venue.submitted_by_user_id ? String(venue.submitted_by_user_id).trim() : '';
                const isOwner = Boolean(requesterId && venueOwnerId && requesterId === venueOwnerId);

                if (!isAdmin && !isOwner && String(venue.status || '').toLowerCase() !== 'approved') {
                    return res.status(404).json({ message: 'Venue not found' });
                }

                return res.json(venue);
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }

        // API 2: Receive venue coordinates, use AI to detect Ward and save to Database
        async function createVenueSubmission(req, res) {
            const {
                name,
                title,
                address,
                categoryId,
                category_id,
                category,
                latitude,
                longitude,
                description,
                phone,
                coverImageUrl,
                businessLicenseImageUrl,
                metadata
            } = req.body;

            const normalizedName = String(name || '').trim();
            const normalizedAddress = String(address || '').trim() || 'Address not provided';
            const normalizedLatitude = Number(latitude);
            const normalizedLongitude = Number(longitude);
            const normalizedCategoryId = normalizeCategoryId(categoryId ?? category_id);
            const normalizedCategoryName = String(category || '').trim();
            const normalizedMetadata = metadata && typeof metadata === 'object' ? { ...metadata } : {};
            const requestedServiceIds = normalizeServiceIds(normalizedMetadata.selectedServices);
            const submitterUserId = req.authUser?.id ? String(req.authUser.id).trim() : '';

            if (!submitterUserId) {
                return res.status(401).json({ message: 'Missing authentication token' });
            }

            if (!normalizedMetadata.category && normalizedCategoryName) {
                normalizedMetadata.category = normalizedCategoryName;
            }

            if (!normalizedName) {
                return res.status(400).json({ message: 'Venue name is required' });
            }

            if (!Number.isFinite(normalizedLatitude) || !Number.isFinite(normalizedLongitude)) {
                return res.status(400).json({ message: 'Latitude and longitude must be valid numbers' });
            }

            if (Number.isNaN(normalizedCategoryId)) {
                return res.status(400).json({ message: 'categoryId must be a positive integer' });
            }

            try {
                let resolvedCategoryId = normalizedCategoryId;

                if (resolvedCategoryId === null && normalizedCategoryName) {
                    const inferredSlug = slugifyText(normalizedCategoryName);
                    const categoryLookup = await pool.query(
                        `
                    SELECT id
                    FROM place_categories
                    WHERE is_active = true
                      AND (LOWER(name) = LOWER($1) OR slug = $2)
                    LIMIT 1
                `,
                        [normalizedCategoryName, inferredSlug]
                    );

                    resolvedCategoryId = categoryLookup.rows[0]?.id ?? null;
                }

                if (resolvedCategoryId !== null) {
                    const categoryCheck = await pool.query(
                        `
                    SELECT id
                    FROM place_categories
                    WHERE id = $1
                      AND is_active = true
                    LIMIT 1
                `,
                        [resolvedCategoryId]
                    );

                    if (!categoryCheck.rows.length) {
                        return res.status(400).json({ message: 'Selected category is invalid or inactive' });
                    }
                }

                if (requestedServiceIds.length) {
                    const servicesResult = await pool.query(
                        `
                        SELECT id, name
                        FROM merchant_services
                        WHERE id = ANY($1::int[])
                          AND is_active = true
                    `,
                        [requestedServiceIds]
                    );

                    if (servicesResult.rows.length !== requestedServiceIds.length) {
                        return res.status(400).json({ message: 'Selected services are invalid or inactive' });
                    }

                    const serviceNameMap = new Map(
                        servicesResult.rows.map((service) => [Number(service.id), service.name])
                    );

                    normalizedMetadata.selectedServices = requestedServiceIds;
                    normalizedMetadata.selectedServiceNames = requestedServiceIds
                        .map((serviceId) => serviceNameMap.get(serviceId))
                        .filter(Boolean);
                } else {
                    normalizedMetadata.selectedServices = [];
                    normalizedMetadata.selectedServiceNames = [];
                }

                const duplicateLocationResult = await pool.query(
                    `
                    SELECT id, status::text AS status
                    FROM venues
                    WHERE COALESCE(status::text, '') IN ('pending', 'approved')
                                            AND ABS(latitude - $1) <= 0.00003
                                            AND ABS(longitude - $2) <= 0.00003
                    ORDER BY COALESCE(submitted_at, created_at) DESC, id DESC
                    LIMIT 1
                `,
                    [normalizedLatitude, normalizedLongitude]
                );

                if (duplicateLocationResult.rows.length) {
                    const existingStatus = String(duplicateLocationResult.rows[0].status || '').toLowerCase();
                    return res.status(409).json({
                        message:
                            existingStatus === 'pending'
                                ? 'A venue submission at this location is already waiting for admin review.'
                                : 'A venue at this location has already been approved. Please pick a different location.'
                    });
                }

                const detection = await detectWardByCoordinates(normalizedLatitude, normalizedLongitude);

                const insertResult = await pool.query(
                    `
                INSERT INTO venues (
                    name,
                    title,
                    address,
                    description,
                    phone,
                    latitude,
                    longitude,
                    ward_id,
                    category_id,
                    cover_image_url,
                    business_license_image_url,
                    metadata,
                    submitted_by_user_id,
                    status,
                    submitted_at,
                    updated_at
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    $10,
                    $11,
                    $12,
                    $13,
                    'pending',
                    now(),
                    now()
                )
                RETURNING id
            `,
                    [
                        normalizedName,
                        String(title || '').trim() || normalizedName,
                        normalizedAddress,
                        String(description || '').trim() || null,
                        String(phone || '').trim() || null,
                        normalizedLatitude,
                        normalizedLongitude,
                        detection.wardId,
                        resolvedCategoryId,
                        String(coverImageUrl || '').trim() || null,
                        String(businessLicenseImageUrl || '').trim() || null,
                        normalizedMetadata,
                        submitterUserId
                    ]
                );

                const venueDetails = await pool.query(
                    `
                SELECT
                    venues.id,
                    venues.name,
                    venues.title,
                    venues.address,
                    venues.description,
                    venues.phone,
                    venues.latitude,
                    venues.longitude,
                    venues.ward_id,
                    wards.name AS ward_name,
                    venues.category_id,
                    place_categories.name AS category_name,
                    place_categories.slug AS category_slug,
                    venues.cover_image_url,
                    venues.business_license_image_url,
                    venues.metadata,
                    venues.submitted_by_user_id,
                    venues.status::text AS status,
                    venues.submitted_at,
                    venues.created_at,
                    venues.updated_at
                FROM venues
                LEFT JOIN wards ON wards.ward_id = venues.ward_id
                LEFT JOIN place_categories ON place_categories.id = venues.category_id
                WHERE venues.id = $1
                LIMIT 1
            `,
                    [insertResult.rows[0].id]
                );

                res.json({
                    message: 'Venue submitted successfully and is waiting for admin approval.',
                    submissionStatus: 'pending',
                    detectedWard: detection.wardName,
                    detected_ward: detection.wardName,
                    venue: venueDetails.rows[0]
                });
            } catch (err) {
                console.error('API error:', err);
                res.status(500).json({ error: 'Server error' });
            }
        }

        async function listPublicPlaceCategories(req, res) {
            const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';

            try {
                const result = await pool.query(
                    `
                SELECT id, name, slug, description, sort_order, is_active, created_at, updated_at
                FROM place_categories
                ${includeInactive ? '' : 'WHERE is_active = true'}
                ORDER BY sort_order ASC, name ASC
            `
                );

                return res.json(result.rows);
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }

        async function listAdminPlaceCategories(req, res) {
            try {
                const result = await pool.query(
                    `
                SELECT id, name, slug, description, sort_order, is_active, created_at, updated_at
                FROM place_categories
                ORDER BY sort_order ASC, name ASC
            `
                );

                return res.json(result.rows);
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }

        async function createAdminPlaceCategory(req, res) {
            const name = String(req.body.name || '').trim();
            const description = String(req.body.description || '').trim() || null;
            const slugInput = String(req.body.slug || '').trim();
            const slug = slugifyText(slugInput || name);
            const sortOrder = Number.isFinite(Number(req.body.sortOrder)) ? Number(req.body.sortOrder) : 0;
            const isActive = req.body.isActive !== false;

            if (!name) {
                return res.status(400).json({ message: 'name is required' });
            }

            if (!slug) {
                return res.status(400).json({ message: 'slug is required' });
            }

            try {
                const result = await pool.query(
                    `
                INSERT INTO place_categories (name, slug, description, sort_order, is_active, updated_at)
                VALUES ($1, $2, $3, $4, $5, now())
                RETURNING id, name, slug, description, sort_order, is_active, created_at, updated_at
            `,
                    [name, slug, description, sortOrder, isActive]
                );

                return res.status(201).json(result.rows[0]);
            } catch (error) {
                if (error.code === '23505') {
                    return res.status(409).json({ message: 'Category slug already exists' });
                }

                return res.status(500).json({ message: error.message });
            }
        }

        async function updateAdminPlaceCategory(req, res) {
            const categoryId = normalizeCategoryId(req.params.categoryId);

            if (Number.isNaN(categoryId) || categoryId === null) {
                return res.status(400).json({ message: 'categoryId must be a positive integer' });
            }

            try {
                const existingResult = await pool.query(
                    `
                SELECT id, name, slug, description, sort_order, is_active
                FROM place_categories
                WHERE id = $1
                LIMIT 1
            `,
                    [categoryId]
                );

                if (!existingResult.rows.length) {
                    return res.status(404).json({ message: 'Category not found' });
                }

                const existing = existingResult.rows[0];
                const hasName = Object.prototype.hasOwnProperty.call(req.body, 'name');
                const hasSlug = Object.prototype.hasOwnProperty.call(req.body, 'slug');
                const hasDescription = Object.prototype.hasOwnProperty.call(req.body, 'description');
                const hasSortOrder = Object.prototype.hasOwnProperty.call(req.body, 'sortOrder');
                const hasIsActive = Object.prototype.hasOwnProperty.call(req.body, 'isActive');

                const nextName = hasName ? String(req.body.name || '').trim() : existing.name;
                const nextDescription = hasDescription
                    ? String(req.body.description || '').trim() || null
                    : existing.description;
                const nextSlug = hasSlug
                    ? slugifyText(String(req.body.slug || '').trim())
                    : hasName
                        ? slugifyText(nextName)
                        : existing.slug;
                const nextSortOrder = hasSortOrder
                    ? Number.isFinite(Number(req.body.sortOrder))
                        ? Number(req.body.sortOrder)
                        : existing.sort_order
                    : existing.sort_order;
                const nextIsActive = hasIsActive ? req.body.isActive !== false : existing.is_active;

                if (!nextName) {
                    return res.status(400).json({ message: 'name is required' });
                }

                if (!nextSlug) {
                    return res.status(400).json({ message: 'slug is required' });
                }

                const updateResult = await pool.query(
                    `
                UPDATE place_categories
                SET
                    name = $2,
                    slug = $3,
                    description = $4,
                    sort_order = $5,
                    is_active = $6,
                    updated_at = now()
                WHERE id = $1
                RETURNING id, name, slug, description, sort_order, is_active, created_at, updated_at
            `,
                    [categoryId, nextName, nextSlug, nextDescription, nextSortOrder, nextIsActive]
                );

                return res.json(updateResult.rows[0]);
            } catch (error) {
                if (error.code === '23505') {
                    return res.status(409).json({ message: 'Category slug already exists' });
                }

                return res.status(500).json({ message: error.message });
            }
        }

        async function deleteAdminPlaceCategory(req, res) {
            const categoryId = normalizeCategoryId(req.params.categoryId);

            if (Number.isNaN(categoryId) || categoryId === null) {
                return res.status(400).json({ message: 'categoryId must be a positive integer' });
            }

            try {
                const usageResult = await pool.query(
                    `
                SELECT COUNT(*)::int AS usage_count
                FROM venues
                WHERE category_id = $1
                  AND COALESCE(venues.status::text, '') <> 'rejected'
            `,
                    [categoryId]
                );

                if ((usageResult.rows[0]?.usage_count || 0) > 0) {
                    return res.status(409).json({
                        message: 'Category is used by existing venues. Reassign or deactivate it before deletion.'
                    });
                }

                const deleteResult = await pool.query(
                    `
                DELETE FROM place_categories
                WHERE id = $1
                RETURNING id
            `,
                    [categoryId]
                );

                if (!deleteResult.rows.length) {
                    return res.status(404).json({ message: 'Category not found' });
                }

                return res.json({ message: 'Category deleted successfully' });
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }

        async function listPublicMerchantServices(req, res) {
            const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';

            try {
                const result = await pool.query(
                    `
                        SELECT id, name, slug, icon, description, sort_order, is_active, created_at, updated_at
                        FROM merchant_services
                        ${includeInactive ? '' : 'WHERE is_active = true'}
                        ORDER BY sort_order ASC, name ASC
                    `
                );

                return res.json(result.rows);
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }

        async function listAdminMerchantServices(req, res) {
            try {
                const result = await pool.query(
                    `
                        SELECT id, name, slug, icon, description, sort_order, is_active, created_at, updated_at
                        FROM merchant_services
                        ORDER BY sort_order ASC, name ASC
                    `
                );

                return res.json(result.rows);
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }

        async function createAdminMerchantService(req, res) {
            const name = String(req.body.name || '').trim();
            const icon = normalizeNullableText(req.body.icon);
            const description = normalizeNullableText(req.body.description);
            const slugInput = String(req.body.slug || '').trim();
            const slug = slugifyText(slugInput || name);
            const sortOrder = Number.isFinite(Number(req.body.sortOrder)) ? Number(req.body.sortOrder) : 0;
            const isActive = req.body.isActive !== false;

            if (!name) {
                return res.status(400).json({ message: 'name is required' });
            }

            if (!slug) {
                return res.status(400).json({ message: 'slug is required' });
            }

            try {
                const result = await pool.query(
                    `
                        INSERT INTO merchant_services (name, slug, icon, description, sort_order, is_active, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, now())
                        RETURNING id, name, slug, icon, description, sort_order, is_active, created_at, updated_at
                    `,
                    [name, slug, icon, description, sortOrder, isActive]
                );

                return res.status(201).json(result.rows[0]);
            } catch (error) {
                if (error.code === '23505') {
                    return res.status(409).json({ message: 'Service slug already exists' });
                }

                return res.status(500).json({ message: error.message });
            }
        }

        async function updateAdminMerchantService(req, res) {
            const serviceId = normalizeNullableNumber(req.params.serviceId);

            if (Number.isNaN(serviceId) || serviceId === null) {
                return res.status(400).json({ message: 'serviceId must be a positive integer' });
            }

            try {
                const existingResult = await pool.query(
                    `
                        SELECT id, name, slug, icon, description, sort_order, is_active
                        FROM merchant_services
                        WHERE id = $1
                        LIMIT 1
                    `,
                    [serviceId]
                );

                if (!existingResult.rows.length) {
                    return res.status(404).json({ message: 'Service not found' });
                }

                const existing = existingResult.rows[0];
                const hasName = Object.prototype.hasOwnProperty.call(req.body, 'name');
                const hasSlug = Object.prototype.hasOwnProperty.call(req.body, 'slug');
                const hasIcon = Object.prototype.hasOwnProperty.call(req.body, 'icon');
                const hasDescription = Object.prototype.hasOwnProperty.call(req.body, 'description');
                const hasSortOrder = Object.prototype.hasOwnProperty.call(req.body, 'sortOrder');
                const hasIsActive = Object.prototype.hasOwnProperty.call(req.body, 'isActive');

                const nextName = hasName ? String(req.body.name || '').trim() : existing.name;
                const nextSlug = hasSlug
                    ? slugifyText(String(req.body.slug || '').trim())
                    : hasName
                        ? slugifyText(nextName)
                        : existing.slug;
                const nextIcon = hasIcon ? normalizeNullableText(req.body.icon) : existing.icon;
                const nextDescription = hasDescription ? normalizeNullableText(req.body.description) : existing.description;
                const nextSortOrder = hasSortOrder
                    ? Number.isFinite(Number(req.body.sortOrder))
                        ? Number(req.body.sortOrder)
                        : existing.sort_order
                    : existing.sort_order;
                const nextIsActive = hasIsActive ? req.body.isActive !== false : existing.is_active;

                if (!nextName) {
                    return res.status(400).json({ message: 'name is required' });
                }

                if (!nextSlug) {
                    return res.status(400).json({ message: 'slug is required' });
                }

                const updateResult = await pool.query(
                    `
                        UPDATE merchant_services
                        SET
                            name = $2,
                            slug = $3,
                            icon = $4,
                            description = $5,
                            sort_order = $6,
                            is_active = $7,
                            updated_at = now()
                        WHERE id = $1
                        RETURNING id, name, slug, icon, description, sort_order, is_active, created_at, updated_at
                    `,
                    [serviceId, nextName, nextSlug, nextIcon, nextDescription, nextSortOrder, nextIsActive]
                );

                return res.json(updateResult.rows[0]);
            } catch (error) {
                if (error.code === '23505') {
                    return res.status(409).json({ message: 'Service slug already exists' });
                }

                return res.status(500).json({ message: error.message });
            }
        }

        async function deleteAdminMerchantService(req, res) {
            const serviceId = normalizeNullableNumber(req.params.serviceId);

            if (Number.isNaN(serviceId) || serviceId === null) {
                return res.status(400).json({ message: 'serviceId must be a positive integer' });
            }

            try {
                const usageResult = await pool.query(
                    `
                        SELECT COUNT(*)::int AS usage_count
                        FROM venues
                        WHERE metadata ? 'selectedServices'
                          AND COALESCE(venues.status::text, '') <> 'rejected'
                          AND EXISTS (
                              SELECT 1
                              FROM jsonb_array_elements_text(metadata->'selectedServices') AS selected(value)
                              WHERE selected.value ~ '^[0-9]+$'
                                AND selected.value::int = $1
                          )
                    `,
                    [serviceId]
                );

                if ((usageResult.rows[0]?.usage_count || 0) > 0) {
                    return res.status(409).json({
                        message: 'Service is used by existing venues. Remove it from venues before deletion.'
                    });
                }

                const deleteResult = await pool.query(
                    `
                        DELETE FROM merchant_services
                        WHERE id = $1
                        RETURNING id
                    `,
                    [serviceId]
                );

                if (!deleteResult.rows.length) {
                    return res.status(404).json({ message: 'Service not found' });
                }

                return res.json({ message: 'Service deleted successfully' });
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }

        async function listAdminWards(req, res) {
            try {
                const result = await pool.query(
                    `
                SELECT ward_id, name, boundary, description, is_active, created_at, updated_at
                FROM wards
                ORDER BY name ASC
            `
                );

                res.json(result.rows);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }

        async function upsertAdminWard(req, res) {
            const rawWardId = String(req.body.wardId || req.body.ward_id || '').trim();
            const name = String(req.body.name || '').trim();
            const description = String(req.body.description || '').trim() || null;
            const boundary = req.body.boundary;
            const isActive = req.body.isActive !== false;

            if (!name) {
                return res.status(400).json({ message: 'name is required' });
            }

            if (!validateBoundaryGeoJson(boundary)) {
                return res.status(400).json({ message: 'boundary must be a valid GeoJSON FeatureCollection with polygon features' });
            }

            try {
                const wardId = rawWardId || (await generateWardIdFromName(name));

                const existingWardsResult = await pool.query(
                    `
                SELECT ward_id, name, boundary
                FROM wards
                WHERE ward_id <> $1
            `,
                    [wardId]
                );

                const duplicatedBoundaryWard = existingWardsResult.rows.find((ward) =>
                    haveSameBoundaryGeometry(ward.boundary, boundary)
                );

                if (duplicatedBoundaryWard) {
                    return res.status(409).json({
                        message: `boundary GeoJSON already exists in ward "${duplicatedBoundaryWard.name}"`
                    });
                }

                const result = await pool.query(
                    `
                INSERT INTO wards (ward_id, name, boundary, description, is_active, updated_at)
                VALUES ($1, $2, $3::jsonb, $4, $5, now())
                ON CONFLICT (ward_id)
                DO UPDATE SET
                    name = EXCLUDED.name,
                    boundary = EXCLUDED.boundary,
                    description = EXCLUDED.description,
                    is_active = EXCLUDED.is_active,
                    updated_at = now()
                RETURNING ward_id, name, boundary, description, is_active, created_at, updated_at
            `,
                    [wardId, name, boundary, description, isActive]
                );

                return res.status(201).json(result.rows[0]);
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }

        async function deleteAdminWard(req, res) {
            const wardId = String(req.params.wardId || '').trim();

            if (!wardId) {
                return res.status(400).json({ message: 'wardId is required' });
            }

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                await client.query(
                    `
                UPDATE venues
                SET
                    ward_id = NULL,
                    updated_at = now()
                WHERE ward_id = $1
            `,
                    [wardId]
                );

                const deleteResult = await client.query(
                    `
                DELETE FROM wards
                WHERE ward_id = $1
                RETURNING ward_id, name
            `,
                    [wardId]
                );

                if (!deleteResult.rows.length) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ message: 'Ward not found' });
                }

                await client.query('COMMIT');

                return res.json({
                    message: 'Ward deleted successfully',
                    ward: deleteResult.rows[0]
                });
            } catch (error) {
                await client.query('ROLLBACK');
                return res.status(500).json({ message: error.message });
            } finally {
                client.release();
            }
        }

        async function listAdminVenues(req, res) {
            const statusFilter = normalizeStatusList(req.query.status);
            const wardId = String(req.query.wardId || '').trim();
            const categoryId = normalizeCategoryId(req.query.categoryId);

            if (Number.isNaN(categoryId)) {
                return res.status(400).json({ message: 'categoryId must be a positive integer' });
            }

            const values = [];
            const whereConditions = [];

            if (statusFilter.length) {
                values.push(statusFilter);
                whereConditions.push(`venues.status::text = ANY($${values.length}::text[])`);
            }

            if (wardId) {
                values.push(wardId);
                whereConditions.push(`venues.ward_id = $${values.length}`);
            }

            if (categoryId !== null) {
                values.push(categoryId);
                whereConditions.push(`venues.category_id = $${values.length}`);
            }

            const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';

            try {
                const result = await pool.query(
                    `
                SELECT
                    venues.id,
                    venues.name,
                    venues.title,
                    venues.address,
                    venues.description,
                    venues.phone,
                    venues.latitude,
                    venues.longitude,
                    venues.ward_id,
                    wards.name AS ward_name,
                    venues.category_id,
                    place_categories.name AS category_name,
                    place_categories.slug AS category_slug,
                    venues.cover_image_url,
                    venues.business_license_image_url,
                    venues.metadata,
                    venues.status::text AS status,
                    venues.submitted_at,
                    venues.approved_at,
                    venues.rejected_at,
                    venues.rejection_reason,
                    venues.created_at,
                    venues.updated_at
                FROM venues
                LEFT JOIN wards ON wards.ward_id = venues.ward_id
                LEFT JOIN place_categories ON place_categories.id = venues.category_id
                ${whereClause}
                ORDER BY COALESCE(venues.submitted_at, venues.created_at) DESC, venues.id DESC
            `,
                    values
                );

                res.json(result.rows);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }

        async function moderateVenueSubmission(req, res) {
            const venueId = Number(req.params.venueId);
            const action = String(req.body.action || '').trim().toLowerCase();

            if (!Number.isFinite(venueId)) {
                return res.status(400).json({ message: 'Invalid venue id' });
            }

            if (!['approve', 'reject'].includes(action)) {
                return res.status(400).json({ message: 'action must be approve or reject' });
            }

            const reviewer = req.authUser?.email || req.authUser?.id || 'admin';

            try {
                if (action === 'reject') {
                    const normalizedRejectionReason = normalizeNullableText(req.body.rejectionReason);
                    const result = await pool.query(
                        `
                          UPDATE venues
                          SET
                              status = 'rejected',
                              rejected_at = now(),
                              approved_at = NULL,
                              rejection_reason = $3,
                              reviewed_by = $2,
                              updated_at = now()
                          WHERE id = $1
                          RETURNING id
                      `,
                        [venueId, reviewer, normalizedRejectionReason]
                    );

                    if (!result.rows.length) {
                        return res.status(404).json({ message: 'Venue submission not found' });
                    }

                    const details = await pool.query(
                        `
                SELECT
                    venues.id,
                    venues.name,
                    venues.title,
                    venues.address,
                    venues.description,
                    venues.phone,
                    venues.latitude,
                    venues.longitude,
                    venues.ward_id,
                    wards.name AS ward_name,
                    venues.category_id,
                    place_categories.name AS category_name,
                    place_categories.slug AS category_slug,
                    venues.cover_image_url,
                    venues.business_license_image_url,
                    venues.metadata,
                    venues.status::text AS status,
                    venues.submitted_at,
                    venues.approved_at,
                    venues.rejected_at,
                    venues.rejection_reason,
                    venues.created_at,
                    venues.updated_at
                FROM venues
                LEFT JOIN wards ON wards.ward_id = venues.ward_id
                LEFT JOIN place_categories ON place_categories.id = venues.category_id
                WHERE venues.id = $1
                LIMIT 1
            `,
                        [venueId]
                    );

                    return res.json({
                        message: 'Venue rejected successfully',
                        venue: details.rows[0]
                    });
                }

                const result = await pool.query(
                    `
                          UPDATE venues
                          SET
                              status = 'approved',
                              approved_at = now(),
                              rejected_at = NULL,
                              rejection_reason = NULL,
                              reviewed_by = $2,
                              updated_at = now()
                          WHERE id = $1
                          RETURNING id
                      `,
                    [venueId, reviewer]
                );

                if (!result.rows.length) {
                    return res.status(404).json({ message: 'Venue submission not found' });
                }

                const details = await pool.query(
                    `
                SELECT
                    venues.id,
                    venues.name,
                    venues.title,
                    venues.address,
                    venues.description,
                    venues.phone,
                    venues.latitude,
                    venues.longitude,
                    venues.ward_id,
                    wards.name AS ward_name,
                    venues.category_id,
                    place_categories.name AS category_name,
                    place_categories.slug AS category_slug,
                    venues.cover_image_url,
                    venues.business_license_image_url,
                    venues.metadata,
                    venues.status::text AS status,
                    venues.submitted_at,
                    venues.approved_at,
                    venues.rejected_at,
                    venues.rejection_reason,
                    venues.created_at,
                    venues.updated_at
                FROM venues
                LEFT JOIN wards ON wards.ward_id = venues.ward_id
                LEFT JOIN place_categories ON place_categories.id = venues.category_id
                WHERE venues.id = $1
                LIMIT 1
            `,
                    [venueId]
                );

                return res.json({
                    message: 'Venue approved successfully',
                    venue: details.rows[0]
                });
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }

        function mapDefaultFeedbackTypesForResponse() {
            return DEFAULT_FEEDBACK_TYPES.map((type) => ({
                id: null,
                code: type.code,
                name: type.name,
                description: type.description,
                sortOrder: type.sortOrder,
                isActive: true
            }));
        }

        function isFeedbackSchemaMissingError(error) {
            return ['42P01', '42703', '42704'].includes(error?.code);
        }

        async function listPublicFeedbackTypes(_req, res) {
            try {
                const result = await pool.query(
                    `
                        SELECT id, code, name, description, sort_order, is_active
                        FROM feedback_types
                        WHERE is_active = true
                        ORDER BY sort_order ASC, name ASC
                    `
                );

                if (!result.rows.length) {
                    return res.json(mapDefaultFeedbackTypesForResponse());
                }

                return res.json(
                    result.rows.map((row) => ({
                        id: row.id,
                        code: row.code,
                        name: row.name,
                        description: row.description,
                        sortOrder: row.sort_order,
                        isActive: row.is_active
                    }))
                );
            } catch (error) {
                if (error.code === '42P01') {
                    return res.json(mapDefaultFeedbackTypesForResponse());
                }

                return res.status(500).json({ message: error.message });
            }
        }

        async function listAdminFeedbackTypes(_req, res) {
            try {
                const result = await pool.query(
                    `
                        SELECT id, code, name, description, sort_order, is_active, created_at, updated_at
                        FROM feedback_types
                        ORDER BY sort_order ASC, name ASC
                    `
                );

                return res.json(
                    result.rows.map((row) => ({
                        id: row.id,
                        code: row.code,
                        name: row.name,
                        description: row.description,
                        sortOrder: row.sort_order,
                        isActive: row.is_active,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at
                    }))
                );
            } catch (error) {
                if (isFeedbackSchemaMissingError(error)) {
                    return res.status(500).json({
                        message: 'Feedback management schema is missing. Please run backend migrations.'
                    });
                }

                return res.status(500).json({ message: error.message });
            }
        }

        async function createAdminFeedbackType(req, res) {
            const name = String(req.body.name || '').trim();
            const codeInput = String(req.body.code || '').trim();
            const description = normalizeNullableText(req.body.description);
            const sortOrder = Number.isFinite(Number(req.body.sortOrder)) ? Number(req.body.sortOrder) : 0;
            const isActive = req.body.isActive !== false;
            const code = String(slugifyText(codeInput || name)).replace(/-/g, '_');

            if (!name) {
                return res.status(400).json({ message: 'name is required' });
            }

            if (!code) {
                return res.status(400).json({ message: 'code is required' });
            }

            try {
                const result = await pool.query(
                    `
                        INSERT INTO feedback_types (code, name, description, sort_order, is_active, updated_at)
                        VALUES ($1, $2, $3, $4, $5, now())
                        RETURNING id, code, name, description, sort_order, is_active, created_at, updated_at
                    `,
                    [code, name, description, sortOrder, isActive]
                );

                const row = result.rows[0];
                return res.status(201).json({
                    id: row.id,
                    code: row.code,
                    name: row.name,
                    description: row.description,
                    sortOrder: row.sort_order,
                    isActive: row.is_active,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                });
            } catch (error) {
                if (error.code === '23505') {
                    return res.status(409).json({ message: 'Feedback type code already exists' });
                }

                if (isFeedbackSchemaMissingError(error)) {
                    return res.status(500).json({
                        message: 'Feedback management schema is missing. Please run backend migrations.'
                    });
                }

                return res.status(500).json({ message: error.message });
            }
        }

        async function updateAdminFeedbackType(req, res) {
            const typeId = normalizeNullableNumber(req.params.typeId);

            if (Number.isNaN(typeId) || typeId === null) {
                return res.status(400).json({ message: 'typeId must be a positive integer' });
            }

            try {
                const existingResult = await pool.query(
                    `
                        SELECT id, code, name, description, sort_order, is_active
                        FROM feedback_types
                        WHERE id = $1
                        LIMIT 1
                    `,
                    [typeId]
                );

                if (!existingResult.rows.length) {
                    return res.status(404).json({ message: 'Feedback type not found' });
                }

                const existing = existingResult.rows[0];
                const hasName = Object.prototype.hasOwnProperty.call(req.body, 'name');
                const hasCode = Object.prototype.hasOwnProperty.call(req.body, 'code');
                const hasDescription = Object.prototype.hasOwnProperty.call(req.body, 'description');
                const hasSortOrder = Object.prototype.hasOwnProperty.call(req.body, 'sortOrder');
                const hasIsActive = Object.prototype.hasOwnProperty.call(req.body, 'isActive');

                const nextName = hasName ? String(req.body.name || '').trim() : existing.name;
                const nextCode = hasCode
                    ? String(slugifyText(String(req.body.code || '').trim())).replace(/-/g, '_')
                    : hasName
                        ? String(slugifyText(nextName)).replace(/-/g, '_')
                        : existing.code;
                const nextDescription = hasDescription
                    ? normalizeNullableText(req.body.description)
                    : existing.description;
                const nextSortOrder = hasSortOrder
                    ? Number.isFinite(Number(req.body.sortOrder))
                        ? Number(req.body.sortOrder)
                        : existing.sort_order
                    : existing.sort_order;
                const nextIsActive = hasIsActive ? req.body.isActive !== false : existing.is_active;

                if (!nextName) {
                    return res.status(400).json({ message: 'name is required' });
                }

                if (!nextCode) {
                    return res.status(400).json({ message: 'code is required' });
                }

                const updateResult = await pool.query(
                    `
                        UPDATE feedback_types
                        SET
                            code = $2,
                            name = $3,
                            description = $4,
                            sort_order = $5,
                            is_active = $6,
                            updated_at = now()
                        WHERE id = $1
                        RETURNING id, code, name, description, sort_order, is_active, created_at, updated_at
                    `,
                    [typeId, nextCode, nextName, nextDescription, nextSortOrder, nextIsActive]
                );

                const row = updateResult.rows[0];
                return res.json({
                    id: row.id,
                    code: row.code,
                    name: row.name,
                    description: row.description,
                    sortOrder: row.sort_order,
                    isActive: row.is_active,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                });
            } catch (error) {
                if (error.code === '23505') {
                    return res.status(409).json({ message: 'Feedback type code already exists' });
                }

                if (isFeedbackSchemaMissingError(error)) {
                    return res.status(500).json({
                        message: 'Feedback management schema is missing. Please run backend migrations.'
                    });
                }

                return res.status(500).json({ message: error.message });
            }
        }

        async function deleteAdminFeedbackType(req, res) {
            const typeId = normalizeNullableNumber(req.params.typeId);

            if (Number.isNaN(typeId) || typeId === null) {
                return res.status(400).json({ message: 'typeId must be a positive integer' });
            }

            try {
                const deleteResult = await pool.query(
                    `
                        DELETE FROM feedback_types
                        WHERE id = $1
                        RETURNING id
                    `,
                    [typeId]
                );

                if (!deleteResult.rows.length) {
                    return res.status(404).json({ message: 'Feedback type not found' });
                }

                return res.json({ message: 'Feedback type deleted successfully' });
            } catch (error) {
                if (isFeedbackSchemaMissingError(error)) {
                    return res.status(500).json({
                        message: 'Feedback management schema is missing. Please run backend migrations.'
                    });
                }

                return res.status(500).json({ message: error.message });
            }
        }

        function submitFeedbackReport(req, res) {
            uploadFeedback.single('attachment')(req, res, async (uploadErr) => {
                if (uploadErr) {
                    return res.status(400).json({ message: uploadErr.message || 'Upload failed' });
                }

                const rawFeedbackTypeId =
                    req.body.feedbackTypeId ?? req.body.feedback_type_id ?? req.body.typeId;
                const feedbackTypeId = normalizeNullableNumber(rawFeedbackTypeId);

                if (Number.isNaN(feedbackTypeId)) {
                    return res.status(400).json({ message: 'feedbackTypeId must be a positive integer' });
                }

                const message = String(req.body.message || '').trim();
                const legacyCategoryRaw = String(
                    req.body.category || req.body.issueType || req.body.issue_type || ''
                )
                    .trim()
                    .toLowerCase();

                if (!message) {
                    return res.status(400).json({ message: 'Message is required' });
                }

                const normalizedPhone = String(req.body.contactPhone || req.body.contact_phone || '')
                    .replace(/\D/g, '')
                    .slice(0, 15);

                const payloadEmail = String(req.body.contactEmail || req.body.contact_email || '').trim();
                const fallbackAuthEmail = String(req.authUser?.email || '').trim();
                const contactEmail = payloadEmail || fallbackAuthEmail;

                if (contactEmail && !isValidEmail(contactEmail)) {
                    return res.status(400).json({ message: 'contactEmail is invalid' });
                }

                const normalizedLegacyCategory = FEEDBACK_CATEGORY_CODES.has(legacyCategoryRaw)
                    ? legacyCategoryRaw
                    : 'other';
                const attachmentUrl = req.file ? `/uploads/feedback/${req.file.filename}` : null;

                let resolvedTypeId = null;
                let resolvedTypeCode = normalizedLegacyCategory;
                let resolvedTypeName =
                    DEFAULT_FEEDBACK_TYPES.find((type) => type.code === normalizedLegacyCategory)?.name || 'Other';

                try {
                    if (feedbackTypeId !== null) {
                        const selectedTypeResult = await pool.query(
                            `
                                SELECT id, code, name
                                FROM feedback_types
                                WHERE id = $1
                                  AND is_active = true
                                LIMIT 1
                            `,
                            [feedbackTypeId]
                        );

                        if (!selectedTypeResult.rows.length) {
                            return res.status(400).json({ message: 'Selected feedback type is invalid or inactive' });
                        }

                        resolvedTypeId = selectedTypeResult.rows[0].id;
                        resolvedTypeCode = selectedTypeResult.rows[0].code;
                        resolvedTypeName = selectedTypeResult.rows[0].name;
                    } else {
                        const selectedTypeResult = await pool.query(
                            `
                                SELECT id, code, name
                                FROM feedback_types
                                WHERE code = $1
                                  AND is_active = true
                                LIMIT 1
                            `,
                            [normalizedLegacyCategory]
                        );

                        if (selectedTypeResult.rows.length) {
                            resolvedTypeId = selectedTypeResult.rows[0].id;
                            resolvedTypeCode = selectedTypeResult.rows[0].code;
                            resolvedTypeName = selectedTypeResult.rows[0].name;
                        }
                    }
                } catch (typeLookupError) {
                    if (typeLookupError.code !== '42P01') {
                        return res.status(500).json({ message: typeLookupError.message });
                    }
                }

                try {
                    const insertQuery = `
                        INSERT INTO feedbacks (
                            feedback_type_id,
                            reporter_user_id,
                            category,
                            issue_type,
                            message,
                            contact_email,
                            contact_phone,
                            attachment_url,
                            status,
                            updated_at
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'new', now())
                        RETURNING *
                    `;

                    const { rows } = await pool.query(insertQuery, [
                        resolvedTypeId,
                        req.authUser?.id || null,
                        resolvedTypeCode,
                        resolvedTypeCode,
                        message,
                        contactEmail || null,
                        normalizedPhone || null,
                        attachmentUrl
                    ]);

                    return res.status(201).json({
                        message: 'Feedback submitted',
                        feedback: rows[0],
                        feedbackType: {
                            id: resolvedTypeId,
                            code: resolvedTypeCode,
                            name: resolvedTypeName
                        }
                    });
                } catch (insertError) {
                    if (!isFeedbackSchemaMissingError(insertError)) {
                        return res.status(500).json({ message: insertError.message });
                    }

                    try {
                        const fallbackInsertQuery = `
                            INSERT INTO feedbacks (category, issue_type, message, contact_email, contact_phone, attachment_url)
                            VALUES ($1, $2, $3, $4, $5, $6)
                            RETURNING *
                        `;

                        const fallbackResult = await pool.query(fallbackInsertQuery, [
                            resolvedTypeCode,
                            resolvedTypeCode,
                            message,
                            contactEmail || null,
                            normalizedPhone || null,
                            attachmentUrl
                        ]);

                        return res.status(201).json({
                            message: 'Feedback submitted',
                            feedback: fallbackResult.rows[0],
                            feedbackType: {
                                id: null,
                                code: resolvedTypeCode,
                                name: resolvedTypeName
                            }
                        });
                    } catch (fallbackError) {
                        console.error('Feedback submission error:', fallbackError);
                        return res.status(500).json({ message: 'Unable to submit feedback' });
                    }
                }
            });
        }

        async function listAdminFeedbackReports(req, res) {
            const statuses = normalizeFeedbackStatusList(req.query.status);
            const page = normalizePaginationValue(req.query.page, 1, { min: 1, max: 100000 });
            const pageSize = normalizePaginationValue(req.query.pageSize, 20, { min: 1, max: 100 });
            const search = String(req.query.search || '').trim();

            const values = [];
            const whereConditions = [];

            if (statuses.length) {
                values.push(statuses);
                whereConditions.push(`f.status = ANY($${values.length}::text[])`);
            }

            if (search) {
                values.push(`%${search}%`);
                whereConditions.push(
                    `(f.message ILIKE $${values.length} OR COALESCE(f.contact_email, '') ILIKE $${values.length} OR COALESCE(ft.name, '') ILIKE $${values.length})`
                );
            }

            const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';

            try {
                const countResult = await pool.query(
                    `
                        SELECT COUNT(*)::int AS total
                        FROM feedbacks AS f
                        LEFT JOIN feedback_types AS ft ON ft.id = f.feedback_type_id
                        ${whereClause}
                    `,
                    values
                );

                const total = countResult.rows[0]?.total || 0;

                const listValues = [...values, pageSize, (page - 1) * pageSize];

                const listResult = await pool.query(
                    `
                        SELECT
                            f.id,
                            f.feedback_type_id,
                            COALESCE(ft.code, f.category, f.issue_type, 'other') AS feedback_type_code,
                            COALESCE(ft.name, f.issue_type, f.category, 'Other') AS feedback_type_name,
                            f.message,
                            f.contact_email,
                            f.contact_phone,
                            f.attachment_url,
                            f.status,
                            f.admin_replied_at,
                            f.admin_replied_by,
                            f.created_at,
                            f.updated_at
                        FROM feedbacks AS f
                        LEFT JOIN feedback_types AS ft ON ft.id = f.feedback_type_id
                        ${whereClause}
                        ORDER BY f.created_at DESC, f.id DESC
                        LIMIT $${values.length + 1}
                        OFFSET $${values.length + 2}
                    `,
                    listValues
                );

                return res.json({
                    items: listResult.rows,
                    pagination: {
                        page,
                        pageSize,
                        total,
                        totalPages: Math.max(1, Math.ceil(total / pageSize))
                    }
                });
            } catch (error) {
                if (isFeedbackSchemaMissingError(error)) {
                    return res.status(500).json({
                        message: 'Feedback management schema is missing. Please run backend migrations.'
                    });
                }

                return res.status(500).json({ message: error.message });
            }
        }

        async function getAdminFeedbackReportDetail(req, res) {
            const feedbackId = normalizeNullableNumber(req.params.feedbackId);

            if (Number.isNaN(feedbackId) || feedbackId === null) {
                return res.status(400).json({ message: 'feedbackId must be a positive integer' });
            }

            try {
                const result = await pool.query(
                    `
                        SELECT
                            f.id,
                            f.feedback_type_id,
                            COALESCE(ft.code, f.category, f.issue_type, 'other') AS feedback_type_code,
                            COALESCE(ft.name, f.issue_type, f.category, 'Other') AS feedback_type_name,
                            f.category,
                            f.issue_type,
                            f.message,
                            f.contact_email,
                            f.contact_phone,
                            f.attachment_url,
                            f.status,
                            f.admin_reply_message,
                            f.admin_reply_attachment_url,
                            f.admin_replied_at,
                            f.admin_replied_by,
                            f.reporter_user_id,
                            f.created_at,
                            f.updated_at
                        FROM feedbacks AS f
                        LEFT JOIN feedback_types AS ft ON ft.id = f.feedback_type_id
                        WHERE f.id = $1
                        LIMIT 1
                    `,
                    [feedbackId]
                );

                if (!result.rows.length) {
                    return res.status(404).json({ message: 'Feedback report not found' });
                }

                return res.json(result.rows[0]);
            } catch (error) {
                if (isFeedbackSchemaMissingError(error)) {
                    return res.status(500).json({
                        message: 'Feedback management schema is missing. Please run backend migrations.'
                    });
                }

                return res.status(500).json({ message: error.message });
            }
        }

        function replyAdminFeedbackReport(req, res) {
            uploadFeedbackReply.single('attachment')(req, res, async (uploadErr) => {
                if (uploadErr) {
                    return res.status(400).json({ message: uploadErr.message || 'Upload failed' });
                }

                const feedbackId = normalizeNullableNumber(req.params.feedbackId);

                if (Number.isNaN(feedbackId) || feedbackId === null) {
                    return res.status(400).json({ message: 'feedbackId must be a positive integer' });
                }

                const replyMessage = String(req.body.replyMessage || req.body.message || '').trim();

                if (!replyMessage) {
                    if (req.file) {
                        safeDeleteUploadedFile(`/uploads/feedback/admin-replies/${req.file.filename}`);
                    }

                    return res.status(400).json({ message: 'replyMessage is required' });
                }

                const requestedStatus = String(req.body.status || 'replied').trim().toLowerCase();
                const allowedNextStatuses = new Set(['in_progress', 'replied', 'closed']);
                const nextStatus = allowedNextStatuses.has(requestedStatus) ? requestedStatus : 'replied';

                if (!feedbackReplyTransporter || !feedbackReplySmtpUser) {
                    if (req.file) {
                        safeDeleteUploadedFile(`/uploads/feedback/admin-replies/${req.file.filename}`);
                    }

                    return res.status(500).json({
                        message:
                            'Gmail configuration is missing. Set FEEDBACK_GMAIL_USER and FEEDBACK_GMAIL_APP_PASSWORD in backend environment.'
                    });
                }

                try {
                    const feedbackResult = await pool.query(
                        `
                            SELECT
                                f.id,
                                f.message,
                                f.created_at,
                                f.contact_email,
                                f.reporter_user_id,
                                reporter.email AS reporter_email,
                                f.admin_reply_attachment_url,
                                COALESCE(ft.name, f.issue_type, f.category, 'Other') AS feedback_type_name
                            FROM feedbacks AS f
                            LEFT JOIN feedback_types AS ft ON ft.id = f.feedback_type_id
                            LEFT JOIN users AS reporter ON reporter.id::text = f.reporter_user_id
                            WHERE f.id = $1
                            LIMIT 1
                        `,
                        [feedbackId]
                    );

                    if (!feedbackResult.rows.length) {
                        if (req.file) {
                            safeDeleteUploadedFile(`/uploads/feedback/admin-replies/${req.file.filename}`);
                        }

                        return res.status(404).json({ message: 'Feedback report not found' });
                    }

                    const feedback = feedbackResult.rows[0];
                    const primaryContactEmail = normalizeNullableText(feedback.contact_email);
                    const reporterEmail = normalizeNullableText(feedback.reporter_email);
                    const recipientEmail = [primaryContactEmail, reporterEmail].find((candidate) =>
                        isValidEmail(candidate)
                    );

                    if (!recipientEmail) {
                        if (req.file) {
                            safeDeleteUploadedFile(`/uploads/feedback/admin-replies/${req.file.filename}`);
                        }

                        return res.status(400).json({
                            message:
                                'This report does not contain a valid recipient email. Please ensure the feedback account uses a real email address.'
                        });
                    }

                    const replyAttachmentUrl = req.file
                        ? `/uploads/feedback/admin-replies/${req.file.filename}`
                        : feedback.admin_reply_attachment_url;

                    const mailFrom = `${feedbackReplyFromName} <${feedbackReplyFromEmail || feedbackReplySmtpUser}>`;
                    const reviewer = req.authUser?.email || req.authUser?.id || 'Support Team';
                    const reviewerLabelForEmail =
                        feedbackReplyFromEmail || feedbackReplySmtpUser || 'smartcity.discovery2026@gmail.com';
                    const reportTypeLabel = escapeHtml(feedback.feedback_type_name || 'Other');
                    const reportCreatedAtLabel = escapeHtml(formatFeedbackTimestamp(feedback.created_at));
                    const nextStatusLabel = escapeHtml(normalizeFeedbackStatusLabel(nextStatus));
                    const reportMessageText = String(feedback.message || '').trim() || 'No report details provided.';
                    const attachmentNoticeText = req.file
                        ? 'An image attachment from our support team is included in this email.'
                        : '';

                    const plainTextBody = [
                        'Smart City Discovery - Feedback Update',
                        '',
                        `Feedback ID: #${feedback.id}`,
                        `Feedback Type: ${feedback.feedback_type_name || 'Other'}`,
                        `Submitted At: ${formatFeedbackTimestamp(feedback.created_at)}`,
                        '',
                        'Original Report:',
                        reportMessageText,
                        '',
                        'Support Team Response:',
                        replyMessage,
                        '',
                        `Current Status: ${normalizeFeedbackStatusLabel(nextStatus)}`,
                        `Handled By: ${reviewerLabelForEmail}`,
                        attachmentNoticeText,
                        '',
                        'If you need further help, please reply to this email.',
                        '',
                        'Best regards,',
                        'Smart City Discovery Support'
                    ]
                        .filter(Boolean)
                        .join('\n');

                    const htmlBody = `
                        <div style="margin:0;padding:0;background:#f4f6fb;font-family:Segoe UI,Arial,sans-serif;color:#1f2937;">
                            <div style="max-width:680px;margin:0 auto;padding:24px 16px;">
                                <div style="background:#ffffff;border:1px solid #e4e8f1;border-radius:14px;overflow:hidden;box-shadow:0 10px 28px rgba(23,33,79,0.08);">
                                    <div style="padding:18px 22px;background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#ffffff;">
                                        <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.88;">Smart City Discovery Support</p>
                                        <h2 style="margin:8px 0 0;font-size:22px;line-height:1.3;">Update on your feedback report #${feedback.id}</h2>
                                    </div>
                                    <div style="padding:20px 22px 24px;">
                                        <p style="margin:0 0 14px;font-size:14px;color:#334155;">Hello,</p>
                                        <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#334155;">Thank you for contacting Smart City Discovery. Our support team has reviewed your report and provided an update below.</p>

                                        <div style="margin:0 0 18px;padding:14px;border:1px solid #e4e8f1;border-radius:10px;background:#f8faff;">
                                            <p style="margin:0 0 8px;font-size:13px;color:#475569;"><strong>Feedback ID:</strong> #${feedback.id}</p>
                                            <p style="margin:0 0 8px;font-size:13px;color:#475569;"><strong>Feedback Type:</strong> ${reportTypeLabel}</p>
                                            <p style="margin:0 0 8px;font-size:13px;color:#475569;"><strong>Submitted At:</strong> ${reportCreatedAtLabel}</p>
                                            <p style="margin:0;font-size:13px;color:#475569;"><strong>Current Status:</strong> ${nextStatusLabel}</p>
                                        </div>

                                        <h3 style="margin:0 0 8px;font-size:15px;color:#1e293b;">Original report</h3>
                                        <div style="margin:0 0 18px;padding:12px;border-radius:10px;background:#f9fafb;border:1px solid #eceff5;font-size:14px;line-height:1.65;color:#334155;">${formatMultilineHtml(reportMessageText)}</div>

                                        <h3 style="margin:0 0 8px;font-size:15px;color:#1e293b;">Support team response</h3>
                                        <div style="margin:0 0 8px;padding:12px;border-radius:10px;background:#eff6ff;border:1px solid #dbeafe;font-size:14px;line-height:1.65;color:#1e3a8a;">${formatMultilineHtml(replyMessage)}</div>
                                        <p style="margin:0 0 18px;font-size:12px;color:#64748b;"><strong>Handled by:</strong> ${escapeHtml(reviewerLabelForEmail)}</p>

                                        ${req.file ? '<p style="margin:0 0 18px;font-size:13px;color:#0f766e;">An image attachment from our support team is included in this email.</p>' : ''}

                                        <div style="margin:0;padding:14px;border-radius:10px;background:#f8fafc;border:1px dashed #d3dae8;">
                                            <p style="margin:0;font-size:13px;line-height:1.6;color:#475569;">If you need further assistance, please reply directly to this email and we will continue supporting your request.</p>
                                        </div>

                                        <p style="margin:18px 0 0;font-size:13px;color:#64748b;">Best regards,<br /><strong>Smart City Discovery Support</strong></p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;

                    const mailResult = await feedbackReplyTransporter.sendMail({
                        from: mailFrom,
                        to: recipientEmail,
                        subject: `[Smart City Discovery] Update on your feedback #${feedback.id}`,
                        text: plainTextBody,
                        html: htmlBody,
                        attachments: req.file
                            ? [
                                {
                                    filename: req.file.originalname,
                                    path: req.file.path,
                                    contentType: req.file.mimetype
                                }
                            ]
                            : []
                    });

                    const updateResult = await pool.query(
                        `
                            UPDATE feedbacks
                            SET
                                admin_reply_message = $2,
                                admin_reply_attachment_url = $3,
                                admin_replied_at = now(),
                                admin_replied_by = $4,
                                status = $5,
                                updated_at = now()
                            WHERE id = $1
                            RETURNING id, status, admin_reply_message, admin_reply_attachment_url, admin_replied_at, admin_replied_by, updated_at
                        `,
                        [feedbackId, replyMessage, replyAttachmentUrl, reviewer, nextStatus]
                    );

                    if (
                        req.file &&
                        feedback.admin_reply_attachment_url &&
                        feedback.admin_reply_attachment_url !== replyAttachmentUrl
                    ) {
                        safeDeleteUploadedFile(feedback.admin_reply_attachment_url);
                    }

                    return res.json({
                        message: 'Reply sent successfully via Gmail',
                        deliveredTo: recipientEmail,
                        messageId: mailResult?.messageId || null,
                        feedback: updateResult.rows[0]
                    });
                } catch (error) {
                    if (req.file) {
                        safeDeleteUploadedFile(`/uploads/feedback/admin-replies/${req.file.filename}`);
                    }

                    if (isFeedbackSchemaMissingError(error)) {
                        return res.status(500).json({
                            message: 'Feedback management schema is missing. Please run backend migrations.'
                        });
                    }

                    if (error?.code === 'EAUTH' || error?.responseCode === 535) {
                        return res.status(500).json({
                            message:
                                'Gmail authentication failed. Please re-check FEEDBACK_GMAIL_USER and FEEDBACK_GMAIL_APP_PASSWORD.'
                        });
                    }

                    if (error?.code === 'EENVELOPE') {
                        return res.status(400).json({
                            message: 'Recipient email is invalid or rejected by SMTP provider.'
                        });
                    }

                    return res.status(500).json({ message: error.message });
                }
            });
        }

        async function deleteAdminFeedbackReport(req, res) {
            const feedbackId = normalizeNullableNumber(req.params.feedbackId);

            if (Number.isNaN(feedbackId) || feedbackId === null) {
                return res.status(400).json({ message: 'feedbackId must be a positive integer' });
            }

            try {
                const deleteResult = await pool.query(
                    `
                        DELETE FROM feedbacks
                        WHERE id = $1
                        RETURNING id, attachment_url, admin_reply_attachment_url
                    `,
                    [feedbackId]
                );

                if (!deleteResult.rows.length) {
                    return res.status(404).json({ message: 'Feedback report not found' });
                }

                const deletedReport = deleteResult.rows[0];

                safeDeleteUploadedFile(deletedReport.attachment_url);
                safeDeleteUploadedFile(deletedReport.admin_reply_attachment_url);

                return res.json({
                    message: 'Feedback report deleted successfully',
                    deletedFeedbackId: deletedReport.id
                });
            } catch (error) {
                if (isFeedbackSchemaMissingError(error)) {
                    return res.status(500).json({
                        message: 'Feedback management schema is missing. Please run backend migrations.'
                    });
                }

                return res.status(500).json({ message: error.message });
            }
        }

        registerVersionedRoute('get', '/wards', listPublicWards);
        registerVersionedRoute('get', '/place-categories', listPublicPlaceCategories);
        registerVersionedRoute('get', '/merchant-services', listPublicMerchantServices);
        registerVersionedRoute('get', '/feedback/types', listPublicFeedbackTypes);
        registerVersionedRoute('get', '/venues', authenticateOptional, listPublicVenues);
        registerVersionedRoute('get', '/venues/:venueId', authenticateRequest, getVenueDetails);
        registerVersionedRoute('post', '/venues', authenticateRequest, createVenueSubmission);
        registerVersionedRoute('post', '/feedback', authenticateOptional, submitFeedbackReport);

        registerVersionedRoute('get', '/admin/wards', authenticateRequest, requireAdminRole, listAdminWards);
        registerVersionedRoute('post', '/admin/wards', authenticateRequest, requireAdminRole, upsertAdminWard);
        registerVersionedRoute('delete', '/admin/wards/:wardId', authenticateRequest, requireAdminRole, deleteAdminWard);
        registerVersionedRoute('get', '/admin/place-categories', authenticateRequest, requireAdminRole, listAdminPlaceCategories);
        registerVersionedRoute('post', '/admin/place-categories', authenticateRequest, requireAdminRole, createAdminPlaceCategory);
        registerVersionedRoute('patch', '/admin/place-categories/:categoryId', authenticateRequest, requireAdminRole, updateAdminPlaceCategory);
        registerVersionedRoute('delete', '/admin/place-categories/:categoryId', authenticateRequest, requireAdminRole, deleteAdminPlaceCategory);
        registerVersionedRoute('get', '/admin/merchant-services', authenticateRequest, requireAdminRole, listAdminMerchantServices);
        registerVersionedRoute('post', '/admin/merchant-services', authenticateRequest, requireAdminRole, createAdminMerchantService);
        registerVersionedRoute('patch', '/admin/merchant-services/:serviceId', authenticateRequest, requireAdminRole, updateAdminMerchantService);
        registerVersionedRoute('delete', '/admin/merchant-services/:serviceId', authenticateRequest, requireAdminRole, deleteAdminMerchantService);
        registerVersionedRoute('get', '/admin/venues', authenticateRequest, requireAdminRole, listAdminVenues);
        registerVersionedRoute('patch', '/admin/venues/:venueId/moderation', authenticateRequest, requireAdminRole, moderateVenueSubmission);
        registerVersionedRoute('get', '/admin/feedback/types', authenticateRequest, requireAdminRole, listAdminFeedbackTypes);
        registerVersionedRoute('post', '/admin/feedback/types', authenticateRequest, requireAdminRole, createAdminFeedbackType);
        registerVersionedRoute('patch', '/admin/feedback/types/:typeId', authenticateRequest, requireAdminRole, updateAdminFeedbackType);
        registerVersionedRoute('delete', '/admin/feedback/types/:typeId', authenticateRequest, requireAdminRole, deleteAdminFeedbackType);
        registerVersionedRoute('get', '/admin/feedback/reports', authenticateRequest, requireAdminRole, listAdminFeedbackReports);
        registerVersionedRoute('get', '/admin/feedback/reports/:feedbackId', authenticateRequest, requireAdminRole, getAdminFeedbackReportDetail);
        registerVersionedRoute('post', '/admin/feedback/reports/:feedbackId/reply', authenticateRequest, requireAdminRole, replyAdminFeedbackReport);
        registerVersionedRoute('delete', '/admin/feedback/reports/:feedbackId', authenticateRequest, requireAdminRole, deleteAdminFeedbackReport);

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
                        address, gender, bio, role, avatar_url AS "avatarUrl"
                 FROM users
                 WHERE id = $1`,
                        [userId]
                    )
                    : await pool.query(
                        `SELECT id, username, fullname, email, phone, birth_date AS "birthDate",
                        address, gender, bio, role, avatar_url AS "avatarUrl"
                 FROM users
                 WHERE email = $1`,
                        [email]
                    );

                if (result.rows.length === 0) {
                    return res.status(404).json({ message: 'User not found' });
                }

                const rawUser = result.rows[0];
                const user = {
                    ...rawUser,
                    phone: sanitizeTextField(rawUser.phone),
                    birthDate: sanitizeTextField(rawUser.birthDate),
                    address: sanitizeTextField(rawUser.address),
                    gender: sanitizeTextField(rawUser.gender),
                    bio: sanitizeTextField(rawUser.bio)
                };

                res.json({
                    success: true,
                    user
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
                       address, gender, bio, role, avatar_url AS "avatarUrl"`,
                    [
                        fullname,
                        normalizeNullableText(phone),
                        normalizeNullableText(birthDate),
                        normalizeNullableText(address),
                        normalizeNullableText(gender),
                        normalizeNullableText(bio),
                        userId
                    ]
                );

                if (result.rows.length === 0) {
                    return res.status(404).json({ message: 'User not found' });
                }

                const updatedRawUser = result.rows[0];
                const updatedUser = {
                    ...updatedRawUser,
                    phone: sanitizeTextField(updatedRawUser.phone),
                    birthDate: sanitizeTextField(updatedRawUser.birthDate),
                    address: sanitizeTextField(updatedRawUser.address),
                    gender: sanitizeTextField(updatedRawUser.gender),
                    bio: sanitizeTextField(updatedRawUser.bio)
                };

                res.json({
                    success: true,
                    message: 'Profile updated successfully',
                    user: updatedUser
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

        const AVATAR_BUCKET = process.env.SUPABASE_AVATAR_BUCKET || 'avatars';

        registerVersionedRoute('put', '/users/avatar', authenticateOptional, requireAuth, async (req, res) => {
            const userId = req.user.id;

            uploadAvatar.single('avatar')(req, res, async (uploadErr) => {
                if (uploadErr) {
                    return res.status(400).json({ message: uploadErr.message || 'Upload failed' });
                }

                if (!req.file) {
                    return res.status(400).json({ message: 'No file uploaded' });
                }

                const safeName = req.file.originalname.replace(/\s+/g, '-');
                const fileName = `${userId}-${Date.now()}-${safeName}`;
                const storagePath = `${userId}/${fileName}`;

                try {
                    const { error: uploadError } = await supabaseAdmin.storage
                        .from(AVATAR_BUCKET)
                        .upload(storagePath, req.file.buffer, {
                            contentType: req.file.mimetype,
                            upsert: true
                        });

                    if (uploadError) {
                        console.error('Avatar upload error (storage):', uploadError);
                        return res.status(500).json({
                            message: uploadError.message || 'Unable to upload avatar'
                        });
                    }

                    const { data: publicData } = supabaseAdmin.storage
                        .from(AVATAR_BUCKET)
                        .getPublicUrl(storagePath);

                    const avatarUrl = publicData?.publicUrl || null;

                    if (!avatarUrl) {
                        return res.status(500).json({ message: 'Unable to generate avatar URL' });
                    }

                    const result = await pool.query(
                        `UPDATE users
                         SET avatar_url = $1,
                             updated_at = CURRENT_TIMESTAMP
                         WHERE id = $2
                         RETURNING id, username, fullname, email, phone, birth_date AS "birthDate",
                                   address, gender, bio, role, avatar_url AS "avatarUrl"`,
                        [avatarUrl, userId]
                    );

                    if (result.rows.length === 0) {
                        return res.status(404).json({ message: 'User not found' });
                    }

                    const updatedRawUser = result.rows[0];
                    const updatedUser = {
                        ...updatedRawUser,
                        phone: sanitizeTextField(updatedRawUser.phone),
                        birthDate: sanitizeTextField(updatedRawUser.birthDate),
                        address: sanitizeTextField(updatedRawUser.address),
                        gender: sanitizeTextField(updatedRawUser.gender),
                        bio: sanitizeTextField(updatedRawUser.bio)
                    };

                    res.json({
                        success: true,
                        message: 'Avatar updated successfully',
                        user: updatedUser
                    });
                } catch (err) {
                    console.error('Avatar update error:', err);
                    res.status(500).json({ message: 'Server error' });
                }
            });
        });

        // ==========================================
        // USER FAVORITES APIS
        // ==========================================

        app.get('/api/users/favorites', authenticateOptional, requireAuth, async (req, res) => {
            const userId = req.user.id;

            try {
                const result = await pool.query(
                    `SELECT id, item_id AS "itemId", item_type AS "itemType",
                    name, image, price, description, created_at AS "createdAt"
             FROM user_favorites
             WHERE user_id = $1
             ORDER BY created_at DESC`,
                    [userId]
                );

                res.json({
                    success: true,
                    favorites: result.rows
                });
            } catch (err) {
                console.error('Favorites fetch error:', err);
                res.status(500).json({ message: 'Server error' });
            }
        });

        app.post('/api/users/favorites/toggle', authenticateOptional, requireAuth, async (req, res) => {
            const userId = req.user.id;
            const { itemId, itemType, name, image, price, description } = req.body;

            try {
                if (!itemId || !itemType) {
                    return res.status(400).json({ message: 'Missing item information.' });
                }

                const existing = await pool.query(
                    'SELECT id FROM user_favorites WHERE user_id = $1 AND item_id = $2 AND item_type = $3',
                    [userId, String(itemId), String(itemType)]
                );

                if (existing.rows.length > 0) {
                    await pool.query(
                        'DELETE FROM user_favorites WHERE user_id = $1 AND item_id = $2 AND item_type = $3',
                        [userId, String(itemId), String(itemType)]
                    );
                    return res.json({ success: true, favorited: false });
                }

                await pool.query(
                    `INSERT INTO user_favorites (user_id, item_id, item_type, name, image, price, description)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        userId,
                        String(itemId),
                        String(itemType),
                        name || null,
                        image || null,
                        price || null,
                        description || null
                    ]
                );

                res.json({ success: true, favorited: true });
            } catch (err) {
                console.error('Favorites toggle error:', err);
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
