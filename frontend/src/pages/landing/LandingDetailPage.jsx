import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { fetchLandingDetail } from '../../services/api/landingDetailApi';
import { APP_ROUTES } from '../../constants/routes';
import { LANDING_DETAIL_I18N } from '../../locales/landing.i18n';
import './LandingDetailPage.css';
import img12 from '../../assets/images/landing/12.png';
import img13 from '../../assets/images/landing/13.png';
import img14 from '../../assets/images/landing/14.png';
import img15 from '../../assets/images/landing/15.png';

const DETAIL_IMAGES = {
  'kham-pha-dia-phuong': img12,
  'ho-tro-cua-hang': img13,
  'tu-duy-gis': img14,
  'dich-vu-tong-quan': img15,
  'khu-am-thuc': '/images/landing/city-food.svg',
  'dia-danh-noi-bat': '/images/landing/city-landmark.svg',
  'lo-trinh-goi-y': '/images/landing/city-route.svg',
  'giao-hang-thong-minh': '/images/landing/service-hero.svg',
  'quang-cao-promotion': '/images/landing/service-promo.svg',
  'module-linh-hoat': '/images/landing/service-hero.svg',
  'tich-hop-gis': '/images/landing/landing-gis.svg'
};

const getLocalDetails = (language) => {
  return LANDING_DETAIL_I18N[language] || LANDING_DETAIL_I18N.vi;
};

const DEFAULT_DETAIL = {
  title: 'Smart City Discovery',
  subtitle: 'Discover smart local solutions',
  description: 'Connect users, merchants and map systems in one platform.',
  highlights: ['Quick search', 'Updated data', 'User-friendly'],
  features: []
};

function LandingDetailPage() {
  const { slug } = useParams();
  const { language } = useLanguage();
  const { theme } = useTheme();
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
          const localDetails = getLocalDetails(language);
          setDetail(localDetails[slug] || null);
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
  }, [slug, language]);

  const localDetails = useMemo(() => getLocalDetails(language), [language]);
  const displayDetail = useMemo(
    () => detail || localDetails[slug] || DEFAULT_DETAIL,
    [detail, slug, localDetails]
  );
  const heroImage = DETAIL_IMAGES[displayDetail.slug] || DETAIL_IMAGES[slug] || '/images/landing/kham-pha-dia-phuong.png';

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
    <section className={`landing-detail theme-${theme}`}>
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
                {language === 'vi' ? 'Quay lại giới thiệu' : 'Back to introduction'}
              </Link>
            )}
          </div>
          {error && <p className="landing-detail-error">{error}</p>}
        </div>
        <div className="landing-detail-hero-image">
          <img src={heroImage} alt={displayDetail.title} loading="lazy" />
        </div>
      </div>

      {loading && (
        <div className="landing-detail-loading">
          {language === 'vi' ? 'Đang tải nội dung...' : 'Loading content...'}
        </div>
      )}

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
          <p>
            {language === 'vi'
              ? 'Nội dung chi tiết đang được cập nhật thêm. Bạn có thể quay lại sau.'
              : 'Detailed content is being updated. Please come back later.'}
          </p>
          <Link to={APP_ROUTES.HOME} className="landing-detail-secondary">
            {language === 'vi' ? 'Về trang chủ' : 'Back home'}
          </Link>
        </div>
      )}
    </section>
  );
}

export default LandingDetailPage;
