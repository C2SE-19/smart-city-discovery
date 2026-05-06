import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './reset-password.css';
import vietnamImage from '../../assets/images/vietnam.png';
import logo from '../../assets/images/logo.png';
import { FaLock, FaArrowLeft, FaEye, FaEyeSlash, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { useLanguage } from '../../contexts/LanguageContext';
import translations from '../../constants/translations';
import authService from '../../services/authService';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = translations[language];

  const token = searchParams.get('token');

  // Verify token on component mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError('Không tìm thấy token. Vui lòng nhấp vào liên kết trong email.');
        setVerifying(false);
        return;
      }

      try {
        const response = await authService.verifyResetToken(token);

        if (response.success) {
          setTokenValid(true);
          setUserEmail(response.email);
        } else {
          setError(response.message || 'Token không hợp lệ hoặc đã hết hạn.');
        }
      } catch (err) {
        const errorMsg = err?.response?.data?.message || 'Token không hợp lệ hoặc đã hết hạn.';
        setError(errorMsg);
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const validatePassword = () => {
    if (!password || !confirmPassword) {
      setError('Vui lòng nhập mật khẩu.');
      return false;
    }

    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return false;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu không khớp. Vui lòng kiểm tra lại.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validatePassword()) {
      return;
    }

    setLoading(true);

    try {
      const response = await authService.resetPassword(token, password, confirmPassword);

      if (response.success) {
        setSuccess(true);
        setPassword('');
        setConfirmPassword('');

        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setError(response.message || 'Đặt lại mật khẩu thất bại. Vui lòng thử lại.');
      }
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
      setError(errorMsg);
      setLoading(false);
    }
  };

  return (
    <div className="reset-password-container">
      {/* LEFT SIDE - VIETNAM IMAGE */}
      <div className="reset-password-left">
        <img src={vietnamImage} alt="Vietnam Map" className="vietnam-map" />
      </div>

      {/* RIGHT SIDE - FORM */}
      <div className="reset-password-right">
        <div className="reset-password-box">
          {/* HEADER */}
          <div className="reset-password-header">
            <img src={logo} alt="Logo" className="reset-password-logo" />
            <h1 className="reset-password-title">Đặt lại mật khẩu</h1>
            <p className="reset-password-subtitle">
              Nhập mật khẩu mới cho tài khoản của bạn
            </p>
            {userEmail && (
              <p className="user-email">Email: <strong>{userEmail}</strong></p>
            )}
          </div>

          {/* VERIFYING TOKEN */}
          {verifying && (
            <div className="verifying-box">
              <div className="spinner-large"></div>
              <p>Đang xác minh liên kết...</p>
            </div>
          )}

          {/* ERROR STATE - INVALID TOKEN */}
          {!verifying && !tokenValid && (
            <div className="error-state">
              <FaExclamationCircle className="error-icon-large" />
              <h3>Liên kết không hợp lệ</h3>
              <p>{error || 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'}</p>
              <button
                type="button"
                className="btn-back-error"
                onClick={() => navigate('/forgot-password')}
              >
                <FaArrowLeft className="arrow-icon" />
                Quay lại và yêu cầu liên kết mới
              </button>
            </div>
          )}

          {/* SUCCESS STATE */}
          {success && (
            <div className="success-state">
              <FaCheckCircle className="success-icon-large" />
              <h3>Mật khẩu đã được đặt lại thành công!</h3>
              <p>Bạn sẽ được chuyển hướng đến trang đăng nhập trong giây lát...</p>
              <div className="redirect-timer">
                <div className="countdown"></div>
              </div>
            </div>
          )}

          {/* FORM - RESET PASSWORD */}
          {!verifying && tokenValid && !success && (
            <form onSubmit={handleSubmit} className="reset-password-form">
              {/* ERROR MESSAGE */}
              {error && (
                <div className="error-message">
                  <p>{error}</p>
                </div>
              )}

              {/* PASSWORD INPUT */}
              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  Mật khẩu mới
                </label>
                <div className="input-wrapper">
                  <FaLock className="input-icon" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Nhập mật khẩu mới"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                <p className="password-hint">Ít nhất 6 ký tự</p>
              </div>

              {/* CONFIRM PASSWORD INPUT */}
              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">
                  Xác nhận mật khẩu
                </label>
                <div className="input-wrapper">
                  <FaLock className="input-icon" />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Nhập lại mật khẩu mới"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="form-input"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={loading}
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              {/* PASSWORD STRENGTH INDICATOR */}
              <div className="password-strength">
                <div className={`strength-bar ${password.length >= 6 ? 'strong' : password.length > 0 ? 'weak' : ''}`}></div>
                <p className="strength-text">
                  {password.length === 0 ? 'Nhập mật khẩu' : password.length < 6 ? 'Mật khẩu yếu' : 'Mật khẩu mạnh'}
                </p>
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
                    Đang đặt lại...
                  </>
                ) : (
                  'Đặt lại mật khẩu'
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
        </div>
      </div>
    </div>
  );
}
