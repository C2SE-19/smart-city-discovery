# AI Image Training Guide

Mục tiêu: cải thiện độ chính xác của AI Image bằng cách làm 3 việc đều đặn mỗi ngày: thêm ảnh mẫu, chuẩn hóa label, và đọc review log.

## Cách làm nhanh

### 1) Thêm ảnh mẫu đúng label
- Mỗi ảnh chỉ gán 1 nhãn chuẩn cuối cùng.
- Dùng nhãn có sẵn trong `backend/data/vision-taxonomy.json`.
- Nếu chưa có nhãn phù hợp, thêm nhãn mới trước, đừng ép AI đoán.

### 2) Chạy AI Image và lưu kết quả
- Gửi ảnh vào endpoint image search.
- Lưu lại các trường quan trọng:
  - `target`
  - `detectedLabel`
  - `confidence`
  - `taxonomyNormalization`
  - `topCandidates`
  - `venueResults`
  - `searchText`

### 3) Đọc log và chỉnh taxonomy
- Mở report log:

```bash
cd backend
npm run report:vision:taxonomy -- --days 7
```

- Xem 3 nhóm case:
  - đúng nhưng confidence thấp
  - sai label
  - unknown dù DB có kết quả đúng

## Ví dụ thực tế

Ảnh: quán bún chả cá

Kỳ vọng:
- `target = food`
- AI nên trả nhãn kiểu `Bún chả cá`
- DB nên ra quán bún chả cá phù hợp

Nếu AI trả sai:
- Thêm ảnh mẫu cho `bun_cha_ca`
- Bổ sung alias/cue như `fish cake noodle soup`, `chả cá`, `bún chả cá`
- Nếu cần thì tăng số ảnh mẫu của cùng nhãn

## Checklist 10 phút mỗi ngày

1. Mở report log của AI Image.
2. Lọc 10 case mới nhất bị sai hoặc `unknown`.
3. Chọn 3 case quan trọng nhất:
   - 1 case đúng nhưng confidence thấp
   - 1 case sai label
   - 1 case `unknown` dù DB có kết quả đúng
4. Với mỗi case, làm 1 trong 3 việc:
   - thêm ảnh mẫu
   - thêm alias/cue vào taxonomy
   - chỉnh `confusable_with` hoặc `display_names`
5. Chạy lại 3 ảnh test tương ứng.
6. Ghi lại kết quả cuối ngày:
   - đúng bao nhiêu
   - unknown bao nhiêu
   - nhầm sang label nào nhiều nhất

## Nguyên tắc train dễ nhất

- Sửa taxonomy trước.
- Thêm ảnh mẫu sau.
- Chỉnh ngưỡng confidence cuối cùng.
- Không ép AI đoán khi ảnh mơ hồ.
- Nếu ảnh có kết quả DB đúng, ưu tiên cho ra venue đó thay vì để `unknown`.

## Mẫu ghi tay cho mỗi case

- Ảnh:
- Target:
- Label chuẩn:
- AI trả:
- DB có kết quả không:
- Cần thêm gì: ảnh mẫu / alias / cue / nhãn mới
