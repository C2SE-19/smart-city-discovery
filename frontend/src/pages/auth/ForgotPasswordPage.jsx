import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './forgot-password.css';
import vietnamImage from '../../assets/images/vietnam.png';
import { FaEnvelope, FaArrowLeft, FaCheckCircle } from 'react-icons/fa';
import authService from '../../services/authService';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showEmailSent, setShowEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const navigate = useNavigate();
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setShowEmailSent(false);

    // Validation
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
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
      const errorMsg = err?.response?.data?.message || err?.message || 'Something went wrong. Please try again.';
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
            <h1 className="forgot-password-title">Forgot your password?</h1>
            <p className="forgot-password-subtitle">
              No worries. We will help you regain access to your account.
            </p>
          </div>

          {/* SUCCESS MESSAGE */}
          {showEmailSent && (
            <div className="success-message-box">
              <FaCheckCircle className="success-icon" />
              <h3>Check your email</h3>
              <p>
                We sent a password reset link to <strong>{sentEmail}</strong>
              </p>
              <p className="small-text">This link expires in 1 hour.</p>
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
                  Email address
                </label>
                <div className="input-wrapper">
                  <FaEnvelope className="input-icon" />
                  <input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
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
                    Sending...
                  </>
                ) : (
                  'Send reset link'
                )}
              </button>

              {/* DIVIDER */}
              <div className="divider">
                <span>or</span>
              </div>

              {/* BACK TO LOGIN */}
              <button
                type="button"
                className="btn-back"
                onClick={() => navigate('/login')}
              >
                <FaArrowLeft className="arrow-icon" />
                Back to sign in
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
              Back to sign in
            </button>
          )}

          {/* HELP TEXT */}
          <div className="help-text">
            <p>Did not receive the email?</p>
            <ul>
              <li>Check your Spam/Junk folder</li>
              <li>Make sure the email address is correct</li>
              <li>Contact support if you still need help</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
