require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const turf = require('@turf/turf');

const app = express();

app.use(cors());
app.use(express.json());

// ================================
// KẾT NỐI SUPABASE POSTGRESQL
// ================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// TEST KẾT NỐI DATABASE
pool.connect()
.then(client => {
    console.log("✅ Đã kết nối thành công tới Supabase PostgreSQL!");
    client.release();
})
.catch(err => {
    console.error("❌ Kết nối Supabase thất bại:", err);
});


// ==========================================
// API TEST DATABASE
// ==========================================

app.get('/api/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({
            message: "Kết nối database thành công",
            time: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});


// ==========================================
// API 1: LẤY DANH SÁCH PHƯỜNG (GeoJSON)
// ==========================================

app.get('/api/wards', async (req, res) => {
    try {

        const result = await pool.query(`
            SELECT ward_id, name, boundary 
            FROM wards
        `);

        res.json(result.rows);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }
});


// ==========================================
// API 2: LẤY DANH SÁCH ĐỊA ĐIỂM
// ==========================================

app.get('/api/venues', async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT *
            FROM venues
            ORDER BY created_at DESC
        `);

        res.json(result.rows);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }
});


// ==========================================
// API 3: THÊM ĐỊA ĐIỂM + TỰ ĐỘNG NHẬN DIỆN PHƯỜNG
// ==========================================

app.post('/api/venues', async (req, res) => {

    const { name, address, latitude, longitude } = req.body;

    if (!name || !latitude || !longitude) {
        return res.status(400).json({
            error: "Thiếu dữ liệu cần thiết"
        });
    }

    try {

        // 1. Tạo điểm tọa độ
        const pt = turf.point([longitude, latitude]);

        // 2. Lấy toàn bộ phường
        const wardsResult = await pool.query(`
            SELECT ward_id, name, boundary
            FROM wards
        `);

        let detectedWardId = null;
        let detectedWardName = "Chưa xác định";

        // 3. Thuật toán kiểm tra point in polygon
        for (let ward of wardsResult.rows) {

            const features = ward.boundary.features;

            for (let feature of features) {

                if (
                    feature.geometry.type === "Polygon" ||
                    feature.geometry.type === "MultiPolygon"
                ) {

                    if (turf.booleanPointInPolygon(pt, feature)) {

                        detectedWardId = ward.ward_id;
                        detectedWardName = ward.name;

                        break;
                    }
                }
            }

            if (detectedWardId) break;
        }

        // 4. Insert venue vào database

        const insertQuery = `
            INSERT INTO venues
            (name, address, latitude, longitude, ward_id)
            VALUES ($1,$2,$3,$4,$5)
            RETURNING *
        `;

        const newVenue = await pool.query(insertQuery, [
            name,
            address,
            latitude,
            longitude,
            detectedWardId
        ]);

        res.json({

            message: "Đã lưu địa điểm thành công",

            detectedWard: detectedWardName,

            venue: newVenue.rows[0]

        });

    } catch (err) {

        console.error("Lỗi API:", err);

        res.status(500).json({
            error: "Lỗi máy chủ"
        });

    }

});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

    console.log(`🚀 Backend Server chạy tại http://localhost:${PORT}`);

});