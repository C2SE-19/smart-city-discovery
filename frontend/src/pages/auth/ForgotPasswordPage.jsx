import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './forgot-password.css';
import vietnamImage from '../../assets/images/vietnam.png';
import { FaEnvelope, FaArrowLeft, FaCheckCircle } from 'react-icons/fa';
import { useLanguage } from '../../contexts/LanguageContext';
import translations from '../../constants/translations';
import authService from '../../services/authService';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showEmailSent, setShowEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = translations[language];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setShowEmailSent(false);

    // Validation
    if (!email.trim()) {
      setError('Vui lòng nhập địa chỉ email');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Vui lòng nhập email hợp lệ');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.forgotPassword(email.trim());

      setSuccess(true);
      setShowEmailSent(true);
      setSentEmail(email.trim());
      setEmail('');

      // Auto close after 5 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 5000);
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
      setError(errorMsg);
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-container">
      {/* LEFT SIDE - VIETNAM IMAGE */}
      <div className="forgot-password-left">
        <img src={vietnamImage} alt="Vietnam Map" className="vietnam-map" />
      </div>

      {/* RIGHT SIDE - FORM */}
      <div className="forgot-password-right">
        <div className="forgot-password-box">
          {/* HEADER */}
          <div className="forgot-password-header">
            <h1 className="forgot-password-title">Quên mật khẩu?</h1>
            <p className="forgot-password-subtitle">
              Đừng lo lắng! Chúng tôi sẽ giúp bạn khôi phục tài khoản của mình.
            </p>
          </div>

          {/* SUCCESS MESSAGE */}
          {showEmailSent && (
            <div className="success-message-box">
              <FaCheckCircle className="success-icon" />
              <h3>Kiểm tra email của bạn</h3>
              <p>
                Chúng tôi đã gửi một liên kết đặt lại mật khẩu đến <strong>{sentEmail}</strong>
              </p>
              <p className="small-text">Liên kết này sẽ hết hạn trong 1 giờ.</p>
            </div>
          )}

          {/* FORM */}
          {!showEmailSent && (
            <form onSubmit={handleSubmit} className="forgot-password-form">
              {/* ERROR MESSAGE */}
              {error && (
                <div className="error-message">
                  <p>{error}</p>
                </div>
              )}

              {/* EMAIL INPUT */}
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Địa chỉ Email
                </label>
                <div className="input-wrapper">
                  <FaEnvelope className="input-icon" />
                  <input
                    id="email"
                    type="email"
                    placeholder="Nhập email của bạn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                className="btn-submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Đang gửi...
                  </>
                ) : (
                  'Gửi liên kết đặt lại mật khẩu'
                )}
              </button>

              {/* DIVIDER */}
              <div className="divider">
                <span>hoặc</span>
              </div>

              {/* BACK TO LOGIN */}
              <button
                type="button"
                className="btn-back"
                onClick={() => navigate('/login')}
              >
                <FaArrowLeft className="arrow-icon" />
                Quay lại đăng nhập
              </button>
            </form>
          )}

          {/* BACK TO LOGIN AFTER SUCCESS */}
          {showEmailSent && (
            <button
              type="button"
              className="btn-back"
              onClick={() => navigate('/login')}
            >
              <FaArrowLeft className="arrow-icon" />
              Quay lại đăng nhập
            </button>
          )}

          {/* HELP TEXT */}
          <div className="help-text">
            <p>Không nhận được email?</p>
            <ul>
              <li>Kiểm tra thư mục Spam/Junk</li>
              <li>Đảm bảo bạn nhập đúng email</li>
              <li>Liên hệ với bộ phận hỗ trợ nếu còn có vấn đề</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
