require('dotenv').config();
console.log("DB_HOST:", process.env.DB_HOST);
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
app.use(express.json({ limit: '10mb' }));
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

function resolveJwtUserId(payload) {
    const rawUserId = payload?.sub ?? payload?.id ?? payload?.userId ?? payload?.user_id ?? null;
    return rawUserId === null || rawUserId === undefined ? null : String(rawUserId).trim();
}

async function authenticateRequest(req, res, next) {
    const token = extractBearerToken(req);

    if (!token) {
        return res.status(401).json({ message: 'Missing authentication token' });
    }

    try {
        const payload = jwt.verify(token, jwtSecret);
        console.log('authenticateRequest payload:', payload);
        const resolvedUserId = resolveJwtUserId(payload);

        if (!resolvedUserId) {
            return res.status(401).json({ message: 'Invalid token payload' });
        }

        req.authUser = {
            id: resolvedUserId,
            email: payload.email,
            role: normalizeRole(payload.role)
        };

        req.user = {
            id: resolvedUserId,
            email: payload.email,
            role: payload.role
        };

        const statusResult = await pool.query(
            'SELECT status, pause_until, blocked_reason FROM users WHERE id = $1',
            [payload.sub]
        );

        if (statusResult.rows.length === 0) {
            return res.status(401).json({ message: 'Account not found' });
        }

        const user = statusResult.rows[0];
        const status = (user.status || 'active').toLowerCase();

        if (status === 'blocked') {
            const reason = user.blocked_reason || 'Vi phạm điều khoản sử dụng.';
            return res.status(403).json({ message: `Tài khoản đã bị khóa vĩnh viễn: ${reason}` });
        }

        if (status === 'paused') {
            const pauseUntil = user.pause_until ? new Date(user.pause_until) : null;
            const now = new Date();

            if (pauseUntil && pauseUntil > now) {
                return res.status(403).json({ message: `Tài khoản đang bị tạm dừng đến ${pauseUntil.toLocaleString()}` });
            }

            await pool.query(`UPDATE users SET status = 'active', pause_until = NULL WHERE id = $1`, [payload.sub]);
        }

        return next();
    } catch (error) {
        console.error('authenticateRequest error:', error);
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}

function getAuthToken(req) {
    return extractBearerToken(req) || null;
}

const venueOwnerColumnState = {
    exists: null,
    checkedAt: 0
};

const MAX_INLINE_IMAGE_URL_LENGTH = 200000;
const MAX_METADATA_JSON_LENGTH = 300000;

function sanitizeLargeInlineAssetUrl(value) {
    const normalized = String(value || '').trim();

    if (!normalized) {
        return null;
    }

    if (/^data:image\//i.test(normalized) && normalized.length > MAX_INLINE_IMAGE_URL_LENGTH) {
        return null;
    }

    return normalized;
}

function sanitizeVenueRecord(venue) {
    if (!venue || typeof venue !== 'object') {
        return venue;
    }

    return {
        ...venue,
        cover_image_url: sanitizeLargeInlineAssetUrl(venue.cover_image_url),
        business_license_image_url: sanitizeLargeInlineAssetUrl(venue.business_license_image_url)
    };
}

function buildSanitizedInlineAssetSql(columnSql, alias) {
    return `
        CASE
            WHEN ${columnSql} IS NULL OR BTRIM(${columnSql}) = '' THEN NULL
            WHEN ${columnSql} ~* '^data:image/' AND LENGTH(${columnSql}) > ${MAX_INLINE_IMAGE_URL_LENGTH} THEN NULL
            ELSE ${columnSql}
        END AS ${alias}
    `;
}

function buildSanitizedMetadataSql(columnSql, alias = 'metadata') {
    return `
        CASE
            WHEN ${columnSql} IS NULL THEN NULL
            WHEN LENGTH(${columnSql}::text) > ${MAX_METADATA_JSON_LENGTH} THEN NULL
            ELSE ${columnSql}
        END AS ${alias}
    `;
}

async function hasVenueOwnerUserColumn() {
    const now = Date.now();

    if (typeof venueOwnerColumnState.exists === 'boolean' && now - venueOwnerColumnState.checkedAt < 30000) {
        return venueOwnerColumnState.exists;
    }

    try {
        const result = await pool.query(
            `
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'venues'
                  AND column_name = 'owner_user_id'
                LIMIT 1
            `
        );

        venueOwnerColumnState.exists = Boolean(result.rows.length);
    } catch {
        venueOwnerColumnState.exists = false;
    }

    venueOwnerColumnState.checkedAt = now;
    return venueOwnerColumnState.exists;
}

function buildResolvedVenueOwnerUserSql(venueAlias = 'venues') {
    return `COALESCE(
        ${venueAlias}.owner_user_id,
        ${venueAlias}.owner_profile_id,
        CASE
            WHEN NULLIF(${venueAlias}.submitted_by_user_id, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                THEN NULLIF(${venueAlias}.submitted_by_user_id, '')::uuid
            ELSE NULL
        END
    )`;
}

// Middleware to check if user account is active (not paused or blocked)
async function checkUserStatus(req, res, next) {
    try {
        if (!req.user || !req.user.id) {
            console.log('⚠️ checkUserStatus: User not found in request');
            return res.status(401).json({ message: 'User not found in request' });
        }

        const userId = req.user.id;
        console.log('🔍 checkUserStatus: Checking user:', userId);
        const result = await pool.query(
            'SELECT status, pause_until, blocked_reason FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            console.log('⚠️ checkUserStatus: User account not found:', userId);
            return res.status(404).json({ message: 'User account not found' });
        }

        const user = result.rows[0];
        const status = (user.status || 'active').toLowerCase();
        console.log('📊 checkUserStatus: User status:', status, 'pause_until:', user.pause_until);

        if (status === 'blocked') {
            const reason = user.blocked_reason || 'Tài khoản đã bị khóa';
            console.log('🔴 checkUserStatus: User is BLOCKED -', reason);
            return res.status(403).json({ message: `Tài khoản đã bị khóa vĩnh viễn: ${reason}` });
        }

        if (status === 'paused') {
            const pauseUntil = user.pause_until ? new Date(user.pause_until) : null;
            const now = new Date();

            if (pauseUntil && pauseUntil > now) {
                console.log('🟡 checkUserStatus: User is PAUSED until', pauseUntil.toLocaleString());
                return res.status(403).json({ 
                    message: `Tài khoản đang bị tạm dừng đến ${pauseUntil.toLocaleString()}. Vui lòng thử lại sau.` 
                });
            }

            // If pause expired, auto-restore to active
            console.log('✅ checkUserStatus: Pause expired, restoring to active');
            await pool.query(
                `UPDATE users SET status = 'active', pause_until = NULL WHERE id = $1`,
                [userId]
            );
        }

        console.log('✅ checkUserStatus: User is ACTIVE, proceeding');
        return next();
    } catch (err) {
        console.error('checkUserStatus error:', err);
        return res.status(500).json({ message: 'Server error checking account status' });
    }
}

function authenticateOptional(req, res, next) {
    const token = getAuthToken(req);

    if (!token) {
        return next();
    }

    try {
        const payload = jwt.verify(token, jwtSecret);
        const resolvedUserId = resolveJwtUserId(payload);

        if (!resolvedUserId) {
            return next();
        }

        req.authUser = {
            id: resolvedUserId,
            email: payload.email,
            role: normalizeRole(payload.role)
        };

        req.user = {
            id: resolvedUserId,
            email: payload.email,
            role: payload.role
        };

        return next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}

function authenticateOptionalLenient(req, _res, next) {
    const token = getAuthToken(req);

    if (!token) {
        return next();
    }

    try {
        const payload = jwt.verify(token, jwtSecret);
        const resolvedUserId = resolveJwtUserId(payload);

        if (!resolvedUserId) {
            req.authUser = null;
            req.user = null;
            return next();
        }

        req.authUser = {
            id: resolvedUserId,
            email: payload.email,
            role: normalizeRole(payload.role)
        };

        req.user = {
            id: resolvedUserId,
            email: payload.email,
            role: payload.role
        };
    } catch (_error) {
        // Bỏ qua token lỗi với các endpoint cho phép khách, ví dụ gửi bình luận công khai.
        req.authUser = null;
        req.user = null;
    }

    return next();
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
        return res.status(401).json({ message: 'Bạn cần đăng nhập để thực hiện thao tác này.' });
    }

    return next();
}

async function listAdminUsers(req, res) {
    try {
        const searchTerm = (req.query.q || '').trim().toLowerCase();
        const roleFilter = (req.query.role || '').trim().toLowerCase();

        const conditions = [];
        const params = [];

        if (searchTerm) {
            conditions.push(
                `(LOWER(fullname) LIKE $${params.length + 1} OR LOWER(username) LIKE $${params.length + 2} OR LOWER(email) LIKE $${params.length + 3})`
            );
            const wildcard = `%${searchTerm}%`;
            params.push(wildcard, wildcard, wildcard);
        }

        if (roleFilter && roleFilter !== 'all') {
            conditions.push(`role = $${params.length + 1}`);
            params.push(roleFilter);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const query = `
            SELECT id, fullname, username, email, phone, address, role, gender, status, pause_until, blocked_reason, updated_at
            FROM users
            ${whereClause}
            ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, updated_at DESC
        `;

        const result = await pool.query(query, params);

        return res.json({ success: true, users: result.rows });
    } catch (err) {
        console.error('Admin list users error:', err);
        return res.status(500).json({ message: 'Server error', details: err.message });
    }
}

async function createAdminUser(req, res) {
    const { fullname, username, email, password, phone, address, role, gender } = req.body;

    if (!fullname || !username || !email || !password || !phone || !address) {
        return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin.' });
    }

    const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Email không hợp lệ' });
    }

    const phoneRegex = /^\d{9,15}$/;
    if (!phoneRegex.test(phone)) {
        return res.status(400).json({ message: 'Số điện thoại phải là 9-15 chữ số' });
    }

    const passwordErrors = [];
    if (password.length < 8) passwordErrors.push('ít nhất 8 ký tự');
    if (!/[A-Z]/.test(password)) passwordErrors.push('1 chữ hoa');
    if (!/[a-z]/.test(password)) passwordErrors.push('1 chữ thường');
    if (!/[0-9]/.test(password)) passwordErrors.push('1 chữ số');
    if (!/[!@#\$%\^&\*]/.test(password)) passwordErrors.push('1 ký tự đặc biệt (!@#$%^&*)');

    if (passwordErrors.length > 0) {
        return res.status(400).json({ message: `Mật khẩu phải có ${passwordErrors.join(', ')}` });
    }

    try {
        const existingEmail = await pool.query('SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)', [email]);
        if (existingEmail.rows.length > 0) {
            return res.status(400).json({ message: 'Email đã tồn tại' });
        }

        const existingUsername = await pool.query('SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)', [username]);
        if (existingUsername.rows.length > 0) {
            return res.status(400).json({ message: 'Username đã tồn tại' });
        }

        const existingPhone = await pool.query('SELECT 1 FROM users WHERE phone = $1', [phone]);
        if (existingPhone.rows.length > 0) {
            return res.status(400).json({ message: 'Số điện thoại đã tồn tại' });
        }

        const existingAddress = await pool.query('SELECT 1 FROM users WHERE LOWER(address) = LOWER($1)', [address]);
        if (existingAddress.rows.length > 0) {
            return res.status(400).json({ message: 'Địa chỉ đã tồn tại' });
        }

        const hashedPassword = await bcryptjs.hash(password, 10);

        const newRole = role && ['admin', 'merchant', 'user'].includes(role.toLowerCase()) ? role.toLowerCase() : 'user';

        const query = `
            INSERT INTO users (fullname, username, email, password, phone, address, role, gender)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, fullname, username, email, phone, address, role, gender, status, pause_until;
        `;

        const insertResult = await pool.query(query, [fullname, username, email, hashedPassword, phone, address, newRole, gender]);
        const createdUser = insertResult.rows[0];

        return res.status(201).json({ message: 'User tạo thành công', user: createdUser });
    } catch (err) {
        console.error('Create admin user error:', err);
        return res.status(500).json({ message: 'Server error', details: err.message });
    }
}

async function updateAdminUserRole(req, res) {
    const userId = req.params.userId;
    const { role, fullname, username, email, password, phone, address, gender, status, blocked_reason, pause_until } = req.body;

    if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ message: 'Invalid user ID.' });
    }

    if (role && !['admin', 'merchant', 'user'].includes(role.toLowerCase())) {
        return res.status(400).json({ message: 'Invalid role value.' });
    }

    if (status && !['active', 'paused', 'blocked'].includes(status.toLowerCase())) {
        return res.status(400).json({ message: 'Invalid status value.' });
    }

    if (role && (!fullname || !email)) {
        return res.status(400).json({ message: 'fullname and email are required to update role.' });
    }

    const updates = [];
    const params = [];

    if (role) {
        updates.push(`role = $${params.length + 1}`);
        params.push(role.toLowerCase());
    }
    if (fullname) {
        updates.push(`fullname = $${params.length + 1}`);
        params.push(fullname);
    }
    if (username) {
        updates.push(`username = $${params.length + 1}`);
        params.push(username);
    }
    if (email) {
        updates.push(`email = $${params.length + 1}`);
        params.push(email);
    }
    if (typeof phone !== 'undefined') {
        updates.push(`phone = $${params.length + 1}`);
        params.push(phone || null);
    }
    if (typeof address !== 'undefined') {
        updates.push(`address = $${params.length + 1}`);
        params.push(address || null);
    }
    if (typeof gender !== 'undefined') {
        updates.push(`gender = $${params.length + 1}`);
        params.push(gender || null);
    }
    if (status) {
        updates.push(`status = $${params.length + 1}`);
        params.push(status.toLowerCase());
    }
    if (password) {
        const passwordErrors = [];
        if (password.length < 8) passwordErrors.push('ít nhất 8 ký tự');
        if (!/[A-Z]/.test(password)) passwordErrors.push('1 chữ hoa');
        if (!/[a-z]/.test(password)) passwordErrors.push('1 chữ thường');
        if (!/[0-9]/.test(password)) passwordErrors.push('1 chữ số');
        if (!/[!@#\$%\^&\*]/.test(password)) passwordErrors.push('1 ký tự đặc biệt (!@#$%^&*)');

        if (passwordErrors.length > 0) {
            return res.status(400).json({ message: `Mật khẩu phải có ${passwordErrors.join(', ')}` });
        }

        const hashedPassword = await bcryptjs.hash(password, 10);
        updates.push(`password = $${params.length + 1}`);
        params.push(hashedPassword);
    }
    
    // Handle blocked_reason - either explicitly sent or auto-clear when status = 'active'
    const hasBlockedReasonInRequest = 'blocked_reason' in req.body;
    if (hasBlockedReasonInRequest) {
        updates.push(`blocked_reason = $${params.length + 1}`);
        params.push(blocked_reason); // Can be null to clear
    } else if (status && status.toLowerCase() === 'active') {
        // Auto-clear when changing to active (if not explicitly sent)
        updates.push(`blocked_reason = NULL`);
    }
    
    // Handle pause_until - either explicitly sent or auto-clear when status = 'active'
    const hasPauseUntilInRequest = 'pause_until' in req.body;
    if (hasPauseUntilInRequest) {
        updates.push(`pause_until = $${params.length + 1}`);
        params.push(pause_until); // Can be null to clear
    } else if (status && status.toLowerCase() === 'active') {
        // Auto-clear when changing to active (if not explicitly sent)
        updates.push(`pause_until = NULL`);
    } else if (pause_until && !status) {
        // If pause_until sent but status not sent, auto-set to paused
        updates.push(`pause_until = $${params.length + 1}`);
        params.push(pause_until);
        updates.push(`status = 'paused'`);
    }

    if (!updates.length) {
        return res.status(400).json({ message: 'At least one field is required to update.' });
    }

    const sql = `UPDATE users SET ${updates.join(', ')}, updated_at = current_timestamp WHERE id = $${params.length + 1} RETURNING id, fullname, username, email, phone, address, role, gender, status, pause_until, blocked_reason`;
    params.push(userId);

    try {
        const result = await pool.query(sql, params);

        if (!result.rows.length) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        console.error('Admin update user role error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
}

async function deleteAdminUserById(req, res) {
    const userId = req.params.userId;

    if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ message: 'Invalid user ID.' });
    }

    try {
        const result = await pool.query(
            `DELETE FROM users
             WHERE id = $1
             RETURNING id`,
            [userId]
        );

        if (!result.rows.length) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
        console.error('Admin delete user error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
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

const REVIEW_BLOCKED_TERMS = ['địt', 'đụ', 'dm', 'dcm', 'đéo', 'cặc', 'lồn', 'đĩ', 'vcl'];

function normalizeReviewModerationText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function findBlockedReviewTerm(value) {
    const normalized = normalizeReviewModerationText(value);

    if (!normalized) {
        return null;
    }

    for (const term of REVIEW_BLOCKED_TERMS) {
        const normalizedTerm = normalizeReviewModerationText(term);
        if (!normalizedTerm) {
            continue;
        }

        if (normalized.includes(normalizedTerm)) {
            return term;
        }
    }

    return null;
}

const PLACE_CATEGORY_ICON_OPTIONS = [
    '🍽️', '☕', '🍜', '🥐', '🍸', '🍰', '🛍️', '🎯', '🏞️', '📍',
    '🍔', '🍕', '🍣', '🍖', '🥗', '🍦', '🧋', '🍺', '🍷', '🥘',
    '🏨', '🛏️', '🏬', '🛒', '🏪', '💊', '🏥', '🩺', '🏫', '📚',
    '🏛️', '🏦', '💼', '🏢', '🧰', '🔧', '🚗', '⛽', '🧼', '💇',
    '💄', '💅', '🧖', '💪', '⚽', '🎬', '🎵', '🎨', '🖼️', '📸',
    '🪴', '🌳', '🏖️', '🗺️', '🚉', '🚌', '✈️', '🚴', '🐶', '🐱'
];
const PLACE_CATEGORY_ICON_SET = new Set(PLACE_CATEGORY_ICON_OPTIONS);

function normalizePlaceCategoryIcon(value, options = {}) {
    const required = options.required === true;
    const normalized = String(value || '').trim();

    if (!normalized) {
        if (required) {
            return { value: null, error: 'icon is required' };
        }

        return { value: null, error: null };
    }

    if (!PLACE_CATEGORY_ICON_SET.has(normalized)) {
        return { value: null, error: 'icon is invalid' };
    }

    return { value: normalized, error: null };
}

function isUndefinedColumnError(error) {
    return Boolean(error && error.code === '42703');
}

function isUndefinedTableError(error) {
    return Boolean(error && error.code === '42P01');
}

const WEEKLY_SCHEDULE_DAYS = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' }
];

const VENUE_OPENING_TIMEZONE = 'Asia/Ho_Chi_Minh';

function normalizeVenueMetadataObject(metadata) {
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
        return metadata;
    }

    if (typeof metadata === 'string') {
        try {
            const parsed = JSON.parse(metadata);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed;
            }
        } catch (_error) {
            return {};
        }
    }

    return {};
}

function getZonedNowSnapshot(now = new Date(), timeZone = VENUE_OPENING_TIMEZONE) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(now);
    const valueByType = new Map(parts.map((part) => [part.type, part.value]));
    const weekdayRaw = String(valueByType.get('weekday') || '').toLowerCase();
    const hour = Number(valueByType.get('hour'));
    const minute = Number(valueByType.get('minute'));
    const todayKeyByWeekday = {
        monday: 'monday',
        tuesday: 'tuesday',
        wednesday: 'wednesday',
        thursday: 'thursday',
        friday: 'friday',
        saturday: 'saturday',
        sunday: 'sunday'
    };

    return {
        nowMinutes: (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0),
        todayKey: todayKeyByWeekday[weekdayRaw] || 'monday'
    };
}

function normalizeWeeklyScheduleInput(scheduleInput, options = {}) {
    const fallbackStart = String(options.fallbackStart || '').trim();
    const fallbackEnd = String(options.fallbackEnd || '').trim();
    const hasFallbackRange = /^\d{2}:\d{2}$/.test(fallbackStart) && /^\d{2}:\d{2}$/.test(fallbackEnd) && fallbackStart < fallbackEnd;
    const source = scheduleInput && typeof scheduleInput === 'object' && !Array.isArray(scheduleInput) ? scheduleInput : null;

    if (!source && !hasFallbackRange) {
        return {
            value: null,
            error: 'weeklySchedule is required and must include all 7 days'
        };
    }

    const normalized = {};

    for (const day of WEEKLY_SCHEDULE_DAYS) {
        const dayValue = source?.[day.key] || null;
        const startRaw = String(dayValue?.start ?? '').trim();
        const endRaw = String(dayValue?.end ?? '').trim();
        const isOff = Boolean(dayValue?.off) || startRaw.toUpperCase() === 'OFF' || endRaw.toUpperCase() === 'OFF';

        if (isOff) {
            normalized[day.key] = {
                day: day.label,
                start: 'OFF',
                end: 'OFF',
                off: true
            };
            continue;
        }

        const start = startRaw || (hasFallbackRange ? fallbackStart : '');
        const end = endRaw || (hasFallbackRange ? fallbackEnd : '');

        if (!start || !end) {
            return {
                value: null,
                error: `${day.label} must include both start and end time, or use OFF`
            };
        }

        if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
            return {
                value: null,
                error: `${day.label} has invalid time format`
            };
        }

        if (start >= end) {
            return {
                value: null,
                error: `${day.label} end time must be later than start time`
            };
        }

        normalized[day.key] = {
            day: day.label,
            start,
            end,
            off: false
        };
    }

    return {
        value: normalized,
        error: null
    };
}

function toMinutesFromHHmm(value) {
    const normalized = String(value || '').trim();

    if (!/^\d{2}:\d{2}$/.test(normalized)) {
        return null;
    }

    const [hourText, minuteText] = normalized.split(':');
    const hour = Number(hourText);
    const minute = Number(minuteText);

    if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
        return null;
    }

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return null;
    }

    return hour * 60 + minute;
}

function extractVenueWeeklySchedule(metadata) {
    const normalizedMetadata = normalizeVenueMetadataObject(metadata);
    const source =
        normalizedMetadata && typeof normalizedMetadata.weeklySchedule === 'object' && !Array.isArray(normalizedMetadata.weeklySchedule)
            ? normalizedMetadata.weeklySchedule
            : null;

    if (!source) {
        return [];
    }

    return WEEKLY_SCHEDULE_DAYS.map((day) => {
        const daySchedule = source[day.key] || {};
        const start = String(daySchedule.start || '').trim();
        const end = String(daySchedule.end || '').trim();
        const off = Boolean(daySchedule.off) || start === 'OFF' || end === 'OFF';

        return {
            key: day.key,
            label: day.label,
            open: off ? 'OFF' : start || 'N/A',
            close: off ? 'OFF' : end || 'N/A',
            off
        };
    });
}

function buildVenueRealtimeOpeningPayload(metadata, now = new Date()) {
    const weeklySchedule = extractVenueWeeklySchedule(metadata);

    if (!weeklySchedule.length) {
        return {
            timezone: VENUE_OPENING_TIMEZONE,
            serverTime: now.toISOString(),
            current: {
                dayKey: null,
                dayLabel: null,
                isOpen: false,
                start: 'N/A',
                end: 'N/A'
            },
            weeklySchedule: []
        };
    }

    const zonedNow = getZonedNowSnapshot(now, VENUE_OPENING_TIMEZONE);
    const todayKey = zonedNow.todayKey;
    const nowMinutes = zonedNow.nowMinutes;

    const weeklyScheduleWithFlags = weeklySchedule.map((item) => ({
        ...item,
        isToday: item.key === todayKey
    }));

    const todaySchedule = weeklyScheduleWithFlags.find((item) => item.key === todayKey) || weeklyScheduleWithFlags[0];
    const startMinutes = toMinutesFromHHmm(todaySchedule.open);
    const endMinutes = toMinutesFromHHmm(todaySchedule.close);
    const isOpenNow =
        !todaySchedule.off &&
        startMinutes !== null &&
        endMinutes !== null &&
        nowMinutes >= startMinutes &&
        nowMinutes < endMinutes;

    return {
        timezone: VENUE_OPENING_TIMEZONE,
        serverTime: now.toISOString(),
        current: {
            dayKey: todaySchedule.key,
            dayLabel: todaySchedule.label,
            isOpen: isOpenNow,
            start: todaySchedule.open,
            end: todaySchedule.close
        },
        weeklySchedule: weeklyScheduleWithFlags
    };
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

        const poolMax = Number(process.env.PG_POOL_MAX || 8);
        const poolIdleTimeoutMs = Number(process.env.PG_IDLE_TIMEOUT_MS || 10000);
        const poolConnectionTimeoutMs = Number(process.env.PG_CONNECTION_TIMEOUT_MS || 60000);

        const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
        console.log('ℹ️ PostgreSQL pool config:', {
            max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 8,
            idleTimeoutMillis: Number.isFinite(poolIdleTimeoutMs) && poolIdleTimeoutMs > 0 ? poolIdleTimeoutMs : 10000,
            connectionTimeoutMillis: Number.isFinite(poolConnectionTimeoutMs) && poolConnectionTimeoutMs > 0 ? poolConnectionTimeoutMs : 60000
        });
        pool.query('SELECT NOW()', (err, res) => {
            if (err) {
                console.error('❌ Database connection failed:', err);
            } else {
                console.log('✅ Database connected:', res.rows[0]);
            }
        });

        pool.query(
            `
                ALTER TABLE IF EXISTS place_categories
                ADD COLUMN IF NOT EXISTS icon varchar(16)
            `
        ).catch(() => {
            // Ignore boot-time schema self-heal errors to keep server startup resilient.
        });

        pool.query(
            `
                UPDATE place_categories
                SET icon = '📍'
                WHERE icon IS NULL OR btrim(icon) = ''
            `
        ).catch(() => {
            // Ignore if place_categories table does not exist yet.
        });

        pool.query(
            `
                ALTER TABLE IF EXISTS venues
                ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL
            `
        ).catch(() => {
            // Ignore boot-time schema self-heal errors to keep server startup resilient.
        });

        pool.query(
            `
                CREATE INDEX IF NOT EXISTS venues_owner_user_id_idx
                ON venues(owner_user_id)
            `
        ).catch(() => {
            // Ignore boot-time schema self-heal errors to keep server startup resilient.
        });

        pool.query(
            `
                UPDATE venues
                SET owner_user_id = users.id
                FROM users
                WHERE venues.owner_user_id IS NULL
                  AND venues.owner_profile_id IS NOT NULL
                  AND users.id = venues.owner_profile_id
            `
        ).catch(() => {
            // Ignore if venues/users schema is not ready yet.
        });

        pool.query(
            `
                UPDATE venues
                SET owner_user_id = users.id
                FROM users
                WHERE venues.owner_user_id IS NULL
                  AND NULLIF(venues.submitted_by_user_id, '') IS NOT NULL
                  AND users.id::text = venues.submitted_by_user_id
            `
        ).catch(() => {
            // Ignore if venues/users schema is not ready yet.
        });

        pool.query(
            `
                UPDATE venues
                SET owner_user_id = users.id
                FROM users
                WHERE venues.owner_user_id IS NULL
                  AND LOWER(COALESCE(venues.metadata ->> 'contactEmail', '')) = LOWER(users.email)
            `
        ).catch(() => {
            // Ignore if venues/users schema is not ready yet.
        });

        pool.query(
            `
                CREATE TABLE IF NOT EXISTS chat_threads (
                    id BIGSERIAL PRIMARY KEY,
                    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    customer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    last_message_at TIMESTAMPTZ,
                    CONSTRAINT chat_threads_owner_customer_unique UNIQUE (owner_user_id, customer_user_id)
                )
            `
        ).catch(() => {
            // Ignore boot-time schema self-heal errors to keep server startup resilient.
        });

        pool.query(
            `
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id BIGSERIAL PRIMARY KEY,
                    thread_id BIGINT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
                    sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    venue_id INTEGER REFERENCES venues(id) ON DELETE SET NULL,
                    content TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `
        ).catch(() => {
            // Ignore boot-time schema self-heal errors to keep server startup resilient.
        });

        pool.query(
            `
                ALTER TABLE IF EXISTS chat_messages
                ADD COLUMN IF NOT EXISTS context_label TEXT
            `
        ).catch(() => {
            // Ignore boot-time schema self-heal errors to keep server startup resilient.
        });

        pool.query(
            `
                CREATE TABLE IF NOT EXISTS chat_thread_reads (
                    thread_id BIGINT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    last_read_message_id BIGINT REFERENCES chat_messages(id) ON DELETE SET NULL,
                    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (thread_id, user_id)
                )
            `
        ).catch(() => {
            // Ignore boot-time schema self-heal errors to keep server startup resilient.
        });

        pool.query(
            `
                CREATE TABLE IF NOT EXISTS chat_thread_hidden (
                    thread_id BIGINT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    hidden_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (thread_id, user_id)
                )
            `
        ).catch(() => {
            // Ignore boot-time schema self-heal errors to keep server startup resilient.
        });

        pool.query(
            `
                CREATE INDEX IF NOT EXISTS chat_threads_owner_user_id_idx
                ON chat_threads(owner_user_id)
            `
        ).catch(() => {
            // Ignore boot-time schema self-heal errors to keep server startup resilient.
        });

        pool.query(
            `
                CREATE INDEX IF NOT EXISTS chat_threads_customer_user_id_idx
                ON chat_threads(customer_user_id)
            `
        ).catch(() => {
            // Ignore boot-time schema self-heal errors to keep server startup resilient.
        });

        pool.query(
            `
                CREATE INDEX IF NOT EXISTS chat_messages_thread_id_created_at_idx
                ON chat_messages(thread_id, created_at DESC, id DESC)
            `
        ).catch(() => {
            // Ignore boot-time schema self-heal errors to keep server startup resilient.
        });

        pool.query(
            `
                CREATE INDEX IF NOT EXISTS chat_messages_recipient_user_id_idx
                ON chat_messages(recipient_user_id, created_at DESC)
            `
        ).catch(() => {
            // Ignore boot-time schema self-heal errors to keep server startup resilient.
        });

        pool.query(
            `
                CREATE INDEX IF NOT EXISTS chat_thread_hidden_user_id_idx
                ON chat_thread_hidden(user_id, hidden_at DESC)
            `
        ).catch(() => {
            // Ignore boot-time schema self-heal errors to keep server startup resilient.
        });

        pool.query(
            `
                CREATE TABLE IF NOT EXISTS venue_public_reviews (
                    id BIGSERIAL PRIMARY KEY,
                    venue_id INT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
                    user_id TEXT NULL,
                    author_name TEXT,
                    title TEXT,
                    comment TEXT NOT NULL,
                    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
                    image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `
        ).catch(() => {
            // Ignore boot-time schema self-heal errors to keep server startup resilient.
        });

        pool.query(
            `
                ALTER TABLE IF EXISTS venue_public_reviews
                ALTER COLUMN rating DROP NOT NULL
            `
        ).catch(() => {
            // Ignore if table does not exist yet or schema not ready.
        });

        pool.query(
            `
                ALTER TABLE IF EXISTS venue_public_reviews
                ALTER COLUMN user_id TYPE TEXT USING user_id::text
            `
        ).catch(() => {
            // Ignore if table does not exist yet or schema not ready.
        });

        pool.query(
            `
                CREATE INDEX IF NOT EXISTS idx_venue_public_reviews_venue_id
                ON venue_public_reviews (venue_id, created_at DESC)
            `
        ).catch(() => {
            // Ignore boot-time schema self-heal errors to keep server startup resilient.
        });

        pool.query(
            `
                CREATE TABLE IF NOT EXISTS venue_review_likes (
                    review_id BIGINT NOT NULL REFERENCES venue_public_reviews(id) ON DELETE CASCADE,
                    user_id TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (review_id, user_id)
                )
            `
        ).catch(() => {
            // Ignore boot-time schema self-heal errors to keep server startup resilient.
        });

        pool.query(
            `
                CREATE INDEX IF NOT EXISTS idx_venue_review_likes_review
                ON venue_review_likes (review_id)
            `
        ).catch(() => {
            // Ignore boot-time schema self-heal errors to keep server startup resilient.
        });

        pool.query(
            `
                CREATE TABLE IF NOT EXISTS venue_review_replies (
                    id BIGSERIAL PRIMARY KEY,
                    review_id BIGINT NOT NULL REFERENCES venue_public_reviews(id) ON DELETE CASCADE,
                    user_id TEXT NOT NULL,
                    author_name TEXT NOT NULL,
                    rating INTEGER NULL CHECK (rating BETWEEN 1 AND 5),
                    title TEXT,
                    content TEXT NOT NULL,
                    image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `
        ).catch(() => {
            // Ignore boot-time schema self-heal errors to keep server startup resilient.
        });

        pool.query(
            `
                CREATE INDEX IF NOT EXISTS idx_venue_review_replies_review
                ON venue_review_replies (review_id, created_at ASC)
            `
        ).catch(() => {
            // Ignore boot-time schema self-heal errors to keep server startup resilient.
        });

        pool.query(
            `
                ALTER TABLE IF EXISTS venue_review_replies
                ADD COLUMN IF NOT EXISTS rating INTEGER NULL CHECK (rating BETWEEN 1 AND 5)
            `
        ).catch(() => {
            // Ignore if table does not exist yet or schema not ready.
        });

        pool.query(
            `
                ALTER TABLE IF EXISTS venue_review_replies
                ADD COLUMN IF NOT EXISTS title TEXT
            `
        ).catch(() => {
            // Ignore if table does not exist yet or schema not ready.
        });

        pool.query(
            `
                ALTER TABLE IF EXISTS venue_review_replies
                ADD COLUMN IF NOT EXISTS image_urls JSONB NOT NULL DEFAULT '[]'::jsonb
            `
        ).catch(() => {
            // Ignore if table does not exist yet or schema not ready.
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

        const venueReviewUploadDir = path.join(__dirname, 'uploads', 'reviews');
        if (!fs.existsSync(venueReviewUploadDir)) {
            fs.mkdirSync(venueReviewUploadDir, { recursive: true });
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

        const uploadVenueModerationMessage = multer({
            storage: feedbackReplyStorage,
            limits: { fileSize: 8 * 1024 * 1024, files: 5 },
            fileFilter: (_req, file, cb) => {
                const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
                if (allowed.includes(file.mimetype)) {
                    cb(null, true);
                } else {
                    cb(new Error('Only image attachments are supported for venue moderation messages'));
                }
            }
        });

        const venueReviewStorage = multer.diskStorage({
            destination: venueReviewUploadDir,
            filename: (_req, file, cb) => {
                const safeName = file.originalname.replace(/\s+/g, '-');
                cb(null, `${Date.now()}-review-${safeName}`);
            }
        });

        const uploadVenueReview = multer({
            storage: venueReviewStorage,
            limits: { fileSize: 8 * 1024 * 1024, files: 6 },
            fileFilter: (_req, file, cb) => {
                const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
                if (allowed.includes(file.mimetype)) {
                    cb(null, true);
                } else {
                    cb(new Error('Only image files are supported for review attachments'));
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

        const PUBLIC_WARDS_CACHE_TTL_MS = 30000;
        const PUBLIC_VENUES_COMPACT_CACHE_TTL_MS = 3000;
        let publicWardsSummaryCache = { timestamp: 0, data: null };
        let publicWardsFullCache = { timestamp: 0, data: null };
        let publicCompactApprovedVenuesCache = { timestamp: 0, data: null };

        async function listPublicWards(req, res) {
            try {
                const summaryMode = ['1', 'true', 'yes'].includes(String(req.query.summary || '').trim().toLowerCase());
                const now = Date.now();
                const targetCache = summaryMode ? publicWardsSummaryCache : publicWardsFullCache;

                if (targetCache.data && now - targetCache.timestamp < PUBLIC_WARDS_CACHE_TTL_MS) {
                    return res.json(targetCache.data);
                }

                const selectClause = summaryMode ? 'ward_id, name' : 'ward_id, name, boundary';
                const result = await pool.query(
                    `
                SELECT ${selectClause}
                FROM wards
                ORDER BY name ASC
            `
                );

                if (summaryMode) {
                    publicWardsSummaryCache = { timestamp: Date.now(), data: result.rows };
                } else {
                    publicWardsFullCache = { timestamp: Date.now(), data: result.rows };
                }

                res.json(result.rows);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        }

        async function listPublicVenues(req, res) {
            try {
                const venueHasOwnerUserColumn = await hasVenueOwnerUserColumn();
                const statusFilter = normalizeStatusList(req.query.status);
                const effectiveStatuses = statusFilter.length ? statusFilter : ['approved'];
                const compactMode = ['1', 'true', 'yes'].includes(String(req.query.compact || '').trim().toLowerCase());
                const liveMode = ['1', 'true', 'yes'].includes(String(req.query.live || '').trim().toLowerCase());
                const categoryId = normalizeCategoryId(req.query.categoryId);
                const categoryIdsFilter = parsePositiveIntegerList(req.query.categoryIds);
                const serviceIdsFilter = parsePositiveIntegerList(req.query.serviceIds);
                const wardIdsFilter = parseTextList(req.query.wardIds);
                const singleWardId = normalizeNullableText(req.query.wardId);
                const searchKeyword = String(req.query.q ?? req.query.search ?? '').trim().toLowerCase();

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

                const useCompactApprovedCache =
                    compactMode &&
                    !liveMode &&
                    effectiveStatuses.length === 1 &&
                    effectiveStatuses[0] === 'approved' &&
                    effectiveCategoryIds.length === 0 &&
                    effectiveWardIds.length === 0 &&
                    serviceIdsFilter.values.length === 0 &&
                    !searchKeyword;

                if (useCompactApprovedCache) {
                    const now = Date.now();
                    if (
                        publicCompactApprovedVenuesCache.data &&
                        now - publicCompactApprovedVenuesCache.timestamp < PUBLIC_VENUES_COMPACT_CACHE_TTL_MS
                    ) {
                        return res.json(publicCompactApprovedVenuesCache.data);
                    }
                }

                const compactMetadataSelect = 'NULL::jsonb AS metadata';
                const fullMetadataSelect = buildSanitizedMetadataSql('venues.metadata', 'metadata');
                const metadataSelect = compactMode ? compactMetadataSelect : fullMetadataSelect;
                const businessLicenseSelect = compactMode
                    ? 'NULL::text AS business_license_image_url'
                    : buildSanitizedInlineAssetSql('venues.business_license_image_url', 'business_license_image_url');
                const coverImageSelect = buildSanitizedInlineAssetSql('venues.cover_image_url', 'cover_image_url');
                const moderationColumnsSelect = compactMode
                    ? `
                    NULL::timestamptz AS submitted_at,
                    venues.approved_at,
                    NULL::timestamptz AS rejected_at,
                    NULL::text AS rejection_reason,
                `
                    : `
                    venues.submitted_at,
                    venues.approved_at,
                    venues.rejected_at,
                    venues.rejection_reason,
                `;
                const resolvedOwnerUserSql = buildResolvedVenueOwnerUserSql('venues');
                const ownerSelect = venueHasOwnerUserColumn
                    ? `
                    ${resolvedOwnerUserSql} AS owner_user_id,
                    owner_users.fullname AS owner_name,
                `
                    : `
                    NULL::uuid AS owner_user_id,
                    NULL::text AS owner_name,
                `;
                const ownerJoin = venueHasOwnerUserColumn
                    ? `LEFT JOIN users AS owner_users ON owner_users.id = ${resolvedOwnerUserSql}`
                    : '';

                const result = await pool.query(
                    `
                SELECT
                    venues.id,
                    venues.name,
                    venues.title,
                    ${ownerSelect}
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
                    ${coverImageSelect},
                    ${businessLicenseSelect},
                    ${metadataSelect},
                    venues.status::text AS status,
                    ${moderationColumnsSelect}
                    venues.created_at,
                    venues.updated_at
                FROM venues
                LEFT JOIN wards ON wards.ward_id = venues.ward_id
                LEFT JOIN place_categories ON place_categories.id = venues.category_id
                ${ownerJoin}
                WHERE ${whereConditions.join(' AND ')}
                ORDER BY COALESCE(venues.approved_at, venues.created_at) DESC, venues.id DESC
            `,
                    values
                );

                const sanitizedRows = result.rows.map(sanitizeVenueRecord);

                if (useCompactApprovedCache) {
                    publicCompactApprovedVenuesCache = {
                        timestamp: Date.now(),
                        data: sanitizedRows
                    };
                }

                res.json(sanitizedRows);
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
                const venueHasOwnerUserColumn = await hasVenueOwnerUserColumn();
                const resolvedOwnerUserSql = buildResolvedVenueOwnerUserSql('venues');
                const coverImageSelect = buildSanitizedInlineAssetSql('venues.cover_image_url', 'cover_image_url');
                const businessLicenseSelect = buildSanitizedInlineAssetSql('venues.business_license_image_url', 'business_license_image_url');
                const metadataSelect = buildSanitizedMetadataSql('venues.metadata', 'metadata');
                const ownerSelect = venueHasOwnerUserColumn
                    ? `
                    ${resolvedOwnerUserSql} AS owner_user_id,
                    owner_users.fullname AS owner_name,
                `
                    : `
                    NULL::uuid AS owner_user_id,
                    NULL::text AS owner_name,
                `;
                const ownerJoin = venueHasOwnerUserColumn
                    ? `LEFT JOIN users AS owner_users ON owner_users.id = ${resolvedOwnerUserSql}`
                    : '';
                const result = await pool.query(
                    `
                SELECT
                    venues.id,
                    venues.name,
                    venues.title,
                    ${ownerSelect}
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
                    ${coverImageSelect},
                    ${businessLicenseSelect},
                    ${metadataSelect},
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
                ${ownerJoin}
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

                return res.json(sanitizeVenueRecord(venue));
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }

        async function getPublicVenueForDetail(venueId, isAdmin) {
            const venueHasOwnerUserColumn = await hasVenueOwnerUserColumn();
            const resolvedOwnerUserSql = buildResolvedVenueOwnerUserSql('venues');
            const coverImageSelect = buildSanitizedInlineAssetSql('venues.cover_image_url', 'cover_image_url');
            const metadataSelect = buildSanitizedMetadataSql('venues.metadata', 'metadata');
            const ownerSelect = venueHasOwnerUserColumn
                ? `
                    ${resolvedOwnerUserSql} AS owner_user_id,
                    owner_users.fullname AS owner_name,
                `
                : `
                    NULL::uuid AS owner_user_id,
                    NULL::text AS owner_name,
                `;
            const ownerJoin = venueHasOwnerUserColumn
                ? `LEFT JOIN users AS owner_users ON owner_users.id = ${resolvedOwnerUserSql}`
                : '';
            const result = await pool.query(
                `
                SELECT
                    venues.id,
                    venues.name,
                    venues.title,
                    ${ownerSelect}
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
                    ${coverImageSelect},
                    ${metadataSelect},
                    venues.average_rating,
                    venues.total_reviews,
                    venues.status::text AS status,
                    venues.created_at,
                    venues.updated_at
                FROM venues
                LEFT JOIN wards ON wards.ward_id = venues.ward_id
                LEFT JOIN place_categories ON place_categories.id = venues.category_id
                ${ownerJoin}
                WHERE venues.id = $1
                LIMIT 1
            `,
                [venueId]
            );

            if (!result.rows.length) {
                return null;
            }

            const venue = result.rows[0];
            if (!isAdmin && String(venue.status || '').toLowerCase() !== 'approved') {
                return null;
            }

            return sanitizeVenueRecord(venue);
        }

        async function getVenueCommunityBundle(req, res) {
            const venueId = Number(req.params.venueId);
            let venue = null;
            const currentUserId = String(req.user?.id || '').trim();

            if (!Number.isFinite(venueId)) {
                return res.status(400).json({ message: 'Invalid venue id' });
            }

            try {
                const isAdmin = normalizeRole(req.authUser?.role) === 'admin';
                venue = await getPublicVenueForDetail(venueId, isAdmin);

                if (!venue) {
                    return res.status(404).json({ message: 'Venue not found' });
                }

                const reviewsResult = await pool.query(
                    `
                        SELECT
                            reviews.id,
                            reviews.venue_id,
                            reviews.user_id,
                            reviews.author_name,
                            reviews.title,
                            reviews.comment,
                            reviews.rating,
                            reviews.image_urls,
                            reviews.created_at,
                            reviews.updated_at,
                            COALESCE(like_stats.like_count, 0)::int AS like_count,
                            COALESCE(reply_stats.reply_count, 0)::int AS reply_count,
                            CASE
                                WHEN $2::text = '' THEN false
                                WHEN liked.review_id IS NULL THEN false
                                ELSE true
                            END AS liked_by_me
                        FROM venue_public_reviews AS reviews
                        LEFT JOIN (
                            SELECT review_id, COUNT(*)::int AS like_count
                            FROM venue_review_likes
                            GROUP BY review_id
                        ) AS like_stats ON like_stats.review_id = reviews.id
                        LEFT JOIN (
                            SELECT review_id, COUNT(*)::int AS reply_count
                            FROM venue_review_replies
                            GROUP BY review_id
                        ) AS reply_stats ON reply_stats.review_id = reviews.id
                        LEFT JOIN venue_review_likes AS liked
                            ON liked.review_id = reviews.id
                           AND liked.user_id = $2
                        WHERE reviews.venue_id = $1
                        ORDER BY reviews.created_at DESC, reviews.id DESC
                    `,
                    [venueId, currentUserId]
                );

                const statsResult = await pool.query(
                    `
                        SELECT
                            COALESCE(AVG(rating)::numeric(10,2), 0) AS average_rating,
                            COUNT(*)::int AS total_reviews
                        FROM venue_public_reviews
                        WHERE venue_id = $1
                    `,
                    [venueId]
                );

                const reviewIds = reviewsResult.rows.map((review) => Number(review.id)).filter((id) => Number.isInteger(id));
                let repliesByReviewId = new Map();

                if (reviewIds.length) {
                    const repliesResult = await pool.query(
                        `
                            SELECT
                                id,
                                review_id,
                                user_id,
                                author_name,
                                rating,
                                title,
                                content,
                                image_urls,
                                created_at,
                                updated_at
                            FROM venue_review_replies
                            WHERE review_id = ANY($1::bigint[])
                            ORDER BY created_at ASC, id ASC
                        `,
                        [reviewIds]
                    );

                    repliesByReviewId = repliesResult.rows.reduce((acc, reply) => {
                        const reviewId = Number(reply.review_id);
                        if (!acc.has(reviewId)) {
                            acc.set(reviewId, []);
                        }

                        acc.get(reviewId).push({
                            id: reply.id,
                            reviewId,
                            userId: reply.user_id,
                            authorName: reply.author_name || 'Ẩn danh',
                            rating: Number(reply.rating || 0),
                            title: reply.title || '',
                            content: reply.content || '',
                            imageUrls: Array.isArray(reply.image_urls)
                                ? reply.image_urls.map((item) => String(item || '').trim()).filter(Boolean)
                                : [],
                            createdAt: reply.created_at,
                            updatedAt: reply.updated_at,
                            canDelete: currentUserId && String(reply.user_id || '') === currentUserId
                        });

                        return acc;
                    }, new Map());
                }

                const reviewRows = reviewsResult.rows.map((review) => {
                    const imageUrls = Array.isArray(review.image_urls)
                        ? review.image_urls.map((item) => String(item || '').trim()).filter(Boolean)
                        : [];

                    const normalizedReviewId = Number(review.id);

                    return {
                        id: review.id,
                        venueId: review.venue_id,
                        userId: review.user_id,
                        authorName: review.author_name || 'Ẩn danh',
                        title: review.title || '',
                        comment: review.comment || '',
                        rating: Number(review.rating || 0),
                        imageUrls,
                        likeCount: Number(review.like_count || 0),
                        replyCount: Number(review.reply_count || 0),
                        likedByMe: Boolean(review.liked_by_me),
                        canDelete: currentUserId && String(review.user_id || '') === currentUserId,
                        replies: repliesByReviewId.get(normalizedReviewId) || [],
                        createdAt: review.created_at,
                        updatedAt: review.updated_at
                    };
                });

                const reviewImages = [...new Set(reviewRows.flatMap((review) => review.imageUrls || []))];
                const stats = {
                    averageRating:
                        Number(statsResult.rows[0]?.average_rating || 0) || Number(venue.average_rating || 0) || 0,
                    totalReviews: Number(statsResult.rows[0]?.total_reviews || 0) || Number(venue.total_reviews || 0) || 0
                };

                return res.json({
                    venue,
                    stats,
                    reviews: reviewRows,
                    reviewImages
                });
            } catch (error) {
                if (error?.code === '42P01') {
                    return res.json({
                        venue,
                        stats: {
                            averageRating: Number(venue?.average_rating || 0),
                            totalReviews: Number(venue?.total_reviews || 0)
                        },
                        reviews: [],
                        reviewImages: []
                    });
                }

                return res.status(500).json({ message: error.message });
            }
        }

        async function getVenueOpeningHoursRealtime(req, res) {
            const venueId = Number(req.params.venueId);

            if (!Number.isFinite(venueId)) {
                return res.status(400).json({ message: 'Invalid venue id' });
            }

            try {
                const isAdmin = normalizeRole(req.authUser?.role) === 'admin';
                const venue = await getPublicVenueForDetail(venueId, isAdmin);

                if (!venue) {
                    return res.status(404).json({ message: 'Venue not found' });
                }

                const metadata = normalizeVenueMetadataObject(venue.metadata);

                const realtimePayload = buildVenueRealtimeOpeningPayload(metadata, new Date());

                return res.json({
                    venueId,
                    ...realtimePayload
                });
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }

        function submitVenueReview(req, res) {
            uploadVenueReview.array('images', 6)(req, res, async (uploadErr) => {
                if (uploadErr) {
                    return res.status(400).json({ message: uploadErr.message || 'Upload failed' });
                }

                const uploadedFiles = Array.isArray(req.files) ? req.files : [];
                const cleanupUploadedFiles = () => {
                    uploadedFiles.forEach((file) => {
                        if (file?.filename) {
                            safeDeleteUploadedFile(`/uploads/reviews/${file.filename}`);
                        }
                    });
                };

                const venueId = Number(req.params.venueId);
                const rawRating = String(req.body.rating || '').trim();
                const title = String(req.body.title || '').trim();
                const comment = String(req.body.comment || '').trim();
                const userId = String(req.user?.id || '').trim();
                let rating = null;

                if (!userId) {
                    cleanupUploadedFiles();
                    return res.status(401).json({ message: 'Bạn cần đăng nhập để bình luận.' });
                }

                if (!Number.isFinite(venueId)) {
                    cleanupUploadedFiles();
                    return res.status(400).json({ message: 'Invalid venue id' });
                }

                if (rawRating) {
                    const parsedRating = Number(rawRating);
                    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
                        cleanupUploadedFiles();
                        return res.status(400).json({ message: 'rating must be an integer between 1 and 5' });
                    }

                    rating = parsedRating;
                }

                if (!comment) {
                    cleanupUploadedFiles();
                    return res.status(400).json({ message: 'comment is required' });
                }

                if (findBlockedReviewTerm(`${title} ${comment}`)) {
                    cleanupUploadedFiles();
                    return res.status(400).json({ message: 'Nội dung bình luận chứa từ ngữ không phù hợp.' });
                }

                try {
                    const venueResult = await pool.query(
                        `
                            SELECT id, status::text AS status
                            FROM venues
                            WHERE id = $1
                            LIMIT 1
                        `,
                        [venueId]
                    );

                    if (!venueResult.rows.length) {
                        cleanupUploadedFiles();
                        return res.status(404).json({ message: 'Venue not found' });
                    }

                    if (String(venueResult.rows[0].status || '').toLowerCase() !== 'approved') {
                        cleanupUploadedFiles();
                        return res.status(404).json({ message: 'Venue not found' });
                    }

                    const userResult = await pool.query(
                        `
                            SELECT id, fullname, username
                            FROM users
                            WHERE id::text = $1
                            LIMIT 1
                        `,
                        [userId]
                    );

                    const authorName =
                        userResult.rows[0]?.fullname || userResult.rows[0]?.username || req.authUser?.email || 'Người dùng';
                    const imageUrls = uploadedFiles.map((file) => `/uploads/reviews/${file.filename}`);

                    const insertResult = await pool.query(
                        `
                            INSERT INTO venue_public_reviews (
                                venue_id,
                                user_id,
                                author_name,
                                title,
                                comment,
                                rating,
                                image_urls,
                                updated_at
                            )
                            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
                            RETURNING id, venue_id, user_id, author_name, title, comment, rating, image_urls, created_at, updated_at
                        `,
                        [venueId, userId, authorName, title || null, comment, rating, JSON.stringify(imageUrls)]
                    );

                    const statsResult = await pool.query(
                        `
                            SELECT
                                COALESCE(AVG(rating)::numeric(10,2), 0) AS average_rating,
                                COUNT(*)::int AS total_reviews
                            FROM venue_public_reviews
                            WHERE venue_id = $1
                        `,
                        [venueId]
                    );

                    const created = insertResult.rows[0];

                    return res.status(201).json({
                        message: 'Review submitted successfully',
                        review: {
                            id: created.id,
                            venueId: created.venue_id,
                            userId: created.user_id,
                            authorName: created.author_name,
                            title: created.title || '',
                            comment: created.comment,
                            rating: created.rating === null ? null : Number(created.rating || 0),
                            imageUrls: Array.isArray(created.image_urls) ? created.image_urls : [],
                            createdAt: created.created_at,
                            updatedAt: created.updated_at
                        },
                        stats: {
                            averageRating: Number(statsResult.rows[0]?.average_rating || 0),
                            totalReviews: Number(statsResult.rows[0]?.total_reviews || 0)
                        }
                    });
                } catch (error) {
                    cleanupUploadedFiles();
                    return res.status(500).json({ message: error.message });
                }
            });
        }

        async function toggleVenueReviewLike(req, res) {
            const venueId = normalizeNullableNumber(req.params.venueId);
            const reviewId = normalizeNullableNumber(req.params.reviewId);
            const userId = String(req.user?.id || '').trim();

            if (Number.isNaN(venueId) || venueId === null || Number.isNaN(reviewId) || reviewId === null) {
                return res.status(400).json({ message: 'venueId/reviewId không hợp lệ.' });
            }

            if (!userId) {
                return res.status(401).json({ message: 'Bạn cần đăng nhập để thích bình luận.' });
            }

            try {
                const reviewResult = await pool.query(
                    `
                        SELECT id
                        FROM venue_public_reviews
                        WHERE id = $1 AND venue_id = $2
                        LIMIT 1
                    `,
                    [reviewId, venueId]
                );

                if (!reviewResult.rows.length) {
                    return res.status(404).json({ message: 'Không tìm thấy bình luận.' });
                }

                const existingLike = await pool.query(
                    `
                        SELECT 1
                        FROM venue_review_likes
                        WHERE review_id = $1 AND user_id = $2
                        LIMIT 1
                    `,
                    [reviewId, userId]
                );

                let liked = false;

                if (existingLike.rows.length) {
                    await pool.query(
                        `
                            DELETE FROM venue_review_likes
                            WHERE review_id = $1 AND user_id = $2
                        `,
                        [reviewId, userId]
                    );
                } else {
                    await pool.query(
                        `
                            INSERT INTO venue_review_likes (review_id, user_id)
                            VALUES ($1, $2)
                            ON CONFLICT (review_id, user_id) DO NOTHING
                        `,
                        [reviewId, userId]
                    );
                    liked = true;
                }

                const countResult = await pool.query(
                    `
                        SELECT COUNT(*)::int AS like_count
                        FROM venue_review_likes
                        WHERE review_id = $1
                    `,
                    [reviewId]
                );

                return res.json({
                    success: true,
                    reviewId,
                    liked,
                    likeCount: Number(countResult.rows[0]?.like_count || 0)
                });
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }

        function createVenueReviewReply(req, res) {
            uploadVenueReview.array('images', 6)(req, res, async (uploadErr) => {
                if (uploadErr) {
                    return res.status(400).json({ message: uploadErr.message || 'Upload failed' });
                }

                const uploadedFiles = Array.isArray(req.files) ? req.files : [];
                const cleanupUploadedFiles = () => {
                    uploadedFiles.forEach((file) => {
                        if (file?.filename) {
                            safeDeleteUploadedFile(`/uploads/reviews/${file.filename}`);
                        }
                    });
                };

                const venueId = normalizeNullableNumber(req.params.venueId);
                const reviewId = normalizeNullableNumber(req.params.reviewId);
                const userId = String(req.user?.id || '').trim();
                const content = String(req.body?.content || '').trim();
                const title = String(req.body?.title || '').trim();
                const rawRating = String(req.body?.rating || '').trim();
                let rating = null;

                if (Number.isNaN(venueId) || venueId === null || Number.isNaN(reviewId) || reviewId === null) {
                    cleanupUploadedFiles();
                    return res.status(400).json({ message: 'venueId/reviewId không hợp lệ.' });
                }

                if (!userId) {
                    cleanupUploadedFiles();
                    return res.status(401).json({ message: 'Bạn cần đăng nhập để thảo luận.' });
                }

                if (!content) {
                    cleanupUploadedFiles();
                    return res.status(400).json({ message: 'Nội dung thảo luận không được để trống.' });
                }

                if (rawRating) {
                    const parsedRating = Number(rawRating);
                    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
                        cleanupUploadedFiles();
                        return res.status(400).json({ message: 'Số sao phải từ 1 đến 5.' });
                    }

                    rating = parsedRating;
                }

                if (findBlockedReviewTerm(`${title} ${content}`)) {
                    cleanupUploadedFiles();
                    return res.status(400).json({ message: 'Nội dung thảo luận chứa từ ngữ không phù hợp.' });
                }

                try {
                    const reviewResult = await pool.query(
                        `
                            SELECT id
                            FROM venue_public_reviews
                            WHERE id = $1 AND venue_id = $2
                            LIMIT 1
                        `,
                        [reviewId, venueId]
                    );

                    if (!reviewResult.rows.length) {
                        cleanupUploadedFiles();
                        return res.status(404).json({ message: 'Không tìm thấy bình luận.' });
                    }

                    const userResult = await pool.query(
                        `
                            SELECT fullname, username
                            FROM users
                            WHERE id::text = $1
                            LIMIT 1
                        `,
                        [userId]
                    );

                    const authorName = userResult.rows[0]?.fullname || userResult.rows[0]?.username || req.authUser?.email || 'Người dùng';
                    const imageUrls = uploadedFiles.map((file) => `/uploads/reviews/${file.filename}`);

                    const insertResult = await pool.query(
                        `
                            INSERT INTO venue_review_replies (review_id, user_id, author_name, rating, title, content, image_urls, updated_at)
                            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
                            RETURNING id, review_id, user_id, author_name, rating, title, content, image_urls, created_at, updated_at
                        `,
                        [reviewId, userId, authorName, rating, title || null, content, JSON.stringify(imageUrls)]
                    );

                    const countResult = await pool.query(
                        `
                            SELECT COUNT(*)::int AS reply_count
                            FROM venue_review_replies
                            WHERE review_id = $1
                        `,
                        [reviewId]
                    );

                    const created = insertResult.rows[0];

                    return res.status(201).json({
                        success: true,
                        reply: {
                            id: created.id,
                            reviewId: created.review_id,
                            userId: created.user_id,
                            authorName: created.author_name,
                            rating: Number(created.rating || 0),
                            title: created.title || '',
                            content: created.content,
                            imageUrls: Array.isArray(created.image_urls) ? created.image_urls : [],
                            createdAt: created.created_at,
                            updatedAt: created.updated_at,
                            canDelete: true
                        },
                        replyCount: Number(countResult.rows[0]?.reply_count || 0)
                    });
                } catch (error) {
                    cleanupUploadedFiles();
                    return res.status(500).json({ message: error.message });
                }
            });
        }

        async function deleteVenueReview(req, res) {
            const venueId = normalizeNullableNumber(req.params.venueId);
            const reviewId = normalizeNullableNumber(req.params.reviewId);
            const userId = String(req.user?.id || '').trim();

            if (Number.isNaN(venueId) || venueId === null || Number.isNaN(reviewId) || reviewId === null) {
                return res.status(400).json({ message: 'venueId/reviewId không hợp lệ.' });
            }

            if (!userId) {
                return res.status(401).json({ message: 'Bạn cần đăng nhập để xóa bình luận.' });
            }

            try {
                const reviewResult = await pool.query(
                    `
                        SELECT id, user_id
                        FROM venue_public_reviews
                        WHERE id = $1 AND venue_id = $2
                        LIMIT 1
                    `,
                    [reviewId, venueId]
                );

                if (!reviewResult.rows.length) {
                    return res.status(404).json({ message: 'Không tìm thấy bình luận.' });
                }

                const ownerId = String(reviewResult.rows[0].user_id || '').trim();

                if (!ownerId || ownerId !== userId) {
                    return res.status(403).json({ message: 'Bạn chỉ có thể xóa bình luận của chính mình.' });
                }

                await pool.query(
                    `
                        DELETE FROM venue_public_reviews
                        WHERE id = $1 AND venue_id = $2
                    `,
                    [reviewId, venueId]
                );

                return res.json({ success: true, deletedReviewId: reviewId });
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }

        async function listPublicVenueReviews(req, res) {
            const venueId = Number(req.params.venueId);
            const sort = String(req.query.sort || 'newest').trim().toLowerCase();
            const limit = normalizePaginationValue(req.query.limit, 20, { min: 1, max: 100 });

            if (!Number.isFinite(venueId)) {
                return res.status(400).json({ message: 'Invalid venue id' });
            }

            const sortClauseByType = {
                newest: 'r.created_at DESC, r.id DESC',
                oldest: 'r.created_at ASC, r.id ASC',
                rating_high: 'r.rating DESC, r.created_at DESC',
                rating_low: 'r.rating ASC, r.created_at DESC'
            };

            const sortClause = sortClauseByType[sort] || sortClauseByType.newest;

            try {
                const venueResult = await pool.query(
                    `
                        SELECT id, status::text AS status
                        FROM venues
                        WHERE id = $1
                        LIMIT 1
                    `,
                    [venueId]
                );

                if (!venueResult.rows.length) {
                    return res.status(404).json({ message: 'Venue not found' });
                }

                if (String(venueResult.rows[0].status || '').toLowerCase() !== 'approved') {
                    return res.status(404).json({ message: 'Venue not found' });
                }

                const reviewResult = await pool.query(
                    `
                        SELECT
                            r.id,
                            r.rating,
                            r.comment,
                            r.author_profile_id,
                            r.created_at,
                            r.updated_at,
                            COALESCE(p.full_name, p.display_name, p.username, 'Anonymous') AS author_name
                        FROM reviews AS r
                        LEFT JOIN profiles AS p ON p.id = r.author_profile_id
                        WHERE r.venue_id = $1
                        ORDER BY ${sortClause}
                        LIMIT $2
                    `,
                    [venueId, limit]
                );

                return res.json({
                    items: reviewResult.rows,
                    total: reviewResult.rows.length,
                    sort,
                    limit
                });
            } catch (error) {
                if (['42P01', '42703', '42883'].includes(error?.code)) {
                    return res.json({
                        items: [],
                        total: 0,
                        sort,
                        limit
                    });
                }

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
                contactEmail,
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
            const normalizedContactEmail = normalizeNullableText(contactEmail ?? normalizedMetadata.contactEmail);
            const resolvedOwnerUserId = await getAuthenticatedChatUserId(req);

            if (!normalizedContactEmail || !isValidEmail(normalizedContactEmail)) {
                return res.status(400).json({ message: 'A valid contactEmail is required' });
            }

            const normalizedScheduleResult = normalizeWeeklyScheduleInput(normalizedMetadata.weeklySchedule, {
                fallbackStart: normalizeNullableText(normalizedMetadata.startTime),
                fallbackEnd: normalizeNullableText(normalizedMetadata.endTime)
            });

            if (normalizedScheduleResult.error) {
                return res.status(400).json({ message: normalizedScheduleResult.error });
            }

            normalizedMetadata.contactEmail = normalizedContactEmail;
            normalizedMetadata.weeklySchedule = normalizedScheduleResult.value;

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
                const venueHasOwnerUserColumn = await hasVenueOwnerUserColumn();
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

                const insertColumns = [
                    'name',
                    'title',
                    ...(venueHasOwnerUserColumn ? ['owner_user_id'] : []),
                    'submitted_by_user_id',
                    'address',
                    'description',
                    'phone',
                    'latitude',
                    'longitude',
                    'ward_id',
                    'category_id',
                    'cover_image_url',
                    'business_license_image_url',
                    'metadata',
                    'status',
                    'submitted_at',
                    'updated_at'
                ];
                const insertValues = [
                    normalizedName,
                    String(title || '').trim() || normalizedName,
                    ...(venueHasOwnerUserColumn
                        ? [resolvedOwnerUserId || null]
                        : []),
                    resolvedOwnerUserId || null,
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
                ];
                const insertPlaceholders = insertValues.map((_, index) => `$${index + 1}`);

                const insertResult = await pool.query(
                    `
                INSERT INTO venues (
                    ${insertColumns.join(',\n                    ')}
                )
                VALUES (
                    ${insertPlaceholders.join(',\n                    ')},
                    'pending',
                    now(),
                    now()
                )
                RETURNING id
            `,
                    insertValues
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
                SELECT id, name, slug, icon, description, sort_order, is_active, created_at, updated_at
                FROM place_categories
                ${includeInactive ? '' : 'WHERE is_active = true'}
                ORDER BY sort_order ASC, name ASC
            `
                );

                return res.json(result.rows);
            } catch (error) {
                if (isUndefinedColumnError(error)) {
                    try {
                        const fallbackResult = await pool.query(
                            `
                                SELECT id, name, slug, description, sort_order, is_active, created_at, updated_at
                                FROM place_categories
                                ${includeInactive ? '' : 'WHERE is_active = true'}
                                ORDER BY sort_order ASC, name ASC
                            `
                        );

                        return res.json(
                            fallbackResult.rows.map((row) => ({
                                ...row,
                                icon: '📍'
                            }))
                        );
                    } catch (fallbackError) {
                        return res.status(500).json({ message: fallbackError.message });
                    }
                }

                return res.status(500).json({ message: error.message });
            }
        }

        async function listAdminPlaceCategories(req, res) {
            try {
                const result = await pool.query(
                    `
                SELECT id, name, slug, icon, description, sort_order, is_active, created_at, updated_at
                FROM place_categories
                ORDER BY sort_order ASC, name ASC
            `
                );

                return res.json(result.rows);
            } catch (error) {
                if (isUndefinedColumnError(error)) {
                    try {
                        const fallbackResult = await pool.query(
                            `
                                SELECT id, name, slug, description, sort_order, is_active, created_at, updated_at
                                FROM place_categories
                                ORDER BY sort_order ASC, name ASC
                            `
                        );

                        return res.json(
                            fallbackResult.rows.map((row) => ({
                                ...row,
                                icon: '📍'
                            }))
                        );
                    } catch (fallbackError) {
                        return res.status(500).json({ message: fallbackError.message });
                    }
                }

                return res.status(500).json({ message: error.message });
            }
        }

        async function createAdminPlaceCategory(req, res) {
            const name = String(req.body.name || '').trim();
            const iconResult = normalizePlaceCategoryIcon(req.body.icon, { required: true });
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

            if (iconResult.error) {
                return res.status(400).json({ message: iconResult.error });
            }

            try {
                const result = await pool.query(
                    `
                INSERT INTO place_categories (name, slug, icon, description, sort_order, is_active, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, now())
                RETURNING id, name, slug, icon, description, sort_order, is_active, created_at, updated_at
            `,
                    [name, slug, iconResult.value, description, sortOrder, isActive]
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
                SELECT id, name, slug, icon, description, sort_order, is_active
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
                const hasIcon = Object.prototype.hasOwnProperty.call(req.body, 'icon');
                const hasDescription = Object.prototype.hasOwnProperty.call(req.body, 'description');
                const hasSortOrder = Object.prototype.hasOwnProperty.call(req.body, 'sortOrder');
                const hasIsActive = Object.prototype.hasOwnProperty.call(req.body, 'isActive');

                const nextName = hasName ? String(req.body.name || '').trim() : existing.name;
                const nextDescription = hasDescription
                    ? String(req.body.description || '').trim() || null
                    : existing.description;
                const nextIcon = hasIcon
                    ? normalizePlaceCategoryIcon(req.body.icon, { required: true })
                    : { value: existing.icon || null, error: null };
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

                if (nextIcon.error) {
                    return res.status(400).json({ message: nextIcon.error });
                }

                const updateResult = await pool.query(
                    `
                UPDATE place_categories
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
                    [categoryId, nextName, nextSlug, nextIcon.value, nextDescription, nextSortOrder, nextIsActive]
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
                if (isUndefinedTableError(error)) {
                    return res.json([]);
                }

                if (isUndefinedColumnError(error)) {
                    try {
                        const fallbackResult = await pool.query(
                            `
                                SELECT id, name, slug, description, sort_order, is_active, created_at, updated_at
                                FROM merchant_services
                                ${includeInactive ? '' : 'WHERE is_active = true'}
                                ORDER BY sort_order ASC, name ASC
                            `
                        );

                        return res.json(
                            fallbackResult.rows.map((row) => ({
                                ...row,
                                icon: null
                            }))
                        );
                    } catch (fallbackError) {
                        return res.status(500).json({ message: fallbackError.message });
                    }
                }

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
                if (isUndefinedTableError(error)) {
                    return res.json([]);
                }

                if (isUndefinedColumnError(error)) {
                    try {
                        const fallbackResult = await pool.query(
                            `
                                SELECT id, name, slug, description, sort_order, is_active, created_at, updated_at
                                FROM merchant_services
                                ORDER BY sort_order ASC, name ASC
                            `
                        );

                        return res.json(
                            fallbackResult.rows.map((row) => ({
                                ...row,
                                icon: null
                            }))
                        );
                    } catch (fallbackError) {
                        return res.status(500).json({ message: fallbackError.message });
                    }
                }

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
                const wardColumnsResult = await pool.query(
                    `
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = 'wards'
                    `
                );

                const wardColumns = new Set(wardColumnsResult.rows.map((row) => row.column_name));

                if (!wardColumns.size) {
                    return res.json([]);
                }

                const hasWardColumn = (columnName) => wardColumns.has(columnName);
                const wardColumnOrNull = (columnName, alias = columnName) =>
                    hasWardColumn(columnName) ? `${columnName} AS ${alias}` : `NULL AS ${alias}`;

                const result = await pool.query(
                    `
                SELECT
                    ${wardColumnOrNull('ward_id')},
                    ${wardColumnOrNull('name')},
                    ${wardColumnOrNull('boundary')},
                    ${wardColumnOrNull('description')},
                    ${hasWardColumn('is_active') ? 'is_active' : 'true AS is_active'},
                    ${wardColumnOrNull('created_at')},
                    ${wardColumnOrNull('updated_at')}
                FROM wards
                ORDER BY ${hasWardColumn('name') ? 'name' : 'ward_id'} ASC
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
            const summaryMode = ['1', 'true', 'yes'].includes(String(req.query.summary || '').trim().toLowerCase());
            const wardId = String(req.query.wardId || '').trim();
            const categoryId = normalizeCategoryId(req.query.categoryId);

            if (Number.isNaN(categoryId)) {
                return res.status(400).json({ message: 'categoryId must be a positive integer' });
            }

            try {
                const [venueColumnsResult, wardColumnsResult, placeCategoryColumnsResult] = await Promise.all([
                    pool.query(
                        `
                            SELECT column_name
                            FROM information_schema.columns
                            WHERE table_schema = 'public' AND table_name = 'venues'
                        `
                    ),
                    pool.query(
                        `
                            SELECT column_name
                            FROM information_schema.columns
                            WHERE table_schema = 'public' AND table_name = 'wards'
                        `
                    ),
                    pool.query(
                        `
                            SELECT column_name
                            FROM information_schema.columns
                            WHERE table_schema = 'public' AND table_name = 'place_categories'
                        `
                    )
                ]);

                const venueColumns = new Set(venueColumnsResult.rows.map((row) => row.column_name));
                const wardColumns = new Set(wardColumnsResult.rows.map((row) => row.column_name));
                const placeCategoryColumns = new Set(placeCategoryColumnsResult.rows.map((row) => row.column_name));

                if (!venueColumns.size) {
                    return res.json([]);
                }

                const hasVenueColumn = (columnName) => venueColumns.has(columnName);
                const hasWardColumn = (columnName) => wardColumns.has(columnName);
                const hasPlaceCategoryColumn = (columnName) => placeCategoryColumns.has(columnName);

                const values = [];
                const whereConditions = [];

                if (statusFilter.length && hasVenueColumn('status')) {
                    values.push(statusFilter);
                    whereConditions.push(`venues.status::text = ANY($${values.length}::text[])`);
                }

                if (wardId && hasVenueColumn('ward_id')) {
                    values.push(wardId);
                    whereConditions.push(`venues.ward_id = $${values.length}`);
                }

                if (categoryId !== null && hasVenueColumn('category_id')) {
                    values.push(categoryId);
                    whereConditions.push(`venues.category_id = $${values.length}`);
                }

                const whereClause = whereConditions.length ? `WHERE ${whereConditions.join(' AND ')}` : '';
                const canJoinWards = hasVenueColumn('ward_id') && hasWardColumn('ward_id');
                const canJoinPlaceCategories = hasVenueColumn('category_id') && hasPlaceCategoryColumn('id');

                const venueColumnOrNull = (columnName, alias = columnName) =>
                    hasVenueColumn(columnName) ? `venues.${columnName} AS ${alias}` : `NULL AS ${alias}`;

                const statusColumn = hasVenueColumn('status')
                    ? 'venues.status::text AS status'
                    : `'pending'::text AS status`;
                const wardNameColumn = canJoinWards && hasWardColumn('name') ? 'wards.name AS ward_name' : 'NULL AS ward_name';
                const categoryNameColumn =
                    canJoinPlaceCategories && hasPlaceCategoryColumn('name')
                        ? 'place_categories.name AS category_name'
                        : 'NULL AS category_name';
                const categorySlugColumn =
                    canJoinPlaceCategories && hasPlaceCategoryColumn('slug')
                        ? 'place_categories.slug AS category_slug'
                        : 'NULL AS category_slug';
                const businessLicenseColumn = summaryMode
                    ? 'NULL::text AS business_license_image_url'
                    : venueColumnOrNull('business_license_image_url');
                const metadataColumn = summaryMode ? 'NULL::jsonb AS metadata' : venueColumnOrNull('metadata');

                const orderSubmittedAt = hasVenueColumn('submitted_at') ? 'venues.submitted_at' : 'NULL';
                const orderCreatedAt = hasVenueColumn('created_at') ? 'venues.created_at' : 'NULL';
                const orderId = hasVenueColumn('id') ? 'venues.id' : '0';

                const result = await pool.query(
                    `
                SELECT
                    ${venueColumnOrNull('id')},
                    ${venueColumnOrNull('name')},
                    ${venueColumnOrNull('title')},
                    ${venueColumnOrNull('address')},
                    ${venueColumnOrNull('description')},
                    ${venueColumnOrNull('phone')},
                    ${venueColumnOrNull('latitude')},
                    ${venueColumnOrNull('longitude')},
                    ${venueColumnOrNull('ward_id')},
                    ${wardNameColumn},
                    ${venueColumnOrNull('category_id')},
                    ${categoryNameColumn},
                    ${categorySlugColumn},
                    ${venueColumnOrNull('cover_image_url')},
                    ${businessLicenseColumn},
                    ${metadataColumn},
                    ${statusColumn},
                    ${venueColumnOrNull('submitted_at')},
                    ${venueColumnOrNull('approved_at')},
                    ${venueColumnOrNull('rejected_at')},
                    ${venueColumnOrNull('rejection_reason')},
                    ${venueColumnOrNull('created_at')},
                    ${venueColumnOrNull('updated_at')}
                FROM venues
                ${canJoinWards ? 'LEFT JOIN wards ON wards.ward_id = venues.ward_id' : ''}
                ${canJoinPlaceCategories ? 'LEFT JOIN place_categories ON place_categories.id = venues.category_id' : ''}
                ${whereClause}
                ORDER BY COALESCE(${orderSubmittedAt}, ${orderCreatedAt}) DESC, ${orderId} DESC
            `,
                    values
                );

                res.json(result.rows);
            } catch (error) {
                res.status(500).json({ message: error.message });
            }
        }

        async function listAdminVenueReviews(req, res) {
            const venueId = Number(req.params.venueId);
            const sort = String(req.query.sort || 'newest').trim().toLowerCase();

            if (!Number.isFinite(venueId)) {
                return res.status(400).json({ message: 'Invalid venue id' });
            }

            const sortClauseByType = {
                newest: 'r.created_at DESC, r.id DESC',
                oldest: 'r.created_at ASC, r.id ASC',
                rating_high: 'r.rating DESC, r.created_at DESC',
                rating_low: 'r.rating ASC, r.created_at DESC'
            };

            const sortClause = sortClauseByType[sort] || sortClauseByType.newest;

            try {
                const venueResult = await pool.query(
                    `
                        SELECT id
                        FROM venues
                        WHERE id = $1
                        LIMIT 1
                    `,
                    [venueId]
                );

                if (!venueResult.rows.length) {
                    return res.status(404).json({ message: 'Venue not found' });
                }

                const reviewResult = await pool.query(
                    `
                        SELECT
                            r.id,
                            r.rating,
                            r.comment,
                            r.author_profile_id,
                            r.created_at,
                            r.updated_at,
                            COALESCE(p.full_name, p.display_name, p.username, 'Anonymous') AS author_name
                        FROM reviews AS r
                        LEFT JOIN profiles AS p ON p.id = r.author_profile_id
                        WHERE r.venue_id = $1
                        ORDER BY ${sortClause}
                    `,
                    [venueId]
                );

                return res.json({
                    items: reviewResult.rows,
                    total: reviewResult.rows.length,
                    sort
                });
            } catch (error) {
                if (['42P01', '42703', '42883'].includes(error?.code)) {
                    return res.json({
                        items: [],
                        total: 0,
                        sort
                    });
                }

                return res.status(500).json({ message: error.message });
            }
        }

        async function getAdminVenueDetail(req, res) {
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

                return res.json(result.rows[0]);
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }

        function sendAdminVenueModerationMessage(req, res) {
            uploadVenueModerationMessage.array('attachments', 5)(req, res, async (uploadErr) => {
                if (uploadErr) {
                    return res.status(400).json({ message: uploadErr.message || 'Upload failed' });
                }

                const uploadedFiles = Array.isArray(req.files) ? req.files : [];

                function cleanupUploadedFiles() {
                    uploadedFiles.forEach((file) => {
                        if (file?.filename) {
                            safeDeleteUploadedFile(`/uploads/feedback/admin-replies/${file.filename}`);
                        }
                    });
                }

                const venueId = Number(req.params.venueId);
                const adminMessage = String(req.body.message || '').trim();

                if (!Number.isFinite(venueId)) {
                    cleanupUploadedFiles();

                    return res.status(400).json({ message: 'Invalid venue id' });
                }

                if (!adminMessage) {
                    cleanupUploadedFiles();

                    return res.status(400).json({ message: 'message is required' });
                }

                if (!feedbackReplyTransporter || !feedbackReplySmtpUser) {
                    cleanupUploadedFiles();

                    return res.status(500).json({
                        message:
                            'Gmail configuration is missing. Set FEEDBACK_GMAIL_USER and FEEDBACK_GMAIL_APP_PASSWORD in backend environment.'
                    });
                }

                try {
                    const venueResult = await pool.query(
                        `
                            SELECT
                                venues.id,
                                venues.name,
                                venues.title,
                                venues.address,
                                venues.phone,
                                venues.metadata,
                                wards.name AS ward_name,
                                place_categories.name AS category_name
                            FROM venues
                            LEFT JOIN wards ON wards.ward_id = venues.ward_id
                            LEFT JOIN place_categories ON place_categories.id = venues.category_id
                            WHERE venues.id = $1
                            LIMIT 1
                        `,
                        [venueId]
                    );

                    if (!venueResult.rows.length) {
                        cleanupUploadedFiles();

                        return res.status(404).json({ message: 'Venue not found' });
                    }

                    const venue = venueResult.rows[0];
                    const venueMetadata =
                        venue.metadata && typeof venue.metadata === 'object' && !Array.isArray(venue.metadata)
                            ? venue.metadata
                            : {};
                    const recipientEmail = normalizeNullableText(venueMetadata.contactEmail || venueMetadata.email);

                    if (!isValidEmail(recipientEmail)) {
                        cleanupUploadedFiles();

                        return res.status(400).json({
                            message: 'Venue submission does not contain a valid contact email.'
                        });
                    }

                    const venueName = String(venue.title || venue.name || '').trim() || `Venue #${venue.id}`;
                    const reviewerLabel = req.authUser?.email || req.authUser?.id || 'Admin Team';
                    const mailFrom = `${feedbackReplyFromName} <${feedbackReplyFromEmail || feedbackReplySmtpUser}>`;
                    const attachmentNotice = uploadedFiles.length
                        ? 'Image attachments from admin are included in this email.'
                        : '';

                    const plainTextBody = [
                        'Smart City Discovery - Venue Moderation Note',
                        '',
                        `Venue: ${venueName}`,
                        `Venue ID: ${venue.id}`,
                        `Address: ${venue.address || 'Not provided'}`,
                        `Ward: ${venue.ward_name || 'Not provided'}`,
                        `Category: ${venue.category_name || 'Not provided'}`,
                        `Phone: ${venue.phone || 'Not provided'}`,
                        '',
                        'Admin Message:',
                        adminMessage,
                        '',
                        `Handled by: ${reviewerLabel}`,
                        attachmentNotice,
                        '',
                        'Best regards,',
                        'Smart City Discovery Admin'
                    ]
                        .filter(Boolean)
                        .join('\n');

                    const htmlBody = `
                        <div style="margin:0;padding:0;background:#f5f7fb;font-family:Segoe UI,Arial,sans-serif;color:#1f2937;">
                            <div style="max-width:680px;margin:0 auto;padding:24px 16px;">
                                <div style="background:#ffffff;border:1px solid #e4e8f1;border-radius:14px;overflow:hidden;box-shadow:0 10px 28px rgba(23,33,79,0.08);">
                                    <div style="padding:18px 22px;background:linear-gradient(135deg,#0f766e,#0f5f88);color:#ffffff;">
                                        <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.88;">Smart City Discovery Admin</p>
                                        <h2 style="margin:8px 0 0;font-size:22px;line-height:1.3;">Venue Report Feedback</h2>
                                    </div>
                                    <div style="padding:20px 22px 24px;">
                                        <p style="margin:0 0 14px;font-size:14px;color:#334155;">Hello merchant,</p>
                                        <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#334155;">Our admin team reviewed your venue submission. Please read the note below.</p>

                                        <div style="margin:0 0 18px;padding:14px;border:1px solid #e4e8f1;border-radius:10px;background:#f8faff;">
                                            <p style="margin:0 0 8px;font-size:13px;color:#475569;"><strong>Venue:</strong> ${escapeHtml(venueName)}</p>
                                            <p style="margin:0 0 8px;font-size:13px;color:#475569;"><strong>Venue ID:</strong> #${venue.id}</p>
                                            <p style="margin:0 0 8px;font-size:13px;color:#475569;"><strong>Address:</strong> ${escapeHtml(venue.address || 'Not provided')}</p>
                                            <p style="margin:0 0 8px;font-size:13px;color:#475569;"><strong>Ward:</strong> ${escapeHtml(venue.ward_name || 'Not provided')}</p>
                                            <p style="margin:0 0 8px;font-size:13px;color:#475569;"><strong>Category:</strong> ${escapeHtml(venue.category_name || 'Not provided')}</p>
                                            <p style="margin:0;font-size:13px;color:#475569;"><strong>Phone:</strong> ${escapeHtml(venue.phone || 'Not provided')}</p>
                                        </div>

                                        <h3 style="margin:0 0 8px;font-size:15px;color:#1e293b;">Admin message</h3>
                                        <div style="margin:0 0 10px;padding:12px;border-radius:10px;background:#eff6ff;border:1px solid #dbeafe;font-size:14px;line-height:1.65;color:#1e3a8a;">${formatMultilineHtml(adminMessage)}</div>
                                        <p style="margin:0 0 18px;font-size:12px;color:#64748b;"><strong>Handled by:</strong> ${escapeHtml(reviewerLabel)}</p>

                                        ${uploadedFiles.length ? '<p style="margin:0 0 18px;font-size:13px;color:#0f766e;">Image attachments from admin are included in this email.</p>' : ''}

                                        <p style="margin:0;font-size:13px;color:#64748b;">Best regards,<br /><strong>Smart City Discovery Admin</strong></p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;

                    const mailResult = await feedbackReplyTransporter.sendMail({
                        from: mailFrom,
                        to: recipientEmail,
                        subject: 'Venue Report Feedback',
                        text: plainTextBody,
                        html: htmlBody,
                        attachments: uploadedFiles.map((file) => ({
                            filename: file.originalname,
                            path: file.path,
                            contentType: file.mimetype
                        }))
                    });

                    cleanupUploadedFiles();

                    return res.json({
                        message: 'Moderation message sent successfully',
                        deliveredTo: recipientEmail,
                        messageId: mailResult?.messageId || null
                    });
                } catch (error) {
                    cleanupUploadedFiles();

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

        async function moderateVenueSubmission(req, res) {
            const venueId = Number(req.params.venueId);
            const action = String(req.body.action || '').trim().toLowerCase();
            const rejectionReason = String(req.body.rejectionReason || '').trim();

            if (!Number.isFinite(venueId)) {
                return res.status(400).json({ message: 'Invalid venue id' });
            }

            if (!['approve', 'reject'].includes(action)) {
                return res.status(400).json({ message: 'action must be approve or reject' });
            }

            const reviewer = req.authUser?.email || req.authUser?.id || 'admin';

            try {
                if (action === 'reject') {
                    const venueResult = await pool.query(
                        `
                            SELECT
                                venues.id,
                                venues.name,
                                venues.title,
                                venues.address,
                                venues.phone,
                                venues.metadata,
                                wards.name AS ward_name,
                                place_categories.name AS category_name
                            FROM venues
                            LEFT JOIN wards ON wards.ward_id = venues.ward_id
                            LEFT JOIN place_categories ON place_categories.id = venues.category_id
                            WHERE venues.id = $1
                            LIMIT 1
                        `,
                        [venueId]
                    );

                    if (!venueResult.rows.length) {
                        return res.status(404).json({ message: 'Venue submission not found' });
                    }

                    const rejectedVenue = venueResult.rows[0];
                    const venueMetadata =
                        rejectedVenue.metadata && typeof rejectedVenue.metadata === 'object' && !Array.isArray(rejectedVenue.metadata)
                            ? rejectedVenue.metadata
                            : {};

                    const recipientEmail = normalizeNullableText(venueMetadata.contactEmail || venueMetadata.email);

                    if (rejectionReason && isValidEmail(recipientEmail) && feedbackReplyTransporter && feedbackReplySmtpUser) {
                        const venueName = String(rejectedVenue.title || rejectedVenue.name || '').trim() || `Venue #${rejectedVenue.id}`;
                        const mailFrom = `${feedbackReplyFromName} <${feedbackReplyFromEmail || feedbackReplySmtpUser}>`;

                        const plainTextBody = [
                            'Smart City Discovery - Venue Submission Rejected',
                            '',
                            `Venue: ${venueName}`,
                            `Venue ID: ${rejectedVenue.id}`,
                            `Address: ${rejectedVenue.address || 'Not provided'}`,
                            `Ward: ${rejectedVenue.ward_name || 'Not provided'}`,
                            `Category: ${rejectedVenue.category_name || 'Not provided'}`,
                            `Phone: ${rejectedVenue.phone || 'Not provided'}`,
                            '',
                            'Rejection Reason:',
                            rejectionReason,
                            '',
                            `Reviewed by: ${reviewer}`,
                            '',
                            'You can revise your submission and submit again later.',
                            '',
                            'Best regards,',
                            'Smart City Discovery Admin'
                        ].join('\n');

                        const htmlBody = `
                            <div style="margin:0;padding:0;background:#f5f7fb;font-family:Segoe UI,Arial,sans-serif;color:#1f2937;">
                                <div style="max-width:680px;margin:0 auto;padding:24px 16px;">
                                    <div style="background:#ffffff;border:1px solid #e4e8f1;border-radius:14px;overflow:hidden;box-shadow:0 10px 28px rgba(23,33,79,0.08);">
                                        <div style="padding:18px 22px;background:linear-gradient(135deg,#b91c1c,#dc2626);color:#ffffff;">
                                            <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.88;">Smart City Discovery Admin</p>
                                            <h2 style="margin:8px 0 0;font-size:22px;line-height:1.3;">Venue Submission Rejected</h2>
                                        </div>
                                        <div style="padding:20px 22px 24px;">
                                            <p style="margin:0 0 14px;font-size:14px;color:#334155;">Hello merchant,</p>
                                            <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#334155;">Your venue submission has been rejected after admin review.</p>

                                            <div style="margin:0 0 18px;padding:14px;border:1px solid #e4e8f1;border-radius:10px;background:#f8faff;">
                                                <p style="margin:0 0 8px;font-size:13px;color:#475569;"><strong>Venue:</strong> ${escapeHtml(venueName)}</p>
                                                <p style="margin:0 0 8px;font-size:13px;color:#475569;"><strong>Venue ID:</strong> #${rejectedVenue.id}</p>
                                                <p style="margin:0 0 8px;font-size:13px;color:#475569;"><strong>Address:</strong> ${escapeHtml(rejectedVenue.address || 'Not provided')}</p>
                                                <p style="margin:0 0 8px;font-size:13px;color:#475569;"><strong>Ward:</strong> ${escapeHtml(rejectedVenue.ward_name || 'Not provided')}</p>
                                                <p style="margin:0 0 8px;font-size:13px;color:#475569;"><strong>Category:</strong> ${escapeHtml(rejectedVenue.category_name || 'Not provided')}</p>
                                                <p style="margin:0;font-size:13px;color:#475569;"><strong>Phone:</strong> ${escapeHtml(rejectedVenue.phone || 'Not provided')}</p>
                                            </div>

                                            <h3 style="margin:0 0 8px;font-size:15px;color:#1e293b;">Rejection Reason</h3>
                                            <div style="margin:0 0 10px;padding:12px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;font-size:14px;line-height:1.65;color:#991b1b;">${formatMultilineHtml(rejectionReason)}</div>
                                            <p style="margin:0 0 18px;font-size:12px;color:#64748b;"><strong>Reviewed by:</strong> ${escapeHtml(reviewer)}</p>

                                            <p style="margin:0;font-size:13px;color:#64748b;">You can revise your venue information and submit again later.<br /><br />Best regards,<br /><strong>Smart City Discovery Admin</strong></p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;

                        await feedbackReplyTransporter.sendMail({
                            from: mailFrom,
                            to: recipientEmail,
                            subject: 'Venue Submission Rejected',
                            text: plainTextBody,
                            html: htmlBody
                        });
                    }

                    const deleteResult = await pool.query(
                        `
                          DELETE FROM venues
                          WHERE id = $1
                          RETURNING id
                      `,
                        [venueId]
                    );

                    if (!deleteResult.rows.length) {
                        return res.status(404).json({ message: 'Venue submission not found' });
                    }

                    return res.json({
                        message: 'Venue rejected and removed successfully',
                        deletedVenueId: deleteResult.rows[0].id
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

        async function getAuthenticatedChatUserId(req) {
            const rawUserId = req.authUser?.id ?? req.user?.id ?? null;
            const normalizedUserId = rawUserId === null || rawUserId === undefined ? '' : String(rawUserId).trim();

            if (normalizedUserId) {
                return normalizedUserId;
            }

            const authEmail = String(req.authUser?.email || req.user?.email || '').trim().toLowerCase();
            if (!authEmail) {
                return null;
            }

            try {
                const userResult = await pool.query(
                    `
                        SELECT id
                        FROM users
                        WHERE LOWER(email) = $1
                        LIMIT 1
                    `,
                    [authEmail]
                );

                const fallbackUserId = String(userResult.rows[0]?.id || '').trim();
                return fallbackUserId || null;
            } catch {
                return null;
            }
        }

        async function getVenueChatOwnerContext(venueId) {
            const venueHasOwnerUserColumn = await hasVenueOwnerUserColumn();
            const resolvedOwnerUserSql = buildResolvedVenueOwnerUserSql('venues');
            const ownerSelect = venueHasOwnerUserColumn
                ? `
                        ${resolvedOwnerUserSql} AS owner_user_id,
                        owner_users.fullname AS owner_name,
                    `
                : `
                        NULL::uuid AS owner_user_id,
                        NULL::text AS owner_name,
                    `;
            const ownerJoin = venueHasOwnerUserColumn
                ? `LEFT JOIN users AS owner_users ON owner_users.id = ${resolvedOwnerUserSql}`
                : '';
            const result = await pool.query(
                `
                    SELECT
                        venues.id,
                        venues.name,
                        venues.title,
                        venues.address,
                        venues.cover_image_url,
                        venues.phone,
                        venues.metadata,
                        ${ownerSelect}
                        wards.name AS ward_name
                    FROM venues
                    ${ownerJoin}
                    LEFT JOIN wards ON wards.ward_id = venues.ward_id
                    WHERE venues.id = $1
                    LIMIT 1
                `,
                [venueId]
            );

            return result.rows[0] || null;
        }

        async function listOwnerChatVenues(ownerUserId) {
            const normalizedOwnerUserId = String(ownerUserId || '').trim();
            if (!normalizedOwnerUserId) {
                return [];
            }

            const result = await pool.query(
                `
                    SELECT
                        venues.id,
                        venues.name,
                        venues.title,
                        venues.address,
                        venues.cover_image_url,
                        wards.name AS ward_name
                    FROM venues
                    LEFT JOIN wards ON wards.ward_id = venues.ward_id
                    WHERE ${buildResolvedVenueOwnerUserSql('venues')} = $1
                    ORDER BY LOWER(COALESCE(venues.name, venues.title, '')) ASC, venues.id ASC
                `,
                [normalizedOwnerUserId]
            );

            return result.rows.map((row) => ({
                id: row.id,
                name: row.name || row.title || 'Quán chưa đặt tên',
                address: row.address || '',
                coverImageUrl: row.cover_image_url || '',
                wardName: row.ward_name || ''
            }));
        }

        async function findOrCreateChatThread(ownerUserId, customerUserId) {
            const result = await pool.query(
                `
                    INSERT INTO chat_threads (owner_user_id, customer_user_id, created_at, updated_at)
                    VALUES ($1, $2, NOW(), NOW())
                    ON CONFLICT (owner_user_id, customer_user_id)
                    DO UPDATE SET updated_at = NOW()
                    RETURNING id, owner_user_id, customer_user_id, created_at, updated_at, last_message_at
                `,
                [ownerUserId, customerUserId]
            );

            return result.rows[0] || null;
        }

        async function buildChatThreadPayload(threadId, currentUserId) {
            const threadResult = await pool.query(
                `
                    SELECT
                        t.id,
                        t.owner_user_id,
                        t.customer_user_id,
                        t.created_at,
                        t.updated_at,
                        t.last_message_at,
                        owner_user.fullname AS owner_name,
                        owner_user.username AS owner_username,
                        customer_user.fullname AS customer_name,
                        customer_user.username AS customer_username,
                        COALESCE(unread.unread_count, 0)::int AS unread_count
                    FROM chat_threads AS t
                    JOIN users AS owner_user ON owner_user.id = t.owner_user_id
                    JOIN users AS customer_user ON customer_user.id = t.customer_user_id
                    LEFT JOIN LATERAL (
                        SELECT COUNT(*)::int AS unread_count
                        FROM chat_messages AS m
                        LEFT JOIN chat_thread_reads AS r
                          ON r.thread_id = t.id
                         AND r.user_id = $2
                        WHERE m.thread_id = t.id
                          AND m.recipient_user_id = $2
                          AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
                    ) AS unread ON TRUE
                    LEFT JOIN chat_thread_hidden AS hidden
                      ON hidden.thread_id = t.id
                     AND hidden.user_id = $2
                    WHERE t.id = $1
                      AND ($2 = t.owner_user_id OR $2 = t.customer_user_id)
                      AND (
                        hidden.hidden_at IS NULL
                        OR COALESCE(t.last_message_at, t.updated_at, t.created_at) > hidden.hidden_at
                      )
                    LIMIT 1
                `,
                [threadId, currentUserId]
            );

            if (!threadResult.rows.length) {
                return null;
            }

            const thread = threadResult.rows[0];
            const messagesResult = await pool.query(
                `
                    SELECT
                        m.id,
                        m.thread_id,
                        m.sender_user_id,
                        m.recipient_user_id,
                        m.venue_id,
                        m.context_label,
                        m.content,
                        m.created_at,
                        m.updated_at,
                        sender_user.fullname AS sender_name,
                        recipient_user.fullname AS recipient_name,
                        venues.name AS venue_name,
                        venues.title AS venue_title,
                        venues.address AS venue_address,
                        venues.cover_image_url AS venue_image,
                        wards.name AS venue_ward_name
                    FROM chat_messages AS m
                    JOIN users AS sender_user ON sender_user.id = m.sender_user_id
                    JOIN users AS recipient_user ON recipient_user.id = m.recipient_user_id
                    LEFT JOIN venues ON venues.id = m.venue_id
                    LEFT JOIN wards ON wards.ward_id = venues.ward_id
                    WHERE m.thread_id = $1
                    ORDER BY m.created_at ASC, m.id ASC
                `,
                [threadId]
            );

            return {
                id: thread.id,
                ownerUserId: thread.owner_user_id,
                customerUserId: thread.customer_user_id,
                ownerName: thread.owner_name || thread.owner_username || 'Chủ quán',
                customerName: thread.customer_name || thread.customer_username || 'Khách hàng',
                unreadCount: Number(thread.unread_count || 0),
                lastMessageAt: thread.last_message_at || null,
                createdAt: thread.created_at,
                updatedAt: thread.updated_at,
                messages: messagesResult.rows.map((message) => ({
                    id: message.id,
                    threadId: message.thread_id,
                    senderUserId: message.sender_user_id,
                    recipientUserId: message.recipient_user_id,
                    venueId: message.venue_id,
                    contextLabel: message.context_label || '',
                    senderName: message.sender_name || 'Người dùng',
                    recipientName: message.recipient_name || 'Người dùng',
                    content: message.content || '',
                    createdAt: message.created_at,
                    updatedAt: message.updated_at,
                    venueName: message.venue_name || message.venue_title || '',
                    venueAddress: message.venue_address || '',
                    venueImage: message.venue_image || '',
                    venueWardName: message.venue_ward_name || ''
                }))
            };
        }

        async function listChatThreads(req, res) {
            const currentUserId = await getAuthenticatedChatUserId(req);

            if (!currentUserId) {
                return res.status(401).json({ message: 'Bạn cần đăng nhập để xem tin nhắn.' });
            }

            const limit = Math.min(20, Math.max(1, Number(req.query.limit || 10)));

            try {
                const result = await pool.query(
                    `
                        SELECT
                            t.id,
                            t.owner_user_id,
                            t.customer_user_id,
                            t.created_at,
                            t.updated_at,
                            t.last_message_at,
                            owner_user.fullname AS owner_name,
                            owner_user.username AS owner_username,
                            customer_user.fullname AS customer_name,
                            customer_user.username AS customer_username,
                            latest_message.id AS last_message_id,
                            latest_message.content AS last_message_content,
                            latest_message.created_at AS last_message_created_at,
                            latest_message.venue_id AS last_message_venue_id,
                            venues.name AS venue_name,
                            venues.title AS venue_title,
                            venues.address AS venue_address,
                            venues.cover_image_url AS venue_image,
                            wards.name AS venue_ward_name,
                            fallback_venue.id AS fallback_venue_id,
                            fallback_venue.name AS fallback_venue_name,
                            fallback_venue.title AS fallback_venue_title,
                            fallback_venue.address AS fallback_venue_address,
                            fallback_venue.cover_image_url AS fallback_venue_image,
                            fallback_venue.ward_name AS fallback_venue_ward_name,
                            COALESCE(unread.unread_count, 0)::int AS unread_count
                        FROM chat_threads AS t
                        JOIN users AS owner_user ON owner_user.id = t.owner_user_id
                        JOIN users AS customer_user ON customer_user.id = t.customer_user_id
                        LEFT JOIN LATERAL (
                            SELECT m.id, m.content, m.created_at, m.venue_id
                            FROM chat_messages AS m
                            WHERE m.thread_id = t.id
                            ORDER BY m.created_at DESC, m.id DESC
                            LIMIT 1
                        ) AS latest_message ON TRUE
                        LEFT JOIN venues ON venues.id = latest_message.venue_id
                        LEFT JOIN wards ON wards.ward_id = venues.ward_id
                        LEFT JOIN LATERAL (
                            SELECT
                                owner_venues.id,
                                owner_venues.name,
                                owner_venues.title,
                                owner_venues.address,
                                owner_venues.cover_image_url,
                                owner_wards.name AS ward_name
                            FROM venues AS owner_venues
                            LEFT JOIN wards AS owner_wards ON owner_wards.ward_id = owner_venues.ward_id
                            WHERE ${buildResolvedVenueOwnerUserSql('owner_venues')} = t.owner_user_id
                            ORDER BY owner_venues.id ASC
                            LIMIT 1
                        ) AS fallback_venue ON TRUE
                        LEFT JOIN chat_thread_hidden AS hidden
                          ON hidden.thread_id = t.id
                         AND hidden.user_id = $1
                        LEFT JOIN LATERAL (
                            SELECT COUNT(*)::int AS unread_count
                            FROM chat_messages AS m
                            LEFT JOIN chat_thread_reads AS r
                              ON r.thread_id = t.id
                             AND r.user_id = $1
                            WHERE m.thread_id = t.id
                              AND m.recipient_user_id = $1
                              AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
                        ) AS unread ON TRUE
                        WHERE t.owner_user_id = $1 OR t.customer_user_id = $1
                          AND (
                            hidden.hidden_at IS NULL
                            OR COALESCE(latest_message.created_at, t.last_message_at, t.updated_at, t.created_at) > hidden.hidden_at
                          )
                        ORDER BY COALESCE(t.last_message_at, t.updated_at, t.created_at) DESC
                        LIMIT $2
                    `,
                    [currentUserId, limit]
                );

                return res.json({
                    threads: result.rows.map((row) => ({
                        id: row.id,
                        ownerUserId: row.owner_user_id,
                        customerUserId: row.customer_user_id,
                        ownerName: row.owner_name || row.owner_username || 'Chủ quán',
                        customerName: row.customer_name || row.customer_username || 'Khách hàng',
                        counterpartName:
                            currentUserId === String(row.owner_user_id || '')
                                ? row.customer_name || row.customer_username || 'Khách hàng'
                                : row.owner_name || row.owner_username || 'Chủ quán',
                        unreadCount: Number(row.unread_count || 0),
                        lastMessage: row.last_message_id
                            ? {
                                  id: row.last_message_id,
                                  content: row.last_message_content || '',
                                  createdAt: row.last_message_created_at,
                                  venueId: row.last_message_venue_id
                              }
                            : null,
                        venueId: row.last_message_venue_id || row.fallback_venue_id || null,
                        venueName: row.venue_name || row.venue_title || row.fallback_venue_name || row.fallback_venue_title || '',
                        venueAddress: row.venue_address || row.fallback_venue_address || '',
                        venueImage: row.venue_image || row.fallback_venue_image || '',
                        venueWardName: row.venue_ward_name || row.fallback_venue_ward_name || ''
                    }))
                });
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }

        async function getVenueChatThread(req, res) {
            const currentUserId = await getAuthenticatedChatUserId(req);
            const venueId = Number(req.params.venueId);
            const selectedThreadId = Number(req.query.threadId || '');

            if (!currentUserId) {
                return res.status(401).json({ message: 'Bạn cần đăng nhập để xem tin nhắn.' });
            }

            if (!Number.isFinite(venueId)) {
                return res.status(400).json({ message: 'Invalid venue id' });
            }

            try {
                const venue = await getVenueChatOwnerContext(venueId);

                if (!venue) {
                    return res.status(404).json({ message: 'Venue not found' });
                }

                let threadId = null;
                const ownerUserId = String(venue.owner_user_id || '').trim();

                if (ownerUserId && currentUserId === ownerUserId && Number.isFinite(selectedThreadId) && selectedThreadId > 0) {
                    threadId = selectedThreadId;
                } else if (ownerUserId && currentUserId !== ownerUserId) {
                    const existingThreadResult = await pool.query(
                        `
                            SELECT id
                            FROM chat_threads
                            WHERE owner_user_id = $1
                              AND customer_user_id = $2
                            LIMIT 1
                        `,
                        [ownerUserId, currentUserId]
                    );

                    threadId = existingThreadResult.rows[0]?.id || null;
                }

                const thread = threadId ? await buildChatThreadPayload(threadId, currentUserId) : null;
                const contextOptions = ownerUserId ? await listOwnerChatVenues(ownerUserId) : [];

                return res.json({
                    venueContext: {
                        id: venue.id,
                        ownerUserId: venue.owner_user_id,
                        ownerName: venue.owner_name || 'Chủ quán',
                        name: venue.name || venue.title || 'Quán chưa đặt tên',
                        address: venue.address || '',
                        coverImageUrl: venue.cover_image_url || '',
                        wardName: venue.ward_name || '',
                        phone: venue.phone || '',
                        metadata: venue.metadata || {}
                    },
                    contextOptions,
                    thread
                });
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }

        async function sendVenueChatMessage(req, res) {
            const currentUserId = await getAuthenticatedChatUserId(req);
            const venueId = Number(req.params.venueId);
            const threadId = Number(req.body.threadId || '');
            const content = String(req.body.content || '').trim();
            const requestedContextVenueId = Number(req.body.contextVenueId || '');
            const requestedContextLabel = String(req.body.contextLabel || '').trim();

            if (!currentUserId) {
                return res.status(401).json({ message: 'Bạn cần đăng nhập để nhắn tin.' });
            }

            if (!Number.isFinite(venueId)) {
                return res.status(400).json({ message: 'Invalid venue id' });
            }

            if (!content) {
                return res.status(400).json({ message: 'Nội dung tin nhắn không được để trống.' });
            }

            try {
                const venue = await getVenueChatOwnerContext(venueId);

                if (!venue) {
                    return res.status(404).json({ message: 'Venue not found' });
                }

                const ownerUserId = String(venue.owner_user_id || '').trim();

                if (!ownerUserId) {
                    return res.status(400).json({ message: 'Quán này chưa được gắn chủ sở hữu để sử dụng chat.' });
                }

                let resolvedThreadId = null;
                let recipientUserId = null;

                if (currentUserId === ownerUserId) {
                    if (!Number.isFinite(threadId) || threadId <= 0) {
                        return res.status(400).json({ message: 'Chủ quán cần chọn đúng cuộc trò chuyện để trả lời.' });
                    }

                    const threadResult = await pool.query(
                        `
                            SELECT id, customer_user_id
                            FROM chat_threads
                            WHERE id = $1
                              AND owner_user_id = $2
                            LIMIT 1
                        `,
                        [threadId, currentUserId]
                    );

                    if (!threadResult.rows.length) {
                        return res.status(404).json({ message: 'Không tìm thấy cuộc trò chuyện.' });
                    }

                    resolvedThreadId = threadResult.rows[0].id;
                    recipientUserId = String(threadResult.rows[0].customer_user_id || '').trim();
                } else {
                    const thread = await findOrCreateChatThread(ownerUserId, currentUserId);
                    resolvedThreadId = thread?.id || null;
                    recipientUserId = ownerUserId;
                }

                if (!resolvedThreadId || !recipientUserId) {
                    return res.status(400).json({ message: 'Không thể xác định người nhận tin nhắn.' });
                }

                const customerUserId = currentUserId === ownerUserId ? recipientUserId : currentUserId;
                let messageVenueId = venueId;
                let messageContextLabel = venue.name || venue.title || '';

                if (requestedContextLabel.toLowerCase() === 'other') {
                    messageVenueId = null;
                    messageContextLabel = 'Other';
                } else if (Number.isFinite(requestedContextVenueId) && requestedContextVenueId > 0) {
                    const selectedVenueContext = await getVenueChatOwnerContext(requestedContextVenueId);
                    const selectedVenueOwnerUserId = String(selectedVenueContext?.owner_user_id || '').trim();

                    if (!selectedVenueContext || selectedVenueOwnerUserId !== ownerUserId) {
                        return res.status(400).json({ message: 'QuÃ¡n Ä‘Æ°á»£c chá»n khÃ´ng há»£p lá»‡ cho Ä‘oáº¡n chat nÃ y.' });
                    }

                    messageVenueId = requestedContextVenueId;
                    messageContextLabel = selectedVenueContext.name || selectedVenueContext.title || '';
                }

                const insertMessageResult = await pool.query(
                    `
                        INSERT INTO chat_messages (
                            thread_id,
                            sender_user_id,
                            recipient_user_id,
                            venue_id,
                            context_label,
                            content,
                            created_at,
                            updated_at
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                        RETURNING id, created_at
                    `,
                    [resolvedThreadId, currentUserId, recipientUserId, messageVenueId, messageContextLabel, content]
                );

                await pool.query(
                    `
                        DELETE FROM chat_thread_hidden
                        WHERE thread_id IN (
                            SELECT id
                            FROM chat_threads
                            WHERE owner_user_id = $1
                              AND customer_user_id = $2
                        )
                          AND user_id IN ($1, $2)
                    `,
                    [ownerUserId, customerUserId]
                );

                await pool.query(
                    `
                        UPDATE chat_threads
                        SET updated_at = NOW(),
                            last_message_at = $2
                        WHERE id = $1
                    `,
                    [resolvedThreadId, insertMessageResult.rows[0]?.created_at || new Date().toISOString()]
                );

                const threadPayload = await buildChatThreadPayload(resolvedThreadId, currentUserId);
                return res.status(201).json({
                    message: 'Chat message sent successfully',
                    thread: threadPayload
                });
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }

        async function markChatThreadRead(req, res) {
            const currentUserId = await getAuthenticatedChatUserId(req);
            const threadId = Number(req.params.threadId);

            if (!currentUserId) {
                return res.status(401).json({ message: 'Bạn cần đăng nhập để đọc tin nhắn.' });
            }

            if (!Number.isFinite(threadId)) {
                return res.status(400).json({ message: 'Invalid thread id' });
            }

            try {
                const participantCheck = await pool.query(
                    `
                        SELECT id, owner_user_id, customer_user_id
                        FROM chat_threads
                        WHERE id = $1
                          AND ($2 = owner_user_id OR $2 = customer_user_id)
                        LIMIT 1
                    `,
                    [threadId, currentUserId]
                );

                if (!participantCheck.rows.length) {
                    return res.status(404).json({ message: 'Không tìm thấy cuộc trò chuyện.' });
                }

                const ownerUserId = String(participantCheck.rows[0].owner_user_id || '').trim();
                const customerUserId = String(participantCheck.rows[0].customer_user_id || '').trim();

                const relatedThreadsResult = await pool.query(
                    `
                        SELECT id
                        FROM chat_threads
                        WHERE owner_user_id = $1
                          AND customer_user_id = $2
                        ORDER BY id ASC
                    `,
                    [ownerUserId, customerUserId]
                );

                const threadIds = relatedThreadsResult.rows.map((row) => Number(row.id)).filter((value) => Number.isFinite(value));

                if (threadIds.length) {
                    await pool.query(
                        `
                            WITH related_threads AS (
                                SELECT UNNEST($1::bigint[]) AS thread_id
                            ),
                            latest_messages AS (
                                SELECT
                                    rt.thread_id,
                                    latest_message.id AS last_read_message_id,
                                    COALESCE(latest_message.created_at, NOW()) AS last_read_at
                                FROM related_threads AS rt
                                LEFT JOIN LATERAL (
                                    SELECT m.id, m.created_at
                                    FROM chat_messages AS m
                                    WHERE m.thread_id = rt.thread_id
                                      AND m.recipient_user_id = $2
                                    ORDER BY m.created_at DESC, m.id DESC
                                    LIMIT 1
                                ) AS latest_message ON TRUE
                            )
                            INSERT INTO chat_thread_reads (thread_id, user_id, last_read_message_id, last_read_at, updated_at)
                            SELECT
                                latest_messages.thread_id,
                                $2,
                                latest_messages.last_read_message_id,
                                latest_messages.last_read_at,
                                NOW()
                            FROM latest_messages
                            ON CONFLICT (thread_id, user_id)
                            DO UPDATE
                            SET last_read_message_id = EXCLUDED.last_read_message_id,
                                last_read_at = EXCLUDED.last_read_at,
                                updated_at = NOW()
                        `,
                        [threadIds, currentUserId]
                    );
                }

                return res.json({ message: 'Chat thread marked as read', threadId, threadIds });
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }

        async function deleteChatThread(req, res) {
            const currentUserId = await getAuthenticatedChatUserId(req);
            const threadId = Number(req.params.threadId);

            if (!currentUserId) {
                return res.status(401).json({ message: 'Báº¡n cáº§n Ä‘Äƒng nháº­p Ä‘á»ƒ xÃ³a tin nháº¯n.' });
            }

            if (!Number.isFinite(threadId)) {
                return res.status(400).json({ message: 'Invalid thread id' });
            }

            try {
                const participantCheck = await pool.query(
                    `
                        SELECT id, owner_user_id, customer_user_id
                        FROM chat_threads
                        WHERE id = $1
                          AND ($2 = owner_user_id OR $2 = customer_user_id)
                        LIMIT 1
                    `,
                    [threadId, currentUserId]
                );

                if (!participantCheck.rows.length) {
                    return res.status(404).json({ message: 'KhÃ´ng tÃ¬m tháº¥y cuá»™c trÃ² chuyá»‡n.' });
                }

                const ownerUserId = String(participantCheck.rows[0].owner_user_id || '').trim();
                const customerUserId = String(participantCheck.rows[0].customer_user_id || '').trim();

                const relatedThreadsResult = await pool.query(
                    `
                        SELECT id
                        FROM chat_threads
                        WHERE owner_user_id = $1
                          AND customer_user_id = $2
                        ORDER BY id ASC
                    `,
                    [ownerUserId, customerUserId]
                );

                const relatedThreadIds = relatedThreadsResult.rows.map((row) => Number(row.id)).filter((value) => Number.isFinite(value));

                if (relatedThreadIds.length) {
                    await pool.query(
                        `
                            INSERT INTO chat_thread_hidden (thread_id, user_id, hidden_at, updated_at)
                            SELECT thread_id, $2, NOW(), NOW()
                            FROM UNNEST($1::bigint[]) AS hidden_threads(thread_id)
                            ON CONFLICT (thread_id, user_id)
                            DO UPDATE
                            SET hidden_at = EXCLUDED.hidden_at,
                                updated_at = NOW()
                        `,
                        [relatedThreadIds, currentUserId]
                    );
                }

                return res.json({
                    message: 'Chat thread hidden',
                    threadId,
                    deletedThreadIds: relatedThreadIds
                });
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }

        registerVersionedRoute('get', '/chat/threads', authenticateRequest, checkUserStatus, listChatThreads);
        registerVersionedRoute('get', '/chat/venues/:venueId', authenticateRequest, checkUserStatus, getVenueChatThread);
        registerVersionedRoute('post', '/chat/venues/:venueId/messages', authenticateRequest, checkUserStatus, sendVenueChatMessage);
        registerVersionedRoute('post', '/chat/threads/:threadId/read', authenticateRequest, checkUserStatus, markChatThreadRead);
        registerVersionedRoute('delete', '/chat/threads/:threadId', authenticateRequest, checkUserStatus, deleteChatThread);

        registerVersionedRoute('get', '/wards', listPublicWards);
        registerVersionedRoute('get', '/place-categories', listPublicPlaceCategories);
        registerVersionedRoute('get', '/merchant-services', listPublicMerchantServices);
        registerVersionedRoute('get', '/feedback/types', listPublicFeedbackTypes);
        registerVersionedRoute('get', '/venues', listPublicVenues);
        registerVersionedRoute('get', '/venues/:venueId', authenticateOptional, getVenueDetails);
        registerVersionedRoute('get', '/venues/:venueId/reviews', listPublicVenueReviews);
        registerVersionedRoute('get', '/venues/:venueId', getVenueDetails);
        registerVersionedRoute('get', '/venues/:venueId/community', authenticateOptional, getVenueCommunityBundle);
        registerVersionedRoute('get', '/venues/:venueId/opening-hours', getVenueOpeningHoursRealtime);
        registerVersionedRoute('post', '/venues/:venueId/reviews', authenticateOptional, requireAuth, submitVenueReview);
        registerVersionedRoute('post', '/venues/:venueId/reviews/:reviewId/like', authenticateOptional, requireAuth, toggleVenueReviewLike);
        registerVersionedRoute('post', '/venues/:venueId/reviews/:reviewId/replies', authenticateOptional, requireAuth, createVenueReviewReply);
        registerVersionedRoute('delete', '/venues/:venueId/reviews/:reviewId', authenticateOptional, requireAuth, deleteVenueReview);
        registerVersionedRoute('post', '/venues', authenticateOptionalLenient, createVenueSubmission);
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
        registerVersionedRoute('get', '/admin/venues/:venueId', authenticateRequest, requireAdminRole, getAdminVenueDetail);
        registerVersionedRoute('patch', '/admin/venues/:venueId/moderation', authenticateRequest, requireAdminRole, moderateVenueSubmission);
        registerVersionedRoute('get', '/admin/venues/:venueId/reviews', authenticateRequest, requireAdminRole, listAdminVenueReviews);
        registerVersionedRoute('post', '/admin/venues/:venueId/message', authenticateRequest, requireAdminRole, sendAdminVenueModerationMessage);
        registerVersionedRoute('get', '/admin/feedback/types', authenticateRequest, requireAdminRole, listAdminFeedbackTypes);
        registerVersionedRoute('post', '/admin/feedback/types', authenticateRequest, requireAdminRole, createAdminFeedbackType);
        registerVersionedRoute('patch', '/admin/feedback/types/:typeId', authenticateRequest, requireAdminRole, updateAdminFeedbackType);
        registerVersionedRoute('delete', '/admin/feedback/types/:typeId', authenticateRequest, requireAdminRole, deleteAdminFeedbackType);
        registerVersionedRoute('get', '/admin/feedback/reports', authenticateRequest, requireAdminRole, listAdminFeedbackReports);
        registerVersionedRoute('get', '/admin/feedback/reports/:feedbackId', authenticateRequest, requireAdminRole, getAdminFeedbackReportDetail);
        registerVersionedRoute('post', '/admin/feedback/reports/:feedbackId/reply', authenticateRequest, requireAdminRole, replyAdminFeedbackReport);
        registerVersionedRoute('delete', '/admin/feedback/reports/:feedbackId', authenticateRequest, requireAdminRole, deleteAdminFeedbackReport);

        registerVersionedRoute('get', '/users', authenticateRequest, requireAdminRole, listAdminUsers);
        registerVersionedRoute('get', '/admin/users', authenticateRequest, checkUserStatus, requireAdminRole, listAdminUsers);
        registerVersionedRoute('post', '/admin/users', authenticateRequest, checkUserStatus, requireAdminRole, createAdminUser);
        registerVersionedRoute('put', '/admin/users/:userId', authenticateRequest, checkUserStatus, requireAdminRole, updateAdminUserRole);
        registerVersionedRoute('delete', '/admin/users/:userId', authenticateRequest, checkUserStatus, requireAdminRole, deleteAdminUserById);

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

                const status = (user.status || 'active').toLowerCase();
                const pauseUntil = user.pause_until ? new Date(user.pause_until) : null;
                const now = new Date();

                if (status === 'blocked') {
                    const reason = user.blocked_reason || 'Vi phạm điều khoản sử dụng.';
                    return res.status(403).json({ message: `Tài khoản đã bị khóa vĩnh viễn: ${reason}` });
                }

                if (status === 'paused') {
                    if (pauseUntil && pauseUntil > now) {
                        return res.status(403).json({ message: `Tài khoản đang bị tạm dừng đến ${pauseUntil.toLocaleString()}` });
                    }

                    // Nếu tạm dừng hết hạn, khôi phục active
                    await pool.query(`UPDATE users SET status = 'active', pause_until = NULL WHERE id = $1`, [user.id]);
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

        // Verify auth endpoint - checks if token is valid and user is still active
        app.get('/api/auth/verify', authenticateRequest, checkUserStatus, (req, res) => {
            res.json({ 
                success: true, 
                message: 'Token is valid',
                user: {
                    id: req.user?.id,
                    email: req.user?.email,
                    role: req.user?.role
                }
            });
        });

        app.get('/api/v1/auth/verify', authenticateRequest, checkUserStatus, (req, res) => {
            res.json({ 
                success: true, 
                message: 'Token is valid',
                user: {
                    id: req.user?.id,
                    email: req.user?.email,
                    role: req.user?.role
                }
            });
        });

        // ==========================================
        // USER PROFILE APIS
        // ==========================================

        app.get('/api/users/profile', authenticateRequest, checkUserStatus, async (req, res) => {
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

        app.put('/api/users/profile', authenticateRequest, checkUserStatus, requireAuth, async (req, res) => {
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

        const getUserFavoritesHandler = async (req, res) => {
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
        };

        registerVersionedRoute('get', '/users/favorites', authenticateOptional, requireAuth, getUserFavoritesHandler);
        app.get('/users/favorites', authenticateOptional, requireAuth, getUserFavoritesHandler);

        const toggleUserFavoriteHandler = async (req, res) => {
            const userId = req.user.id;
            const { itemId, itemType, name, image, price, description } = req.body;

            try {
                const normalizedItemId = String(itemId ?? req.body?.id ?? '').trim();
                const normalizedItemType = String(itemType || req.body?.type || 'place').trim().toLowerCase();

                if (!normalizedItemId || !normalizedItemType) {
                    return res.status(400).json({ message: 'Missing item information.' });
                }

                const existing = await pool.query(
                    'SELECT id FROM user_favorites WHERE user_id = $1 AND item_id = $2 AND item_type = $3',
                    [userId, normalizedItemId, normalizedItemType]
                );

                if (existing.rows.length > 0) {
                    await pool.query(
                        'DELETE FROM user_favorites WHERE user_id = $1 AND item_id = $2 AND item_type = $3',
                        [userId, normalizedItemId, normalizedItemType]
                    );
                    return res.json({ success: true, favorited: false });
                }

                await pool.query(
                    `INSERT INTO user_favorites (user_id, item_id, item_type, name, image, price, description)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        userId,
                        normalizedItemId,
                        normalizedItemType,
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
        };

        registerVersionedRoute('post', '/users/favorites/toggle', authenticateOptional, requireAuth, toggleUserFavoriteHandler);
        app.post('/users/favorites/toggle', authenticateOptional, requireAuth, toggleUserFavoriteHandler);

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
