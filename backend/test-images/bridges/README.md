Đặt ảnh cầu thật vào thư mục này để test end-to-end.

Các bước:
1. Chép ảnh vào `backend/test-images/bridges/`.
2. Tên file gợi ý: `cau-rong-1.jpg`, `cau-song-han-1.png`, `cau-vang-1.jpg`.
3. Khởi động backend:

```bash
cd backend
npm run dev
```

4. Ở terminal khác (tại thư mục gốc dự án), chạy test:

```bash
node backend/scripts/bridge-vision-test.js
```

Lưu ý:
- Script gửi JSON `imageDataUrl` đúng theo API `/api/vision/image-search` hiện tại.
- Script tự lấy `PORT` từ `backend/.env` (nếu không có thì dùng `3000`).
- Nếu backend chạy ở URL khác, set biến `TEST_SERVER_URL` trước khi chạy script.
