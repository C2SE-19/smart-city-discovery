import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchLandingServiceDetail } from '../../services/api/landingServiceApi';
import { APP_ROUTES } from '../../constants/routes';
import serviceHero from '../../assets/images/landing/service-hero.svg';
import servicePromo from '../../assets/images/landing/service-promo.svg';
import landingGis from '../../assets/images/landing/landing-gis.svg';
import './ServiceDetailPage.css';

const SERVICE_IMAGES = {
  'giao-hang-thong-minh': serviceHero,
  'quang-cao-promotion': servicePromo,
  'module-linh-hoat': serviceHero,
  'tich-hop-gis': landingGis
};

const LOCAL_SERVICE_DETAILS = {
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

function ServiceDetailPage() {
  const { slug } = useParams();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadDetail = async () => {
      setLoading(true);
      try {
        const data = await fetchLandingServiceDetail(slug);
        if (isMounted) {
          setDetail(data || null);
        }
      } catch {
        if (isMounted) {
          setDetail(LOCAL_SERVICE_DETAILS[slug] || null);
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

  const displayDetail = useMemo(
    () => detail || LOCAL_SERVICE_DETAILS[slug] || LOCAL_SERVICE_DETAILS['giao-hang-thong-minh'],
    [detail, slug]
  );
  const heroImage = SERVICE_IMAGES[displayDetail.slug] || serviceHero;

  return (
    <section className="service-detail">
      <div className="service-detail-hero">
        <div className="service-detail-text">
          <span className="service-detail-kicker">Dịch vụ Smart City</span>
          <h2>{displayDetail.title}</h2>
          <p className="service-detail-summary">{displayDetail.summary}</p>
          <p className="service-detail-description">{displayDetail.description}</p>
          <div className="service-detail-tags">
            {displayDetail.highlights.map((item) => (
              <span key={item} className="service-detail-tag">{item}</span>
            ))}
          </div>
          <div className="service-detail-actions">
            {displayDetail.cta?.link && (
              <Link to={displayDetail.cta.link} className="service-detail-primary">
                {displayDetail.cta.label}
              </Link>
            )}
            <Link to={APP_ROUTES.SERVICE} className="service-detail-secondary">
              Quay lại dịch vụ
            </Link>
          </div>
        </div>
        <div className="service-detail-hero-image">
          <img src={heroImage} alt={displayDetail.title} loading="lazy" />
        </div>
      </div>

      {loading && <div className="service-detail-loading">Đang tải nội dung...</div>}

      {!loading && (
        <div className="service-detail-steps">
          {displayDetail.steps.map((step, index) => (
            <article key={`${step.title}-${index}`} className="service-detail-step">
              <div className="service-detail-step-index">0{index + 1}</div>
              <div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default ServiceDetailPage;
