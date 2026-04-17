import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./register.css";
import logo from "../../assets/images/logo.png";
import { useLanguage } from "../../contexts/LanguageContext";
import translations from "../../constants/translations";
import authService from "../../services/authService";
import { validatePassword } from "../../utils/validators/validators";

const NEW_ACCOUNT_ONBOARDING_KEY = "smart-city-onboarding:new-account";

export default function RegisterPage() {

  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = translations[language];

  const [fullname, setFullname] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState([]);
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [generalErrorDetails, setGeneralErrorDetails] = useState([]);
  const [usernameError, setUsernameError] = useState("");
  const [emailError, setEmailError] = useState("");

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    
    if (newPassword) {
      const validation = validatePassword(newPassword, language);
      setPasswordErrors(validation.errors);
    } else {
      setPasswordErrors([]);
    }
  };

  const handleUsernameChange = async (e) => {
    const newUsername = e.target.value;
    setUsername(newUsername);
    setUsernameError("");

    // Kiểm tra username đã tồn tại
    if (newUsername.trim().length > 0) {
      try {
        await authService.checkUsernameExists(newUsername.trim());
      } catch (err) {
        if (err && (err.exists === true || err.message?.includes("already exists"))) {
          setUsernameError(t.auth.usernameExists);
        }
      }
    }
  };

  const handleEmailChange = async (e) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    setEmailError("");

    // Kiểm tra email đã tồn tại
    if (newEmail.trim().length > 0) {
      try {
        await authService.checkEmailExists(newEmail.trim());
      } catch (err) {
        if (err && (err.exists === true || err.message?.includes("already exists"))) {
          setEmailError(t.auth.emailExists);
        }
      }
    }
  };

  const handleConfirmPasswordChange = (e) => {
    const newConfirmPassword = e.target.value;
    setConfirmPassword(newConfirmPassword);
    
    if (password && newConfirmPassword && password !== newConfirmPassword) {
      setConfirmPasswordError(t.auth.passwordNotMatch);
    } else {
      setConfirmPasswordError("");
    }
  };

  const handleRegister = async (e) => {

    e.preventDefault();
    setGeneralError("");
    setConfirmPasswordError("");

    // Kiểm tra lỗi tồn tại
    if (usernameError || emailError) {
      setGeneralError(t.auth.fixErrors);
      return;
    }

    // Validate password
    const passwordValidation = validatePassword(password, language);
    if (!passwordValidation.isValid) {
      setPasswordErrors(passwordValidation.errors);
      return;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError(t.auth.passwordNotMatch);
      return;
    }

    setLoading(true);

    try {
      const res = await authService.register({
        fullname: fullname.trim(),
        username: username.trim(),
        email: email.trim(),
        password
      });

      window.localStorage.setItem(
        NEW_ACCOUNT_ONBOARDING_KEY,
        JSON.stringify({
          email: email.trim().toLowerCase(),
          username: username.trim().toLowerCase(),
          registeredAt: new Date().toISOString()
        })
      );

      alert(res.message || t.auth.registerSuccess);

      // Redirect to login page after successful registration
      navigate("/login");

    } catch (err) {
      // Lỗi từ authService đã được extract từ response
      let errorMessage = t.auth.registerFailed;
      let errorDetails = [];

      if (typeof err === 'object') {
        // err là object { message, details, success } từ authService
        errorMessage = err.message || errorMessage;
        errorDetails = err.details || [];
      } else {
        errorMessage = String(err);
      }

      setGeneralError(errorMessage);
      setGeneralErrorDetails(Array.isArray(errorDetails) ? errorDetails : (errorMessage ? [errorMessage] : []));

    } finally {
      setLoading(false);
    }

  };



  return (
    <div className="register-container">

      <div className="register-left">
        <img src={logo} alt="logo" className="register-logo"/>
      </div>

      <div className="register-right">

        <form className="register-form" onSubmit={handleRegister}>

          <h2>{t.auth.register}</h2>

          <label>{t.auth.fullname}</label>
          <input
            type="text"
            value={fullname}
            onChange={(e)=>setFullname(e.target.value)}
            required
          />

          <label>{t.auth.username}</label>
          <input
            type="text"
            value={username}
            onChange={handleUsernameChange}
            required
            style={{
              borderColor: usernameError ? '#ff6b6b' : '#ccc',
              borderWidth: usernameError ? '2px' : '1px'
            }}
          />
          {usernameError && (
            <div style={{
              color: '#ff6b6b',
              fontSize: '12px',
              marginTop: '5px',
              marginBottom: '10px',
              padding: '8px',
              backgroundColor: '#fff5f5',
              borderRadius: '4px',
              borderLeft: '3px solid #ff6b6b'
            }}>
              {usernameError}
            </div>
          )}

          <label>{t.auth.email}</label>
          <input
            type="email"
            value={email}
            onChange={handleEmailChange}
            required
            style={{
              borderColor: emailError ? '#ff6b6b' : '#ccc',
              borderWidth: emailError ? '2px' : '1px'
            }}
          />
          {emailError && (
            <div style={{
              color: '#ff6b6b',
              fontSize: '12px',
              marginTop: '5px',
              marginBottom: '10px',
              padding: '8px',
              backgroundColor: '#fff5f5',
              borderRadius: '4px',
              borderLeft: '3px solid #ff6b6b'
            }}>
              {emailError}
            </div>
          )}

          <label>{t.auth.password}</label>
          <input
            type="password"
            value={password}
            onChange={handlePasswordChange}
            required
            style={{
              borderColor: passwordErrors.length > 0 ? '#ff6b6b' : '#ccc',
              borderWidth: passwordErrors.length > 0 ? '2px' : '1px'
            }}
          />
          
          {passwordErrors.length > 0 && (
            <div style={{
              color: '#ff6b6b',
              fontSize: '12px',
              marginTop: '5px',
              marginBottom: '10px',
              padding: '8px',
              backgroundColor: '#fff5f5',
              borderRadius: '4px',
              borderLeft: '3px solid #ff6b6b'
            }}>
              <strong>{t.auth.passwordRequirements}</strong>
              <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                {passwordErrors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <label>{t.auth.confirmPassword}</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={handleConfirmPasswordChange}
            required
            style={{
              borderColor: confirmPasswordError ? '#ff6b6b' : '#ccc',
              borderWidth: confirmPasswordError ? '2px' : '1px'
            }}
          />
          {confirmPasswordError && (
            <div style={{
              color: '#ff6b6b',
              fontSize: '12px',
              marginTop: '5px',
              marginBottom: '10px',
              padding: '8px',
              backgroundColor: '#fff5f5',
              borderRadius: '4px',
              borderLeft: '3px solid #ff6b6b'
            }}>
              {confirmPasswordError}
            </div>
          )}

          {generalError && (
            <div style={{
              color: '#ff6b6b',
              fontSize: '12px',
              marginBottom: '10px',
              padding: '8px',
              backgroundColor: '#fff5f5',
              borderRadius: '4px',
              borderLeft: '3px solid #ff6b6b'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{generalError}</div>
              {generalErrorDetails.length > 0 && (
                <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                  {generalErrorDetails.map((detail, idx) => (
                    <li key={idx}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button type="submit" className="register-btn" disabled={loading || passwordErrors.length > 0 || confirmPasswordError || usernameError || emailError}>
            {loading ? t.auth.signingUp : t.auth.createAccount}
          </button>

          <p className="login-link">
            {t.auth.haveAccount}
            <span 
              style={{color:"#f47745", cursor:"pointer"}}
              onClick={()=>navigate("/login")}
            >
              {t.auth.signIn}
            </span>
          </p>

        </form>

      </div>

    </div>
  );
}
