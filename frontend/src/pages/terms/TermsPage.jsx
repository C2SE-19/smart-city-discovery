import { useEffect, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import translations from '../../constants/translations';
import { fetchTerms } from '../../services/termsService';
import './TermsPage.css';

const EN_SECTIONS = [
  {
    heading: 'General rules of SMART CITY DISCOVERY',
    items: [
      {
        title: 'Do not post misleading information.',
        description: 'Users must ensure all details about locations, services, or uploaded content are accurate and not misleading to others.'
      },
      {
        title: 'No harassment or offensive behavior.',
        description: 'Do not use the platform to post offensive, discriminatory, or harmful content that negatively impacts others.'
      },
      {
        title: 'Protect personal data.',
        description: 'Do not share another person\'s personal information without their consent.'
      },
      {
        title: 'Respect content copyrights.',
        description: 'Do not upload images, videos, or content owned by others without permission.'
      },
      {
        title: 'Comply with applicable laws.',
        description: 'All activities on the platform must follow Vietnamese laws and related regulations.'
      }
    ]
  },
  {
    heading: 'Rules for place/content posters',
    items: [
      {
        title: 'Accurate information.',
        description: 'Posters must provide correct details about the venue name, service type, location, and related descriptions.'
      },
      {
        title: 'Clear images.',
        description: 'Venue or service images must be real and not unrelated or misleading.'
      },
      {
        title: 'Appropriate content.',
        description: 'Uploaded content must fit the platform\'s purpose, avoiding offensive material, false ads, or spam.'
      },
      {
        title: 'Cooperate with admins.',
        description: 'Posters need to cooperate with admins to verify information or adjust content when required.'
      }
    ]
  },
  {
    heading: 'Rules for platform users',
    items: [
      {
        title: 'Verify information.',
        description: 'Users should check venue details and community reviews before using services.'
      },
      {
        title: 'Use the platform correctly.',
        description: 'Do not abuse the platform for spam, illegal advertising, or actions that harm others\' experience.'
      },
      {
        title: 'Provide feedback after using.',
        description: 'Users are encouraged to leave reviews to help the community make better decisions.'
      },
      {
        title: 'Report violations.',
        description: 'If you find incorrect, spammy, or violating content, report it to admins for timely handling.'
      }
    ]
  }
];

function TermsPage() {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const t = translations[language];
  const [terms, setTerms] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    fetchTerms()
      .then((data) => {
        if (isMounted) {
          setTerms(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || 'Không thể tải điều khoản');
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const headline = t?.termsPage?.title || (language === 'en' ? 'Terms of Use' : 'Điều khoản sử dụng');
  const introFallback = t?.termsPage?.intro
    || (language === 'en'
      ? 'Please review these rules to use the platform responsibly.'
      : 'Vui lòng đọc kỹ các quy định sau trước khi sử dụng nền tảng.');
  const lastUpdatedLabel = t?.termsPage?.lastUpdated || (language === 'en' ? 'Last updated' : 'Cập nhật');

  const localizedSections = language === 'en' ? EN_SECTIONS : terms?.sections;

  return (
    <div className={`terms-shell theme-${theme}`}>
      <div className="terms-card">
        <header className="terms-header">
          <p className="terms-kicker">SMART CITY DISCOVERY</p>
          <h1 className="terms-title">{headline}</h1>
          <div className="terms-underline" />
          <p className="terms-lead">{terms?.intro || introFallback}</p>
          <p className="terms-updated">{lastUpdatedLabel}: {terms?.lastUpdated || '—'}</p>
        </header>

        {loading && <div className="terms-status">{language === 'en' ? 'Loading terms...' : 'Đang tải điều khoản...'}</div>}
        {error && <div className="terms-status error">{error}</div>}

        {!loading && !error && localizedSections && (
          <div className="terms-sections">
            {localizedSections.map((section) => (
              <section key={section.heading} className="terms-section">
                <h2 className="terms-section-title">{section.heading}</h2>
                <ul className="terms-list">
                  {section.items?.map((item) => (
                    <li key={item.title} className="terms-item">
                      <div className="terms-item-title">{item.title}</div>
                      <p className="terms-item-desc">{item.description}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TermsPage;
