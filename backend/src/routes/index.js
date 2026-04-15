const express = require('express');
const authRoutes = require('../modules/auth/auth.routes');
const usersRoutes = require('../modules/users/users.routes');

const router = express.Router();

const normalizeCategoryLabel = (category) =>
  String(category || '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();

const normalizePlaces = (places) =>
  places.map((place) => ({
    ...place,
    category: normalizeCategoryLabel(place.category)
  }));

const getPagination = (req) => {
  const page = Number.parseInt(req.query.page, 10);
  const limit = Number.parseInt(req.query.limit, 10);

  if (!Number.isFinite(page) || !Number.isFinite(limit) || page < 1 || limit < 1) {
    return null;
  }

  return { page, limit };
};

const paginate = (items, pagination) => {
  if (!pagination) {
    return { data: items, meta: null };
  }

  const { page, limit } = pagination;
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const data = items.slice(start, start + limit);

  return {
    data,
    meta: { page, limit, total, totalPages }
  };
};

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'API is running' });
});

router.get('/landing/da-nang-places', (req, res) => {
  const places = [
      {
        id: 'dragon-bridge',
        name: 'Cầu Rồng',
        category: 'Phố Biển',
        description: 'Check-in biểu tượng',
        imageUrl: '/api/static/dragon-bridge.jpg',
        lat: 16.0609,
        lng: 108.2332
      },
      {
        id: 'ba-na-hills',
        name: 'Bà Nà Hills',
        category: 'Thiên Nhiên',
        description: 'Trải nghiệm thiên nhiên',
        lat: 15.9954,
        lng: 107.9967
      },
      {
        id: 'son-tra',
        name: 'Sơn Trà',
        category: 'Thiên Nhiên',
        description: 'Không gian sinh thái',
        lat: 16.1149,
        lng: 108.3079
      },
      {
        id: 'ngu-hanh-son',
        name: 'Ngũ Hành Sơn',
        category: 'Phổ Biến',
        description: 'Di tích văn hoá',
        lat: 16.0039,
        lng: 108.2626
      },
      {
        id: 'my-khe-beach',
        name: 'Bãi biển Mỹ Khê',
        category: 'Phố Biển',
        description: 'Bãi biển đẹp nổi tiếng',
        lat: 16.0566,
        lng: 108.2475
      },
      {
        id: 'han-market',
        name: 'Chợ Hàn',
        category: 'Ẩm Thực',
        description: 'Thiên đường ẩm thực & mua sắm',
        lat: 16.0741,
        lng: 108.2241
      },
      {
        id: 'cham-museum',
        name: 'Bảo tàng Chăm',
        category: 'Phổ Biến',
        description: 'Không gian văn hoá',
        lat: 16.0606,
        lng: 108.2231
      },
      {
        id: 'hai-van-pass',
        name: 'Đèo Hải Vân',
        category: 'Thiên Nhiên',
        description: 'Cung đường săn mây',
        lat: 16.1896,
        lng: 108.0987
      }
    ];

  const normalizedPlaces = normalizePlaces(places);
  const pagination = getPagination(req);
  const { data, meta } = paginate(normalizedPlaces, pagination);

  res.json(meta ? { data, meta } : { data });
});

router.get('/landing/places-list', (req, res) => {
  const places = [
      {
        id: 'dragon-bridge',
        name: 'Cầu Rồng',
        category: 'Phổ Biến',
        description: 'Check-in biểu tượng',
        district: 'Hải Châu',
        imageUrl: '/api/static/dragon-bridge.jpg',
        lat: 16.0609,
        lng: 108.2332
      },
      {
        id: 'ba-na-hills',
        name: 'Bà Nà Hills',
        category: 'Thiên Nhiên',
        description: 'Trải nghiệm thiên nhiên',
        district: 'Hoà Vang',
        lat: 15.9954,
        lng: 107.9967
      },
      {
        id: 'son-tra',
        name: 'Sơn Trà',
        category: 'Thiên Nhiên',
        description: 'Không gian sinh thái',
        district: 'Sơn Trà',
        lat: 16.1149,
        lng: 108.3079
      },
      {
        id: 'ngu-hanh-son',
        name: 'Ngũ Hành Sơn',
        category: 'Phổ Biến',
        description: 'Di tích văn hoá',
        district: 'Ngũ Hành Sơn',
        lat: 16.0039,
        lng: 108.2626
      },
      {
        id: 'my-khe-beach',
        name: 'Bãi biển Mỹ Khê',
        category: 'Phố Biển',
        description: 'Bãi biển đẹp nổi tiếng',
        district: 'Sơn Trà',
        lat: 16.0566,
        lng: 108.2475
      },
      {
        id: 'han-market',
        name: 'Chợ Hàn',
        category: 'Ẩm Thực',
        description: 'Thiên đường ẩm thực & mua sắm',
        district: 'Hải Châu',
        lat: 16.0741,
        lng: 108.2241
      },
      {
        id: 'cham-museum',
        name: 'Bảo tàng Chăm',
        category: 'Phổ Biến',
        description: 'Không gian văn hoá',
        district: 'Hải Châu',
        lat: 16.0606,
        lng: 108.2231
      },
      {
        id: 'hai-van-pass',
        name: 'Đèo Hải Vân',
        category: 'Thiên Nhiên',
        description: 'Cung đường săn mây',
        district: 'Liên Chiểu',
        lat: 16.1896,
        lng: 108.0987
      }
    ];

  const normalizedPlaces = normalizePlaces(places);
  const pagination = getPagination(req);
  const { data, meta } = paginate(normalizedPlaces, pagination);

  res.json(meta ? { data, meta } : { data });
});

const landingDetails = {
  'kham-pha-dia-phuong': {
    slug: 'kham-pha-dia-phuong',
    title: 'Khám phá địa phương thông minh',
    subtitle: 'Tìm nhanh món ngon, điểm check-in và trải nghiệm nổi bật',
    description: 'Kết hợp dữ liệu địa điểm, đánh giá cộng đồng và gợi ý theo sở thích để bạn khám phá thành phố dễ dàng hơn.',
    highlights: ['Tìm kiếm nhanh', 'Gợi ý cá nhân hoá', 'Bản đồ trực quan'],
    features: [
      { title: 'Bộ lọc linh hoạt', copy: 'Chọn nhanh theo danh mục, quận/huyện, dịch vụ và thời gian mở cửa.' },
      { title: 'Gợi ý theo hành vi', copy: 'Hệ thống đề xuất địa điểm dựa trên sở thích và lịch sử tìm kiếm.' },
      { title: 'Trải nghiệm bản đồ sống', copy: 'Theo dõi vị trí và điểm đến nổi bật ngay trên bản đồ thời gian thực.' }
    ],
  cta: { label: 'Khám phá bản đồ', link: '/city-map?lat=16.0471&lng=108.2068' },
  secondaryCta: { label: 'Xem danh sách địa điểm', link: '/places' }
  },
  'ho-tro-cua-hang': {
    slug: 'ho-tro-cua-hang',
    title: 'Hỗ trợ cửa hàng phát triển',
    subtitle: 'Tăng hiển thị thương hiệu và tiếp cận khách hàng tiềm năng',
    description: 'Bộ công cụ dành cho merchant giúp quản lý thông tin, ưu đãi và theo dõi hiệu quả tương tác.',
    highlights: ['Trang quản lý riêng', 'Ưu đãi nổi bật', 'Báo cáo hiệu quả'],
    features: [
      { title: 'Hồ sơ cửa hàng đầy đủ', copy: 'Thêm hình ảnh, menu, dịch vụ và thông tin liên hệ chỉ trong vài phút.' },
      { title: 'Chiến dịch khuyến mãi', copy: 'Tạo ưu đãi và hiển thị đúng khách hàng theo khu vực.' },
      { title: 'Theo dõi tương tác', copy: 'Thống kê lượt xem, lượt yêu thích và phản hồi theo thời gian.' }
    ],
    cta: { label: 'Mở trang merchant', link: '/merchant' },
    secondaryCta: { label: 'Liên hệ hỗ trợ', link: '/feedback' }
  },
  'tu-duy-gis': {
    slug: 'tu-duy-gis',
    title: 'Tư duy GIS cho đô thị hiện đại',
    subtitle: 'Nền tảng bản đồ nhiều lớp dữ liệu',
    description: 'Tích hợp dữ liệu hành chính, địa điểm, dịch vụ để xây dựng hệ sinh thái bản đồ linh hoạt.',
    highlights: ['Lớp dữ liệu rõ ràng', 'Tích hợp phân tích', 'Mở rộng dễ dàng'],
    features: [
      { title: 'Chuẩn hoá dữ liệu địa lý', copy: 'Dễ dàng liên kết dữ liệu hành chính và phân vùng dịch vụ.' },
      { title: 'Hiển thị đa lớp', copy: 'Cho phép bật/tắt các lớp thông tin phù hợp nhu cầu.' },
      { title: 'Sẵn sàng mở rộng', copy: 'Hỗ trợ tích hợp dữ liệu mới cho các dự án đô thị thông minh.' }
    ],
  cta: { label: 'Mở bản đồ GIS', link: '/city-map?lat=16.0471&lng=108.2068' },
    secondaryCta: { label: 'Xem tài liệu', link: '/about' }
  },
  'dich-vu-tong-quan': {
    slug: 'dich-vu-tong-quan',
    title: 'Khám phá hệ dịch vụ Smart City',
    subtitle: 'Nền tảng kết nối người dùng, cửa hàng và dữ liệu bản đồ',
    description: 'Tổng hợp các module giao hàng, quảng bá và quản trị nội dung giúp vận hành hệ sinh thái thành phố.',
    highlights: ['Module linh hoạt', 'Quy trình tự động', 'Báo cáo rõ ràng'],
    features: [
      { title: 'Quản lý dịch vụ tập trung', copy: 'Theo dõi trạng thái đơn hàng, chiến dịch và dữ liệu vận hành từ một nơi.' },
      { title: 'Tối ưu trải nghiệm', copy: 'Hỗ trợ cá nhân hoá đề xuất và nâng cao tỷ lệ chuyển đổi.' },
      { title: 'Kết nối hệ sinh thái', copy: 'Sẵn sàng tích hợp các bên thứ ba trong tương lai.' }
    ],
    cta: { label: 'Xem các dịch vụ', link: '/service' },
    secondaryCta: { label: 'Liên hệ tư vấn', link: '/feedback' }
  },
  'khu-am-thuc': {
    slug: 'khu-am-thuc',
    title: 'Khu ẩm thực nổi bật',
    subtitle: 'Khám phá ẩm thực theo khu vực',
    description: 'Tổng hợp những khu ẩm thực nổi tiếng và gợi ý điểm đến cho hành trình của bạn.',
    highlights: ['Ăn uống đa dạng', 'Trung tâm thành phố', 'Đề xuất theo thời gian'],
    features: [
      { title: 'Khu vực trung tâm', copy: 'Tập trung nhiều quán ăn nổi bật trong bán kính gần.' },
      { title: 'Gợi ý theo nhóm', copy: 'Tìm nhanh theo nhóm bạn, gia đình hoặc du lịch.' },
      { title: 'Theo dõi xu hướng', copy: 'Cập nhật điểm ăn uống được check-in nhiều nhất.' }
    ],
    cta: { label: 'Xem bản đồ ẩm thực', link: '/city-map?lat=16.0678&lng=108.2208' },
    secondaryCta: { label: 'Xem tất cả thành phố', link: '/all-city' }
  },
  'dia-danh-noi-bat': {
    slug: 'dia-danh-noi-bat',
    title: 'Địa danh nổi bật',
    subtitle: 'Điểm check-in không thể bỏ lỡ',
    description: 'Tổng hợp các điểm check-in, cầu nổi tiếng, bảo tàng và chùa lớn trong thành phố.',
    highlights: ['Check-in nổi tiếng', 'Di sản văn hoá', 'Gợi ý hành trình'],
    features: [
      { title: 'Điểm đến tiêu biểu', copy: 'Lọc nhanh các địa danh đáng trải nghiệm nhất.' },
      { title: 'Thông tin đầy đủ', copy: 'Mô tả, hình ảnh và đánh giá thực tế.' },
      { title: 'Lộ trình tối ưu', copy: 'Gợi ý tuyến đường thuận tiện cho chuyến đi.' }
    ],
    cta: { label: 'Đi tới địa danh', link: '/city-map?lat=16.0609&lng=108.2332' },
    secondaryCta: { label: 'Xem tất cả thành phố', link: '/all-city' }
  },
  'lo-trinh-goi-y': {
    slug: 'lo-trinh-goi-y',
    title: 'Lộ trình gợi ý',
    subtitle: 'Gợi ý hành trình gọn trong 1 ngày',
    description: 'Gợi ý hành trình di chuyển gọn trong 1 ngày hoặc cuối tuần cho khách du lịch.',
    highlights: ['Tối ưu thời gian', 'Đa dạng trải nghiệm', 'Định hướng rõ ràng'],
    features: [
      { title: 'Lịch trình tối ưu', copy: 'Kết hợp ăn uống, tham quan và giải trí hợp lý.' },
      { title: 'Theo thời gian thực', copy: 'Cập nhật địa điểm dựa trên thời tiết và thời gian.' },
      { title: 'Gợi ý cá nhân', copy: 'Tuỳ biến theo phong cách du lịch của bạn.' }
    ],
    cta: { label: 'Xem tuyến đường', link: '/city-map?lat=16.0471&lng=108.2068' },
    secondaryCta: { label: 'Xem tất cả thành phố', link: '/all-city' }
  },
  'giao-hang-thong-minh': {
    slug: 'giao-hang-thong-minh',
    title: 'Giao hàng thông minh',
    subtitle: 'Tự động tối ưu tuyến đường và thời gian giao',
    description: 'Hệ thống điều phối giúp merchant giao hàng nhanh hơn với chi phí tối ưu.',
    highlights: ['Điều phối nhanh', 'Theo dõi realtime', 'Bảo đảm chất lượng'],
    features: [
      { title: 'Theo dõi trạng thái', copy: 'Cập nhật trạng thái giao hàng cho cả khách và cửa hàng.' },
      { title: 'Tối ưu chi phí', copy: 'Tự động gợi ý tuyến đường ngắn nhất.' }
    ],
    cta: { label: 'Trải nghiệm dịch vụ', link: '/landing/dich-vu-tong-quan' },
    secondaryCta: { label: 'Liên hệ triển khai', link: '/feedback' }
  },
  'quang-cao-promotion': {
    slug: 'quang-cao-promotion',
    title: 'Quảng cáo & Promotion',
    subtitle: 'Hiển thị đúng khách hàng theo vị trí',
    description: 'Công cụ tạo chiến dịch quảng bá, ưu đãi và theo dõi hiệu quả theo thời gian thực.',
    highlights: ['Nhắm đúng đối tượng', 'Tăng nhận diện', 'Báo cáo tức thì'],
    features: [
      { title: 'Bộ lọc chiến dịch', copy: 'Chọn khu vực, thời gian và đối tượng khách hàng mục tiêu.' },
      { title: 'Theo dõi hiệu suất', copy: 'So sánh lượt hiển thị, click và chuyển đổi dễ dàng.' }
    ],
    cta: { label: 'Xem chiến dịch mẫu', link: '/landing/dich-vu-tong-quan' },
    secondaryCta: { label: 'Đăng ký tư vấn', link: '/feedback' }
  },
  'module-linh-hoat': {
    slug: 'module-linh-hoat',
    title: 'Module linh hoạt',
    subtitle: 'Tùy biến nội dung cho từng nhóm người dùng',
    description: 'Cho phép bật/tắt các module theo chiến dịch mà không ảnh hưởng cấu trúc chung.',
    highlights: ['Linh hoạt triển khai', 'Không gián đoạn hệ thống', 'Cấu hình nhanh'],
    features: [
      { title: 'Bật/tắt module', copy: 'Kiểm soát từng module theo nhu cầu chiến dịch.' },
      { title: 'Tái sử dụng nhanh', copy: 'Tăng tốc triển khai bằng cấu hình dựng sẵn.' }
    ],
    cta: { label: 'Xem cấu trúc dịch vụ', link: '/landing/dich-vu-tong-quan' },
    secondaryCta: { label: 'Liên hệ kỹ thuật', link: '/feedback' }
  },
  'tich-hop-gis': {
    slug: 'tich-hop-gis',
    title: 'Tích hợp GIS',
    subtitle: 'Kết nối dữ liệu địa lý vào trải nghiệm người dùng',
    description: 'Mở rộng dữ liệu vị trí để phục vụ phân tích và trải nghiệm điều hướng.',
    highlights: ['Dữ liệu chuẩn hoá', 'Phân tích chuyên sâu', 'Tích hợp nhanh'],
    features: [
      { title: 'Lớp dữ liệu chuyên sâu', copy: 'Hỗ trợ phân tích mật độ và xu hướng khu vực.' },
      { title: 'Kết nối API mở', copy: 'Cho phép tích hợp dữ liệu từ các nguồn khác.' }
    ],
  cta: { label: 'Mở bản đồ GIS', link: '/city-map?lat=16.0471&lng=108.2068' },
    secondaryCta: { label: 'Xem chi tiết GIS', link: '/landing/tu-duy-gis' }
  }
};

const serviceDetails = {
  'giao-hang-thong-minh': {
    slug: 'giao-hang-thong-minh',
    title: 'Giao hàng thông minh',
    summary: 'Tự động tối ưu tuyến đường và thời gian giao.',
    description: 'Hệ thống điều phối giúp merchant giao hàng nhanh hơn với chi phí tối ưu.',
    highlights: ['Điều phối nhanh', 'Theo dõi realtime', 'Bảo đảm chất lượng'],
    steps: [
      { title: 'Nhận đơn tức thì', copy: 'Tự động tiếp nhận và phân loại đơn theo khu vực.' },
      { title: 'Tối ưu lộ trình', copy: 'Tự động tính toán tuyến đường ngắn nhất.' },
      { title: 'Theo dõi minh bạch', copy: 'Cập nhật trạng thái giao hàng theo thời gian thực.' }
    ],
    cta: { label: 'Liên hệ triển khai', link: '/feedback' }
  },
  'quang-cao-promotion': {
    slug: 'quang-cao-promotion',
    title: 'Quảng cáo & Promotion',
    summary: 'Nhắm đúng khách hàng theo vị trí và hành vi.',
    description: 'Công cụ tạo chiến dịch quảng bá, ưu đãi và theo dõi hiệu quả theo thời gian thực.',
    highlights: ['Nhắm đúng đối tượng', 'Tăng nhận diện', 'Báo cáo tức thì'],
    steps: [
      { title: 'Tạo chiến dịch', copy: 'Chọn khu vực, thời gian và nhóm khách hàng.' },
      { title: 'Theo dõi hiệu suất', copy: 'Xem số lượt hiển thị, click và chuyển đổi.' },
      { title: 'Tối ưu nhanh', copy: 'Điều chỉnh nội dung dựa trên dữ liệu thực tế.' }
    ],
    cta: { label: 'Đăng ký tư vấn', link: '/feedback' }
  },
  'module-linh-hoat': {
    slug: 'module-linh-hoat',
    title: 'Module linh hoạt',
    summary: 'Tuỳ biến nội dung theo từng chiến dịch.',
    description: 'Cho phép bật/tắt module theo chiến dịch mà không ảnh hưởng cấu trúc chung.',
    highlights: ['Linh hoạt triển khai', 'Không gián đoạn', 'Cấu hình nhanh'],
    steps: [
      { title: 'Bật/tắt module', copy: 'Kiểm soát module theo nhu cầu.' },
      { title: 'Tái sử dụng nhanh', copy: 'Tăng tốc triển khai với cấu hình mẫu.' },
      { title: 'Bảo trì dễ dàng', copy: 'Không ảnh hưởng các trang khác.' }
    ],
    cta: { label: 'Liên hệ kỹ thuật', link: '/feedback' }
  },
  'tich-hop-gis': {
    slug: 'tich-hop-gis',
    title: 'Tích hợp GIS',
    summary: 'Kết nối dữ liệu địa lý vào trải nghiệm người dùng.',
    description: 'Mở rộng dữ liệu vị trí để phục vụ phân tích và trải nghiệm điều hướng.',
    highlights: ['Dữ liệu chuẩn hoá', 'Phân tích chuyên sâu', 'Tích hợp nhanh'],
    steps: [
      { title: 'Chuẩn hoá dữ liệu', copy: 'Chuẩn bị dữ liệu địa lý theo chuẩn.' },
      { title: 'Hiển thị đa lớp', copy: 'Bật/tắt các lớp theo mục tiêu.' },
      { title: 'Phân tích sâu', copy: 'Hỗ trợ phân tích xu hướng khu vực.' }
    ],
    cta: { label: 'Mở bản đồ GIS', link: '/city-map?lat=16.0471&lng=108.2068' }
  }
};

router.get('/landing/details/:slug', (req, res) => {
  const { slug } = req.params || {};
  const detail = landingDetails[String(slug || '').trim()];

  if (!detail) {
    res.status(404).json({ message: 'Landing detail not found' });
    return;
  }

  res.json({ data: detail });
});

router.get('/landing/services/:slug', (req, res) => {
  const { slug } = req.params || {};
  const detail = serviceDetails[String(slug || '').trim()];

  if (!detail) {
    res.status(404).json({ message: 'Service detail not found' });
    return;
  }

  res.json({ data: detail });
});

module.exports = router;
