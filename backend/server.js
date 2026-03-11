require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const turf = require('@turf/turf'); // Thư viện toán học không gian "thần thánh"

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Supabase connection failed:', err);
  } else {
    console.log('✅ Supabase connected:', res.rows[0]);
  }
});

// ==========================================
// CÁC API CỐT LÕI CỦA HỆ THỐNG
// ==========================================

// API 1: Lấy dữ liệu ranh giới Phường để gửi cho Frontend vẽ bản đồ
app.get('/api/wards', async (req, res) => {
    try {
        const result = await pool.query('SELECT ward_id, name, boundary FROM wards');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// API 1.5: Lấy danh sách toàn bộ địa điểm (quán ăn) để vẽ marker lên bản đồ
app.get('/api/venues', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM venues ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API 2: Nhận tọa độ quán ăn, dùng AI tính toán Phường và lưu Database
app.post('/api/venues', async (req, res) => {
    const { name, address, latitude, longitude } = req.body;

    try {
        // 1. Dùng Turf.js biến tọa độ [Kinh độ, Vĩ độ] thành một "Điểm" trên bản đồ
        const pt = turf.point([longitude, latitude]);

        // 2. Lấy tất cả các Phường từ Database lên
        const wardsResult = await pool.query('SELECT ward_id, name, boundary FROM wards');
        
        let detectedWardId = null;
        let detectedWardName = 'Chưa xác định (Nằm ngoài ranh giới)';

        // 3. THUẬT TOÁN ĐỐI CHIẾU: Quán ăn nằm trong Phường nào?
        for (let ward of wardsResult.rows) {
            const features = ward.boundary.features;
            
            // Lục lọi các mảnh ghép đa giác của phường
            for (let feature of features) {
                if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                    // Phép thuật Turf.js: Kiểm tra Điểm có nằm lọt thỏm trong Đa giác không?
                    if (turf.booleanPointInPolygon(pt, feature)) {
                        detectedWardId = ward.ward_id;
                        detectedWardName = ward.name;
                        break;
                    }
                }
            }
            if (detectedWardId) break; // Nếu tìm thấy phường rồi thì dừng vòng lặp cho nhẹ máy
        }

        // 4. Lưu quán ăn vào DB kèm theo cái ID phường mà máy tính tự động tìm được
        const insertQuery = `
            INSERT INTO venues (name, address, latitude, longitude, ward_id)
            VALUES ($1, $2, $3, $4, $5) RETURNING *;
        `;
        const newVenue = await pool.query(insertQuery, [name, address, latitude, longitude, detectedWardId]);

        // Trả kết quả về cho màn hình
        res.json({
            message: 'Đã lưu quán ăn thành công!',
            thuật_toán_nhận_diện: detectedWardName,
            dữ_liệu: newVenue.rows[0]
        });

    } catch (err) {
        console.error('Lỗi API:', err);
        res.status(500).json({ error: 'Lỗi máy chủ rùi' });
    }
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Backend Server đã mở cửa tại http://localhost:${PORT}`);
});