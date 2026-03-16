import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { submitFeedback } from '../../services/feedbackService';
import './FeedbackSupportPage.css';

const CATEGORY_OPTIONS = [
  { value: 'bug', label: 'Tính năng bị lỗi', labelEn: 'Feature is broken' },
  { value: 'feature', label: 'Yêu cầu tính năng mới', labelEn: 'Request a new feature' },
  { value: 'ui', label: 'Góp ý về giao diện mới', labelEn: 'UI/UX suggestion' },
  { value: 'data', label: 'Dữ liệu/bản đồ chưa đúng', labelEn: 'Data or map mismatch' },
  { value: 'performance', label: 'Hiệu năng/độ trễ', labelEn: 'Performance or latency' },
  { value: 'payment', label: 'Vấn đề thanh toán/đặt chỗ', labelEn: 'Payment / booking issues' },
  { value: 'other', label: 'Vấn đề khác', labelEn: 'Other issues' },
];

const COPY = {
  vi: {
    kicker: 'SMART CITY · TRUNG TÂM HỖ TRỢ',
    title: 'Góp ý & hỗ trợ',
    lead: 'Đây là nơi Smart City thu thập những ý kiến của bạn để cải thiện trải nghiệm người dùng. Nếu cần hỗ trợ ngay, liên hệ:',
    hotline: 'Hotline: 1900 **** · Email: support@smartcity.vn',
    categoryLabel: 'Loại vấn đề bạn muốn góp ý là',
    choose: 'Chọn loại vấn đề...',
    messageLabel: 'Nêu chi tiết ý kiến của bạn',
    placeholder: 'Câu trả lời của bạn...',
    email: 'Email liên hệ',
    phone: 'Số điện thoại',
    attach: 'Đính kèm file',
    hint: 'Hỗ trợ JPG, PNG, PDF · Tối đa 5MB',
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
    hotline: 'Hotline: 1900 **** · Email: support@smartcity.vn',
    categoryLabel: 'Choose a feedback type',
    choose: 'Select an issue type...',
    messageLabel: 'Describe your feedback',
    placeholder: 'Your message...',
    email: 'Contact email',
    phone: 'Phone',
    attach: 'Attach file',
    hint: 'Supports JPG, PNG, PDF · Up to 5MB',
    upload: 'Add file',
    submit: 'Send feedback',
    submitting: 'Sending...',
    requiredError: 'Please pick an issue type and add your details.',
    thank: 'Thank you! Your feedback has been recorded.',
    fail: 'Could not send feedback, please try again.'
  }
};

function FeedbackSupportPage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const t = COPY[language] || COPY.vi;

  const [form, setForm] = useState({
    category: '',
    message: '',
    contactEmail: user?.email || '',
    contactPhone: '',
    attachment: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [fieldErrors, setFieldErrors] = useState({ email: false, phone: false });

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    setField('attachment', file || null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: '', message: '' });

    const emailValid = form.contactEmail.trim().toLowerCase().endsWith('@gmail.com');
    const phoneDigits = form.contactPhone.replace(/\D/g, '');
    const phoneValid = phoneDigits.length === 10;

    setFieldErrors({ email: !emailValid, phone: !phoneValid });

    if (!form.category || !form.message.trim()) {
      return setStatus({ type: 'error', message: t.requiredError });
    }

    if (!emailValid) {
      return setStatus({ type: 'error', message: language === 'en' ? 'Email must end with @gmail.com' : 'Email phải kết thúc bằng @gmail.com' });
    }

    if (!phoneValid) {
      return setStatus({ type: 'error', message: language === 'en' ? 'Phone number is invalid' : 'Số điện thoại không hợp lệ' });
    }

    try {
      setSubmitting(true);
      await submitFeedback({ ...form, contactPhone: phoneDigits });
      setStatus({ type: 'success', message: t.thank });
      setForm((prev) => ({ ...prev, message: '', category: '', attachment: null }));
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
              value={form.category}
              onChange={(e) => setField('category', e.target.value)}
            >
              <option value="">{t.choose}</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {language === 'en' ? option.labelEn : option.label}
                </option>
              ))}
            </select>
          </div>

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
              <label className="feedback-label" htmlFor="feedback-email">{t.email} <span className="required">*</span></label>
              <input
                id="feedback-email"
                type="email"
                className={`feedback-input ${fieldErrors.email ? 'invalid' : ''}`}
                value={form.contactEmail}
                onChange={(e) => {
                  setField('contactEmail', e.target.value);
                  setFieldErrors((prev) => ({ ...prev, email: false }));
                }}
                placeholder="name@gmail.com"
              />
            </div>
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
