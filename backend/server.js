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
    return normalizeNullable(value);
}

function normalizeNullable(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return Number.NaN;
    }

    return parsed;
}

function slugifyText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
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
                const effectiveStatuses = statusFilter.length ? statusFilter : ['approved'];
                const categoryId = normalizeCategoryId(req.query.categoryId);

                if (Number.isNaN(categoryId)) {
                    return res.status(400).json({ message: 'categoryId must be a positive integer' });
                }

                const values = [effectiveStatuses];
                const whereConditions = ['venues.status::text = ANY($1::text[])'];

                if (categoryId !== null) {
                    values.push(categoryId);
                    whereConditions.push(`venues.category_id = $${values.length}`);
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

                if (!isAdmin && String(venue.status || '').toLowerCase() !== 'approved') {
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
            const normalizedAddress = String(address || '').trim() || 'Chua co dia chi';
            const normalizedLatitude = Number(latitude);
            const normalizedLongitude = Number(longitude);
            const normalizedCategoryId = normalizeCategoryId(categoryId ?? category_id);
            const normalizedCategoryName = String(category || '').trim();
            const normalizedMetadata = metadata && typeof metadata === 'object' ? { ...metadata } : {};

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
                        normalizedMetadata
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
            const rejectionReason = String(req.body.rejectionReason || '').trim() || null;

            if (!Number.isFinite(venueId)) {
                return res.status(400).json({ message: 'Invalid venue id' });
            }

            if (!['approve', 'reject'].includes(action)) {
                return res.status(400).json({ message: 'action must be approve or reject' });
            }

            if (action === 'reject' && !rejectionReason) {
                return res.status(400).json({ message: 'rejectionReason is required when rejecting a submission' });
            }

            const reviewer = req.authUser?.email || req.authUser?.id || 'admin';

            try {
                const result =
                    action === 'approve'
                        ? await pool.query(
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
                        )
                        : await pool.query(
                            `
                          UPDATE venues
                          SET
                              status = 'rejected',
                              approved_at = NULL,
                              rejected_at = now(),
                              rejection_reason = $2,
                              reviewed_by = $3,
                              updated_at = now()
                          WHERE id = $1
                          RETURNING id
                      `,
                            [venueId, rejectionReason, reviewer]
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
                    message: action === 'approve' ? 'Venue approved successfully' : 'Venue rejected successfully',
                    venue: details.rows[0]
                });
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }

        registerVersionedRoute('get', '/wards', listPublicWards);
        registerVersionedRoute('get', '/place-categories', listPublicPlaceCategories);
        registerVersionedRoute('get', '/venues', listPublicVenues);
        registerVersionedRoute('get', '/venues/:venueId', authenticateRequest, getVenueDetails);
        registerVersionedRoute('post', '/venues', createVenueSubmission);

        registerVersionedRoute('get', '/admin/wards', authenticateRequest, requireAdminRole, listAdminWards);
        registerVersionedRoute('post', '/admin/wards', authenticateRequest, requireAdminRole, upsertAdminWard);
        registerVersionedRoute('delete', '/admin/wards/:wardId', authenticateRequest, requireAdminRole, deleteAdminWard);
        registerVersionedRoute('get', '/admin/place-categories', authenticateRequest, requireAdminRole, listAdminPlaceCategories);
        registerVersionedRoute('post', '/admin/place-categories', authenticateRequest, requireAdminRole, createAdminPlaceCategory);
        registerVersionedRoute('patch', '/admin/place-categories/:categoryId', authenticateRequest, requireAdminRole, updateAdminPlaceCategory);
        registerVersionedRoute('delete', '/admin/place-categories/:categoryId', authenticateRequest, requireAdminRole, deleteAdminPlaceCategory);
        registerVersionedRoute('get', '/admin/venues', authenticateRequest, requireAdminRole, listAdminVenues);
        registerVersionedRoute('patch', '/admin/venues/:venueId/moderation', authenticateRequest, requireAdminRole, moderateVenueSubmission);

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
