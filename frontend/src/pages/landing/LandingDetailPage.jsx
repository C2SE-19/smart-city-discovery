import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchLandingDetail } from '../../services/api/landingDetailApi';
import { APP_ROUTES } from '../../constants/routes';
import landingDiscover from '../../assets/images/landing/landing-discover.svg';
import landingMerchant from '../../assets/images/landing/landing-merchant.svg';
import landingGis from '../../assets/images/landing/landing-gis.svg';
import cityFood from '../../assets/images/landing/city-food.svg';
import cityLandmark from '../../assets/images/landing/city-landmark.svg';
import cityRoute from '../../assets/images/landing/city-route.svg';
import serviceHero from '../../assets/images/landing/service-hero.svg';
import servicePromo from '../../assets/images/landing/service-promo.svg';
import './LandingDetailPage.css';

const DETAIL_IMAGES = {
  'kham-pha-dia-phuong': landingDiscover,
  'ho-tro-cua-hang': landingMerchant,
  'tu-duy-gis': landingGis,
  'dich-vu-tong-quan': serviceHero,
  'khu-am-thuc': cityFood,
  'dia-danh-noi-bat': cityLandmark,
  'lo-trinh-goi-y': cityRoute,
  'giao-hang-thong-minh': serviceHero,
  'quang-cao-promotion': servicePromo,
  'module-linh-hoat': serviceHero,
  'tich-hop-gis': landingGis
};

const LOCAL_DETAILS = {
  'kham-pha-dia-phuong': {
    slug: 'kham-pha-dia-phuong',
    title: 'Khám phá địa phương thông minh',
    subtitle: 'Tìm nhanh món ngon, điểm check-in và trải nghiệm nổi bật',
    description: 'Kết hợp dữ liệu địa điểm, đánh giá cộng đồng và gợi ý theo sở thích để bạn khám phá thành phố dễ dàng hơn.',
    highlights: ['Tìm kiếm nhanh', 'Gợi ý cá nhân hoá', 'Bản đồ trực quan'],
  cta: { label: 'Khám phá bản đồ', link: '/city-map?lat=16.0471&lng=108.2068' },
  secondaryCta: { label: 'Xem danh sách địa điểm', link: '/places' },
    features: [
      { title: 'Bộ lọc linh hoạt', copy: 'Chọn nhanh theo danh mục, quận/huyện, dịch vụ và thời gian mở cửa.' },
      { title: 'Gợi ý theo hành vi', copy: 'Hệ thống đề xuất địa điểm dựa trên sở thích và lịch sử tìm kiếm.' },
      { title: 'Trải nghiệm bản đồ sống', copy: 'Theo dõi vị trí và điểm đến nổi bật ngay trên bản đồ thời gian thực.' }
    ]
  },
  'ho-tro-cua-hang': {
    slug: 'ho-tro-cua-hang',
    title: 'Hỗ trợ cửa hàng phát triển',
    subtitle: 'Tăng hiển thị thương hiệu và tiếp cận khách hàng tiềm năng',
    description: 'Bộ công cụ dành cho merchant giúp quản lý thông tin, ưu đãi và theo dõi hiệu quả tương tác.',
    highlights: ['Trang quản lý riêng', 'Ưu đãi nổi bật', 'Báo cáo hiệu quả'],
    cta: { label: 'Mở trang merchant', link: '/merchant' },
    secondaryCta: { label: 'Liên hệ hỗ trợ', link: '/feedback' },
    features: [
      { title: 'Hồ sơ cửa hàng đầy đủ', copy: 'Thêm hình ảnh, menu, dịch vụ và thông tin liên hệ chỉ trong vài phút.' },
      { title: 'Chiến dịch khuyến mãi', copy: 'Tạo ưu đãi và hiển thị đúng khách hàng theo khu vực.' },
      { title: 'Theo dõi tương tác', copy: 'Thống kê lượt xem, lượt yêu thích và phản hồi theo thời gian.' }
    ]
  },
  'tu-duy-gis': {
    slug: 'tu-duy-gis',
    title: 'Tư duy GIS cho đô thị hiện đại',
    subtitle: 'Nền tảng bản đồ nhiều lớp dữ liệu',
    description: 'Tích hợp dữ liệu hành chính, địa điểm, dịch vụ để xây dựng hệ sinh thái bản đồ linh hoạt.',
    highlights: ['Lớp dữ liệu rõ ràng', 'Tích hợp phân tích', 'Mở rộng dễ dàng'],
  cta: { label: 'Mở bản đồ GIS', link: '/city-map?lat=16.0471&lng=108.2068' },
    secondaryCta: { label: 'Xem tài liệu', link: '/about' },
    features: [
      { title: 'Chuẩn hoá dữ liệu địa lý', copy: 'Dễ dàng liên kết dữ liệu hành chính và phân vùng dịch vụ.' },
      { title: 'Hiển thị đa lớp', copy: 'Cho phép bật/tắt các lớp thông tin phù hợp nhu cầu.' },
      { title: 'Sẵn sàng mở rộng', copy: 'Hỗ trợ tích hợp dữ liệu mới cho các dự án đô thị thông minh.' }
    ]
  },
  'dich-vu-tong-quan': {
    slug: 'dich-vu-tong-quan',
    title: 'Khám phá hệ dịch vụ Smart City',
    subtitle: 'Nền tảng kết nối người dùng, cửa hàng và dữ liệu bản đồ',
    description: 'Tổng hợp các module giao hàng, quảng bá và quản trị nội dung giúp vận hành hệ sinh thái thành phố.',
    highlights: ['Module linh hoạt', 'Quy trình tự động', 'Báo cáo rõ ràng'],
    cta: { label: 'Xem các dịch vụ', link: '/service' },
    secondaryCta: { label: 'Liên hệ tư vấn', link: '/feedback' },
    features: [
      { title: 'Quản lý dịch vụ tập trung', copy: 'Theo dõi trạng thái đơn hàng, chiến dịch và dữ liệu vận hành từ một nơi.' },
      { title: 'Tối ưu trải nghiệm', copy: 'Hỗ trợ cá nhân hoá đề xuất và nâng cao tỷ lệ chuyển đổi.' },
      { title: 'Kết nối hệ sinh thái', copy: 'Sẵn sàng tích hợp các bên thứ ba trong tương lai.' }
    ]
  }
};

const DEFAULT_DETAIL = {
  title: 'Khám phá Smart City Discovery',
  subtitle: 'Giải pháp khám phá địa phương thông minh',
  description: 'Kết nối người dùng, cửa hàng và hệ thống bản đồ trong một nền tảng duy nhất.',
  highlights: ['Tìm kiếm nhanh', 'Dữ liệu cập nhật', 'Trải nghiệm thân thiện'],
  features: []
};

function LandingDetailPage() {
  const { slug } = useParams();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadDetail = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await fetchLandingDetail(slug);
        if (isMounted) {
          setDetail(data || null);
        }
      } catch {
        if (isMounted) {
          setDetail(LOCAL_DETAILS[slug] || null);
          setError('');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDetail();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const displayDetail = useMemo(() => detail || LOCAL_DETAILS[slug] || DEFAULT_DETAIL, [detail, slug]);
  const heroImage = DETAIL_IMAGES[displayDetail.slug] || DETAIL_IMAGES[slug] || landingDiscover;

  const renderCta = (cta, className) => {
    if (!cta?.link) {
      return null;
    }

    if (cta.link.startsWith('/')) {
      return (
        <Link to={cta.link} className={className}>
          {cta.label}
        </Link>
      );
    }

    return (
      <a href={cta.link} className={className}>
        {cta.label}
      </a>
    );
  };

  return (
    <section className="landing-detail">
      <div className="landing-detail-hero">
        <div className="landing-detail-hero-text">
          <span className="landing-detail-kicker">Smart City Discovery</span>
          <h2>{displayDetail.title}</h2>
          <p className="landing-detail-subtitle">{displayDetail.subtitle}</p>
          <p className="landing-detail-description">{displayDetail.description}</p>
          <div className="landing-detail-tags">
            {(displayDetail.highlights || []).map((item, index) => (
              <span key={`${item}-${index}`} className="landing-detail-tag">
                {item}
              </span>
            ))}
          </div>
          <div className="landing-detail-actions">
            {renderCta(displayDetail.cta, 'landing-detail-primary')}
            {renderCta(displayDetail.secondaryCta, 'landing-detail-secondary')}
            {!displayDetail.cta && (
              <Link to={APP_ROUTES.ABOUT} className="landing-detail-secondary">
                Quay lại giới thiệu
              </Link>
            )}
          </div>
          {error && <p className="landing-detail-error">{error}</p>}
        </div>
        <div className="landing-detail-hero-image">
          <img src={heroImage} alt={displayDetail.title} loading="lazy" />
        </div>
      </div>

      {loading && <div className="landing-detail-loading">Đang tải nội dung...</div>}

      {!loading && displayDetail.features?.length > 0 && (
        <div className="landing-detail-features">
          {displayDetail.features.map((feature, index) => (
            <article key={`${feature.title}-${index}`} className="landing-detail-feature-card">
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
            </article>
          ))}
        </div>
      )}

      {!loading && !displayDetail.features?.length && (
        <div className="landing-detail-empty">
          <p>Nội dung chi tiết đang được cập nhật thêm. Bạn có thể quay lại sau.</p>
          <Link to={APP_ROUTES.HOME} className="landing-detail-secondary">
            Về trang chủ
          </Link>
        </div>
      )}
    </section>
  );
}

export default LandingDetailPage;
