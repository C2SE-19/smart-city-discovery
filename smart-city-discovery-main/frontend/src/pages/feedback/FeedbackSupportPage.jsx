import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { fetchFeedbackTypes, submitFeedback } from '../../services/feedbackService';
import './FeedbackSupportPage.css';

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

const COPY = {
  vi: {
    kicker: 'SMART CITY · TRUNG TÂM HỖ TRỢ',
    title: 'Góp ý & hỗ trợ',
    lead: 'Đây là nơi Smart City thu thập những ý kiến của bạn để cải thiện trải nghiệm người dùng. Nếu cần hỗ trợ ngay, liên hệ:',
    hotline: 'Hotline: 0787606053 · Email: smartcity.discovery2026@gmail.com',
    categoryLabel: 'Loại vấn đề bạn muốn góp ý là',
    loadingTypes: 'Đang tải loại phản hồi...',
    noTypes: 'Chưa có loại phản hồi khả dụng',
    typeLoadFail: 'Không thể tải loại phản hồi. Vui lòng thử lại.',
    choose: 'Chọn loại vấn đề...',
    messageLabel: 'Nêu chi tiết ý kiến của bạn',
    placeholder: 'Câu trả lời của bạn...',
    phone: 'Số điện thoại',
  attach: 'Đính kèm file',
  hint: 'Hỗ trợ JPG, PNG, PDF · Tối đa 15MB',
  fileTooLarge: 'Kích thước tệp vượt quá 15MB. Vui lòng chọn tệp nhỏ hơn.',
    upload: 'Thêm tệp',
    submit: 'Gửi góp ý',
    submitting: 'Đang gửi...',
    requiredError: 'Vui lòng chọn loại vấn đề và nêu chi tiết ý kiến.',
    thank: 'Cảm ơn bạn! Ý kiến đã được ghi nhận.',
    fail: 'Gửi góp ý thất bại, vui lòng thử lại.'
  },
  en: {
    kicker: 'SMART CITY · SUPPORT DESK',
    title: 'Feedback & Support',
    lead: 'Smart City collects your feedback to improve the experience. For urgent help, please contact:',
    hotline: 'Hotline: 0787606053 · Email: smartcity.discovery2026@gmail.com',
    categoryLabel: 'Choose a feedback type',
    loadingTypes: 'Loading feedback types...',
    noTypes: 'No feedback types available',
    typeLoadFail: 'Could not load feedback types. Please try again.',
    choose: 'Select an issue type...',
    messageLabel: 'Describe your feedback',
    placeholder: 'Your message...',
    phone: 'Phone',
  attach: 'Attach file',
  hint: 'Supports JPG, PNG, PDF · Up to 15MB',
  fileTooLarge: 'File size exceeds 15MB. Please choose a smaller file.',
    upload: 'Add file',
    submit: 'Send feedback',
    submitting: 'Sending...',
    requiredError: 'Please pick an issue type and add your details.',
    thank: 'Thank you! Your feedback has been recorded.',
    fail: 'Could not send feedback, please try again.'
  }
};

function FeedbackSupportPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const t = COPY[language] || COPY.vi;

  const [form, setForm] = useState({
    feedbackTypeValue: '',
    message: '',
    contactPhone: '',
    attachment: null,
  });
  const [feedbackTypes, setFeedbackTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [typeLoadError, setTypeLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [fieldErrors, setFieldErrors] = useState({ phone: false });

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    let isMounted = true;

    const loadFeedbackTypes = async () => {
      try {
        setLoadingTypes(true);
        setTypeLoadError('');
        const rows = await fetchFeedbackTypes();

        if (!isMounted) {
          return;
        }

        const normalizedRows = Array.isArray(rows) ? rows : [];
        setFeedbackTypes(normalizedRows);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setFeedbackTypes([]);
        setTypeLoadError(error?.response?.data?.message || t.typeLoadFail);
      } finally {
        if (isMounted) {
          setLoadingTypes(false);
        }
      }
    };

    loadFeedbackTypes();

    const pollingTimerId = window.setInterval(() => {
      loadFeedbackTypes();
    }, 7000);

    return () => {
      isMounted = false;
      window.clearInterval(pollingTimerId);
    };
  }, [t.typeLoadFail]);

  const selectedFeedbackType = useMemo(
    () => feedbackTypes.find((option) => String(option.id ?? option.code) === form.feedbackTypeValue) || null,
    [feedbackTypes, form.feedbackTypeValue]
  );

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file && file.size > MAX_FILE_SIZE) {
      setStatus({ type: 'error', message: t.fileTooLarge });
      event.target.value = '';
      setField('attachment', null);
      return;
    }
    setField('attachment', file || null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: '', message: '' });

    const phoneDigits = form.contactPhone.replace(/\D/g, '');
    const phoneValid = phoneDigits.length === 10;

    setFieldErrors({ phone: !phoneValid });

    if (!form.feedbackTypeValue || !form.message.trim()) {
      return setStatus({ type: 'error', message: t.requiredError });
    }

    if (!phoneValid) {
      return setStatus({ type: 'error', message: language === 'en' ? 'Phone number is invalid' : 'Số điện thoại không hợp lệ' });
    }

    try {
      setSubmitting(true);
      await submitFeedback({
        feedbackTypeId: selectedFeedbackType?.id ?? null,
        category: selectedFeedbackType?.code || form.feedbackTypeValue,
        message: form.message,
        contactEmail: user?.email || '',
        contactPhone: phoneDigits,
        attachment: form.attachment,
      });
      setStatus({ type: 'success', message: t.thank });
      setForm((prev) => ({ ...prev, message: '', feedbackTypeValue: '', contactPhone: '', attachment: null }));
      const fileInput = document.getElementById('feedback-attachment');
      if (fileInput) fileInput.value = '';
    } catch (error) {
      setStatus({ type: 'error', message: error?.response?.data?.message || t.fail });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`feedback-shell theme-${theme}`}>
      <div className="feedback-card">
        <button type="button" className="feedback-back" onClick={() => navigate(-1)}>
          ← {language === 'vi' ? 'Quay lại' : 'Back'}
        </button>
        <div className="feedback-header">
          <p className="feedback-kicker">{t.kicker}</p>
          <h1 className="feedback-title">{t.title}</h1>
          <div className="feedback-underline" />
          <p className="feedback-lead">{t.lead}</p>
          <p className="feedback-contact">{t.hotline}</p>
        </div>

        <form className="feedback-form" onSubmit={handleSubmit}>
          <label className="feedback-label" htmlFor="feedback-category">
            {t.categoryLabel} <span className="required">*</span>
          </label>
          <div className="feedback-select-wrapper">
            <select
              id="feedback-category"
              className="feedback-select"
              value={form.feedbackTypeValue}
              onChange={(e) => setField('feedbackTypeValue', e.target.value)}
              disabled={loadingTypes || feedbackTypes.length === 0}
            >
              <option value="">
                {loadingTypes ? t.loadingTypes : feedbackTypes.length ? t.choose : t.noTypes}
              </option>
              {feedbackTypes.map((option) => (
                <option key={option.id ?? option.code} value={String(option.id ?? option.code)}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          {!!typeLoadError && (
            <div className="feedback-status error">
              {typeLoadError}
            </div>
          )}

          <label className="feedback-label" htmlFor="feedback-message">
            {t.messageLabel} <span className="required">*</span>
          </label>
          <div className="feedback-textarea-wrapper">
            <textarea
              id="feedback-message"
              className="feedback-textarea"
              placeholder={t.placeholder}
              value={form.message}
              onChange={(e) => setField('message', e.target.value)}
              rows={4}
              required
            />
            <div className="feedback-textarea-resize" aria-hidden="true">↔</div>
          </div>

          <div className="feedback-grid">
            <div className="feedback-field">
              <label className="feedback-label" htmlFor="feedback-phone">{t.phone} <span className="required">*</span></label>
              <input
                id="feedback-phone"
                type="tel"
                className={`feedback-input ${fieldErrors.phone ? 'invalid' : ''}`}
                value={form.contactPhone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setField('contactPhone', digits);
                  setFieldErrors((prev) => ({ ...prev, phone: false }));
                }}
                placeholder="0901 234 567"
              />
            </div>
          </div>

          <div className="feedback-attachment-row">
            <div>
              <span className="feedback-label">{t.attach}</span>
              <p className="feedback-hint">{t.hint}</p>
            </div>
            <label className="feedback-upload-button" htmlFor="feedback-attachment">
              <span className="upload-icon">⬆</span>
              <span>{form.attachment ? form.attachment.name : t.upload}</span>
              <input id="feedback-attachment" type="file" accept=".png,.jpg,.jpeg,.pdf" onChange={handleFileChange} />
            </label>
          </div>

          {status.message && (
            <div className={`feedback-status ${status.type}`}>
              {status.message}
            </div>
          )}

          <button className="feedback-submit" type="submit" disabled={submitting}>
            {submitting ? t.submitting : t.submit}
          </button>
        </form>
      </div>
    </div>
  );
}

export default FeedbackSupportPage;
