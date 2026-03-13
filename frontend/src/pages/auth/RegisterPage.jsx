// Scaffold placeholder
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./register.css";
import logo from "../../assets/images/logo.png";
import { useLanguage } from "../../contexts/LanguageContext";
import translations from "../../constants/translations";
import authService from "../../services/authService";
import { validatePassword } from "../../utils/validators/validators";

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
  const [generalError, setGeneralError] = useState("");

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

  const handleRegister = async (e) => {

    e.preventDefault();
    setGeneralError("");

    // Validate password
    const passwordValidation = validatePassword(password, language);
    if (!passwordValidation.isValid) {
      setPasswordErrors(passwordValidation.errors);
      alert(passwordValidation.errors.join('\n'));
      return;
    }

    if (password !== confirmPassword) {
      setGeneralError(t.auth.passwordMismatch || "Mật khẩu không khớp");
      alert(t.auth.passwordMismatch || "Mật khẩu không khớp");
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

      alert(res.message || t.auth.registerSuccess);

      // Redirect to login page after successful registration
      navigate("/login");

    } catch (err) {

      alert(err.response?.data?.message || t.auth.registerFailed);

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
            onChange={(e)=>setUsername(e.target.value)}
            required
          />

          <label>{t.auth.email}</label>
          <input
            type="email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            required
          />

          <label>{t.auth.password}</label>
          <input
            type="password"
            value={password}
            onChange={handlePasswordChange}
            required
            style={{
              borderColor: passwordErrors.length > 0 ? '#ff6b6b' : 'inherit',
              backgroundColor: passwordErrors.length > 0 ? '#ffe0e0' : 'inherit'
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
            onChange={(e)=>setConfirmPassword(e.target.value)}
            required
          />

          {generalError && (
            <div style={{
              color: '#ff6b6b',
              fontSize: '12px',
              marginBottom: '10px',
              padding: '8px',
              backgroundColor: '#fff5f5',
              borderRadius: '4px'
            }}>
              {generalError}
            </div>
          )}

          <button type="submit" className="register-btn" disabled={loading || passwordErrors.length > 0}>
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
