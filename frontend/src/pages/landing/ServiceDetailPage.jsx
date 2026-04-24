import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchLandingServiceDetail } from '../../services/api/landingServiceApi';
import { APP_ROUTES } from '../../constants/routes';
import serviceHero from '../../assets/images/landing/service-hero.svg';
import servicePromo from '../../assets/images/landing/service-promo.svg';
import landingGis from '../../assets/images/landing/landing-gis.svg';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { SERVICE_DETAIL_I18N } from '../../locales/landing.i18n';
import './ServiceDetailPage.css';

const SERVICE_IMAGES = {
  'giao-hang-thong-minh': serviceHero,
  'quang-cao-promotion': servicePromo,
  'module-linh-hoat': serviceHero,
  'tich-hop-gis': landingGis
};

const getLocalServiceDetails = (language) => {
  const i18n = SERVICE_DETAIL_I18N[language] || SERVICE_DETAIL_I18N.vi;
  return {
    'giao-hang-thong-minh': {
      slug: 'giao-hang-thong-minh',
      title: i18n['giao-hang-thong-minh'].title,
      summary: i18n['giao-hang-thong-minh'].summary,
      description: i18n['giao-hang-thong-minh'].description,
      highlights: i18n['giao-hang-thong-minh'].highlights,
      steps: i18n['giao-hang-thong-minh'].steps,
      cta: { label: i18n['giao-hang-thong-minh'].ctaLabel, link: '/feedback' }
    },
    'quang-cao-promotion': {
      slug: 'quang-cao-promotion',
      title: i18n['quang-cao-promotion'].title,
      summary: i18n['quang-cao-promotion'].summary,
      description: i18n['quang-cao-promotion'].description,
      highlights: i18n['quang-cao-promotion'].highlights,
      steps: i18n['quang-cao-promotion'].steps,
      cta: { label: i18n['quang-cao-promotion'].ctaLabel, link: '/feedback' }
    },
    'module-linh-hoat': {
      slug: 'module-linh-hoat',
      title: i18n['module-linh-hoat'].title,
      summary: i18n['module-linh-hoat'].summary,
      description: i18n['module-linh-hoat'].description,
      highlights: i18n['module-linh-hoat'].highlights,
      steps: i18n['module-linh-hoat'].steps,
      cta: { label: i18n['module-linh-hoat'].ctaLabel, link: '/feedback' }
    },
    'tich-hop-gis': {
      slug: 'tich-hop-gis',
      title: i18n['tich-hop-gis'].title,
      summary: i18n['tich-hop-gis'].summary,
      description: i18n['tich-hop-gis'].description,
      highlights: i18n['tich-hop-gis'].highlights,
      steps: i18n['tich-hop-gis'].steps,
      cta: { label: i18n['tich-hop-gis'].ctaLabel, link: '/city-map?lat=16.0471&lng=108.2068' }
    }
  };
};

const DEFAULT_SERVICE = {
  title: 'Service',
  summary: 'Loading...',
  description: 'Please wait',
  highlights: [],
  steps: [],
  cta: { label: 'Learn more', link: '#' }
};

function ServiceDetailPage() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const { slug } = useParams();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  const localServices = useMemo(() => getLocalServiceDetails(language), [language]);

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
          setDetail(localServices[slug] || null);
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
  }, [slug, localServices]);

  const displayDetail = useMemo(
    () => detail || localServices[slug] || localServices['giao-hang-thong-minh'] || DEFAULT_SERVICE,
    [detail, slug, localServices]
  );
  const heroImage = SERVICE_IMAGES[displayDetail.slug] || serviceHero;
  const i18nData = SERVICE_DETAIL_I18N[language] || SERVICE_DETAIL_I18N.vi;

  return (
    <section className={`service-detail theme-${theme}`}>
      <div className="service-detail-hero">
        <div className="service-detail-text">
          <span className="service-detail-kicker">{i18nData.kicker}</span>
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
              {i18nData.backButton}
            </Link>
          </div>
        </div>
        <div className="service-detail-hero-image">
          <img src={heroImage} alt={displayDetail.title} loading="lazy" />
        </div>
      </div>

      {loading && <div className="service-detail-loading">{i18nData.loadingText}</div>}

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
