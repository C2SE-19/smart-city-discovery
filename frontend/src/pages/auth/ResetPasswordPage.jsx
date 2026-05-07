import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './reset-password.css';
import vietnamImage from '../../assets/images/vietnam.png';
import { FaLock, FaArrowLeft, FaEye, FaEyeSlash, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import authService from '../../services/authService';
const SPECIAL_CHARACTER_PATTERN = /[^A-Za-z0-9\s]/;

function getErrorMessage(err, fallbackMessage) {
  if (typeof err?.message === 'string' && err.message.trim()) {
    return err.message;
  }

  if (typeof err?.response?.data?.message === 'string' && err.response.data.message.trim()) {
    return err.response.data.message;
  }

  return fallbackMessage;
}

const PASSWORD_REQUIREMENTS = [
  {
    key: 'minLength',
    label: 'Password must have at least 8 characters',
    test: (value) => String(value || '').length >= 8
  },
  {
    key: 'uppercase',
    label: 'Password must contain at least 1 uppercase letter (A-Z)',
    test: (value) => /[A-Z]/.test(String(value || ''))
  },
  {
    key: 'special',
    label: 'Password must contain at least 1 special character (!@#$%^&*...)',
    test: (value) => SPECIAL_CHARACTER_PATTERN.test(String(value || ''))
  }
];

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
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const navigate = useNavigate();
  const token = (searchParams.get('token') || '').trim();

  const passwordRequirementStatuses = PASSWORD_REQUIREMENTS.map((requirement) => ({
    ...requirement,
    met: requirement.test(password)
  }));
  const unmetPasswordRequirements = passwordRequirementStatuses.filter((requirement) => !requirement.met);
  const shouldHighlightRequirements = submitAttempted || password.length > 0;

  // Verify token on component mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError('Reset link is missing. Please use the link from your email.');
        setVerifying(false);
        return;
      }

      try {
        const response = await authService.verifyResetToken(token);

        if (response.success) {
          setTokenValid(true);
          setUserEmail(response.email);
        } else {
          setError(response.message || 'The link is invalid or has expired.');
        }
      } catch (err) {
        const errorMsg = getErrorMessage(err, 'Unable to reach the server. Please try again in a moment.');
        setError(errorMsg);
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const validatePassword = () => {
    if (!password || !confirmPassword) {
      setError('Please enter your password.');
      return false;
    }

    if (unmetPasswordRequirements.length > 0) {
      setError(unmetPasswordRequirements[0].label);
      return false;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please try again.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitAttempted(true);

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
        setError(response.message || 'Reset failed. Please try again.');
      }
    } catch (err) {
      const errorMsg = getErrorMessage(err, 'Something went wrong. Please try again.');
      setError(errorMsg);
    } finally {
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
            <h1 className="reset-password-title">Reset your password?</h1>
            <p className="reset-password-subtitle">
              Please enter your new password and confirm it.
            </p>
            {userEmail && (
              <p className="user-email">Email: <strong>{userEmail}</strong></p>
            )}
          </div>

          {/* VERIFYING TOKEN */}
          {verifying && (
            <div className="verifying-box">
              <div className="spinner-large"></div>
              <p>Verifying your link...</p>
            </div>
          )}

          {/* ERROR STATE - INVALID TOKEN */}
          {!verifying && !tokenValid && (
            <div className="error-state">
              <FaExclamationCircle className="error-icon-large" />
              <h3>Invalid link</h3>
              <p>{error || 'The reset link is invalid or has expired.'}</p>
              <button
                type="button"
                className="btn-back-error"
                onClick={() => navigate('/forgot-password')}
              >
                <FaArrowLeft className="arrow-icon" />
                Go back and request a new link
              </button>
            </div>
          )}

          {/* SUCCESS STATE */}
          {success && (
            <div className="success-state">
              <FaCheckCircle className="success-icon-large" />
              <h3>Password updated successfully!</h3>
              <p>You will be redirected to sign in shortly...</p>
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
                  New password
                </label>
                <div className="input-wrapper">
                  <FaLock className="input-icon" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your new password"
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
                <div className="password-requirements">
                  <p className="password-requirements-title">Password Requirements:</p>
                  <ul className="password-requirements-list">
                    {passwordRequirementStatuses.map((requirement) => {
                      const itemClassName = requirement.met
                        ? 'password-requirement met'
                        : shouldHighlightRequirements
                          ? 'password-requirement unmet'
                          : 'password-requirement';

                      return (
                        <li key={requirement.key} className={itemClassName}>
                          {requirement.label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              {/* CONFIRM PASSWORD INPUT */}
              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">
                  Confirm password
                </label>
                <div className="input-wrapper">
                  <FaLock className="input-icon" />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-enter your new password"
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
                <div className={`strength-bar ${unmetPasswordRequirements.length === 0 && password.length > 0 ? 'strong' : password.length > 0 ? 'weak' : ''}`}></div>
                <p className="strength-text">
                  {password.length === 0 ? 'Enter a password' : unmetPasswordRequirements.length > 0 ? 'Weak password' : 'Strong password'}
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
                    Updating...
                  </>
                ) : (
                  'Update password'
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
        </div>
      </div>
    </div>
  );
}
