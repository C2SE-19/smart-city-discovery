// Scaffold placeholder
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./register.css";
import logo from "../../assets/images/logo.png";
import { useLanguage } from "../../contexts/LanguageContext";
import translations from "../../constants/translations";
import authService from "../../services/authService";

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

  const handleRegister = async (e) => {

    e.preventDefault();

    if (password !== confirmPassword) {
      alert(t.auth.passwordMismatch);
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
            onChange={(e)=>setPassword(e.target.value)}
            required
          />

          <label>{t.auth.confirmPassword}</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e)=>setConfirmPassword(e.target.value)}
            required
          />

          <button type="submit" className="register-btn" disabled={loading}>
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
