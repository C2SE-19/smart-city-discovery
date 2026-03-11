# Smart City Discovery Team Scaffold

## 1. Muc tieu cua bo suon nay

- Tach frontend va backend theo feature de nhieu thanh vien code song song.
- Giu nguyen core GIS hien co de khong mat luong dang chay.
- Tao san contract cho cac module chua implement nhu auth, AI recommendation va merchant ads.

## 2. Frontend structure

```text
frontend/src/
  app/
    AppRouter.jsx
  features/
    admin/pages/
    ai/pages/
    discovery/pages/
    map/components/
    merchant/pages/
    overview/pages/
  shared/
    components/
    data/
    hooks/
    layouts/
    services/api/
```

### Frontend chia viec de xuat

1. Member A: `frontend/src/features/discovery`
   - Search UI
   - Filter theo ward
   - Venue list, detail card, bookmark, review

2. Member B: `frontend/src/features/admin`
   - Admin GIS page
   - GeoJSON upload UI
   - Moderation queue va approval screens

3. Member C: `frontend/src/features/merchant`
   - Merchant onboarding
   - Venue profile form
   - Ads package UI, transaction history

4. Member D: `frontend/src/features/ai`
   - Chat panel
   - Image upload UX
   - Recommendation cards va explanation UI

5. Member E hoac nguoi giu khung:
   - `frontend/src/shared`
   - `frontend/src/features/map/components`
   - CSS system va layout consistency

## 3. Backend structure

```text
backend/src/
  app.js
  server.js
  config/
  middlewares/
  routes/
  shared/
  modules/
    auth/
    gis/
    recommendations/
    system/
    venues/
    wards/
```

### Backend chia viec de xuat

1. Member A: `backend/src/modules/gis` + `backend/src/modules/wards`
   - Point in polygon
   - Boundary management
   - Geo validation

2. Member B: `backend/src/modules/venues`
   - Venue CRUD
   - Pending approval flow
   - Reviews, comments, reports mo rong tu module nay

3. Member C: `backend/src/modules/auth`
   - Register, login, JWT
   - Role based access control
   - User and merchant profiles

4. Member D: `backend/src/modules/recommendations`
   - Weather-aware recommendation
   - Chat orchestration
   - Image recognition contracts

5. Member E hoac nguoi giu backend base:
   - `backend/src/config`
   - `backend/src/middlewares`
   - `backend/src/modules/system`
   - Logging, health checks, deployment support

## 4. API status hien tai

### Dang hoat dong

- `GET /api/v1/system/health`
- `GET /api/v1/system/database-time`
- `GET /api/v1/system/modules`
- `GET /api/v1/wards`
- `GET /api/v1/venues`
- `POST /api/v1/venues`
- `POST /api/v1/gis/detect-ward`

### Da co khung, chua implement

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/profile`
- `POST /api/v1/recommendations/contextual`
- `POST /api/v1/recommendations/image-recognition`
- `POST /api/v1/recommendations/chat`

### Legacy routes duoc giu lai

- `GET /api/test-db`
- `GET /api/wards`
- `GET /api/venues`
- `POST /api/venues`
- `POST /api/gis/detect-ward`

## 5. Rule de team code khong dung nhau

1. Mỗi member code trong feature folder da duoc giao.
2. Neu can sua `shared` thi thong nhat truoc trong team.
3. Khong hardcode endpoint moi trong page; dung `shared/services/api`.
4. Map rendering dung lai `features/map/components/InteractiveWardMap.jsx` de tranh duplicate.
5. Business logic backend nam trong `service`, query nam trong `repository`, route chi mount controller.

## 6. Thu tu uu tien de lam tiep

1. Chot auth va role permissions.
2. Tach merchant submit venue thanh pending workflow thay vi create truc tiep.
3. Noi weather API va contextual recommendation.
4. Them upload media va Supabase storage.
5. Them review, comment, report, ad packages.