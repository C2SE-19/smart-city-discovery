// Scaffold placeholder
import { useState, useEffect, useRef } from "react";
import { GoogleLogin } from "@react-oauth/google";
import "./login.css";
import vietnamImage from "../../assets/images/vietnam.png";
import logo from "../../assets/images/logo.png";
import { FaUser, FaLock, FaFacebookF, FaGoogle } from "react-icons/fa";
import { IoEye, IoEyeOff } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../contexts/AuthContext";
import translations from "../../constants/translations";
import { ROLES } from "../../constants/roles";
import { APP_ROUTES } from "../../constants/routes";
import authService from "../../services/authService";
import { apiClient } from "../../services/api/client";

export default function LoginPage() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [oauthLoading, setOauthLoading] = useState(false);
  const [fbReady, setFbReady] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  const googleButtonRef = useRef(null);

  const getRedirectPathByRole = (role) => {
    if ((role || '').toLowerCase() === ROLES.ADMIN) {
      return APP_ROUTES.ADMIN_DASHBOARD;
    }

    return APP_ROUTES.HOME;
  };

  // Check URL for error message from logout redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorMsg = params.get('error');
    if (errorMsg) {
      setError(decodeURIComponent(errorMsg));
      // Clean up URL
      window.history.replaceState({}, document.title, '/login');
    }
  }, []);

  // Load Facebook SDK
  useEffect(() => {
    // Define window.fbAsyncInit BEFORE loading the script
    window.fbAsyncInit = function () {
      FB.init({
        appId: import.meta.env.VITE_FACEBOOK_APP_ID || '900343549537260',
        xfbml: false,
        version: 'v18.0'
      });
      console.log('Facebook SDK initialized successfully');
      setFbReady(true);
    };

    // Load the Facebook SDK
    if (!window.FB) {
      const script = document.createElement('script');
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.src = 'https://connect.facebook.net/vi_VN/sdk.js';
      script.onload = () => {
        console.log('Facebook SDK script loaded');
      };
      script.onerror = () => {
        console.error('Failed to load Facebook SDK');
        setFbReady(false);
      };
      document.body.appendChild(script);
    } else {
      setFbReady(true);
    }

    return () => {
      // Cleanup if needed
    };
  }, []);

  // Check auth status on component mount - verify user is still active
  useEffect(() => {
    const verifyAuthStatus = async () => {
      try {
        const authData = localStorage.getItem('auth');
        console.log('🔍 Verifying auth on login page load, auth data:', !!authData);
        if (!authData) return; // No auth token, stay on login page

        // Call verify endpoint to check if token is valid and user is still active
        // If 403 (paused/blocked), axios interceptor will auto-logout and redirect
        console.log('📞 Calling /auth/verify endpoint...');
        await apiClient.get('/auth/verify');
        
        console.log('✅ Auth verified - user is active, redirecting to dashboard');
        // If we get here, auth is valid - redirect to dashboard
        const user = JSON.parse(localStorage.getItem('user'));
        navigate(getRedirectPathByRole(user?.role));
      } catch (err) {
        // 403 handled by axios interceptor (auto-logout and redirect)
        // Any other error: stay on login page
        console.log('⚠️ Auth verification error (expected if not logged in):', err?.response?.status);
        if (err?.response?.status !== 403) {
          console.log('Auth verification check complete');
        }
      }
    };

    verifyAuthStatus();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    // Validation
    if (!username.trim() || !password.trim()) {
      const errorMsg = "Please enter username and password";
      setError(errorMsg);
      return;
    }

    setLoading(true);

    try {
      const response = await authService.login({
        username: username.trim(),
        password: password.trim()
      });

      authLogin(response.user, response.token);
      navigate(getRedirectPathByRole(response?.user?.role));
    } catch (err) {
      // authService throws err.response.data directly
      const errorMsg = err?.message || err?.data?.message || "Login failed. Please try again.";
      setError(errorMsg);
      setLoading(false);
    }
  };

  // Google OAuth Handler
  const handleGoogleSuccess = async (credentialResponse) => {
    setOauthLoading(true);
    try {
      const result = await authService.loginWithGoogle(credentialResponse.credential);
      authLogin(result.user, result.token);
      navigate(getRedirectPathByRole(result?.user?.role));
    } catch (err) {
      alert(err.message || "Failed to login with Google");
    } finally {
      setOauthLoading(false);
    }
  };

  const handleGoogleError = () => {
    alert("Failed to login with Google");
  };

  const handleGoogleIconClick = () => {
    const googleButton = googleButtonRef.current?.querySelector('div[role="button"]');
    if (googleButton) {
      googleButton.click();
    }
  };

  // Facebook OAuth Handler  
  const handleFacebookLogin = () => {
    if (!fbReady) {
      alert("Đang tải Facebook SDK, vui lòng đợi...");
      return;
    }

    if (typeof FB === 'undefined') {
      alert("Facebook SDK chưa sẵn sàng. Vui lòng tải lại trang.");
      return;
    }

    setOauthLoading(true);
    
    FB.login(function(response) {
      if (response.authResponse) {
        console.log('Facebook login response:', response);
        const accessToken = response.authResponse.accessToken;
        
        authService.loginWithFacebook(accessToken)
          .then(result => {
            console.log('Facebook auth result:', result);
            authLogin(result.user, result.token);
            navigate(getRedirectPathByRole(result?.user?.role));
          })
          .catch(err => {
            console.error('Facebook login error:', err);
            alert(err.message || "Đăng nhập Facebook thất bại. Vui lòng thử lại.");
            setOauthLoading(false);
          });
      } else {
        console.log('Facebook login cancelled or failed');
        alert("Đăng nhập Facebook bị hủy. Vui lòng thử lại.");
        setOauthLoading(false);
      }
    }, { scope: 'public_profile,email' });
  };

  return (
    <div className="login-container">
      <div className="login-left">
        <div className="login-box">
          <img src={logo} className="logo" />

          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{
                color: '#991b1b',
                fontSize: '14px',
                marginBottom: '15px',
                padding: '12px',
                backgroundColor: '#fee2e2',
                borderRadius: '8px',
                borderLeft: '4px solid #dc2626',
                fontWeight: '500'
              }}>
                {error}
              </div>
            )}

            <label>{t.auth.username}</label>
            <div className="input-group">
              <FaUser className="input-icon" />
              <input 
                type="text" 
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading || oauthLoading}
              />
            </div>

            <label>{t.auth.password}</label>
            <div className="input-group">
              <FaLock className="input-icon" />

              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || oauthLoading}
              />

              <span
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <IoEyeOff /> : <IoEye />}
              </span>
            </div>

            <button type="submit" className="login-btn" disabled={loading || oauthLoading}>
              {loading ? t.auth.signingIn || "Signing in..." : t.auth.signIn || "Sign In"}
            </button>
          </form>

          <p className="signup-text">
            {t.auth.dontHaveAccount || "Don't have an account?"}
            <span onClick={() => navigate("/register")}> {t.auth.signUp || "Sign Up"}</span>
          </p>

          <div className="divider-text">{t.auth.orContinueWith || "Or continue with"}</div>

          <div className="social-login">
            <button 
              type="button"
              className="social-btn facebook-btn"
              onClick={handleFacebookLogin}
              disabled={oauthLoading}
              title={t.auth.loginWithFacebook || "Login with Facebook"}
            >
              <FaFacebookF />
            </button>

            <button 
              type="button"
              className="social-btn google-btn"
              onClick={handleGoogleIconClick}
              disabled={oauthLoading || !googleClientId}
              title="Login with Google"
            >
              <FaGoogle />
            </button>

            {googleClientId ? (
              <div className="google-login-hidden" ref={googleButtonRef} style={{ display: 'none', width: 0, height: 0, overflow: 'hidden' }}>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="login-right">
        <img src={vietnamImage} className="right-image" alt="Vietnam" />
      </div>
    </div>
  );
}
