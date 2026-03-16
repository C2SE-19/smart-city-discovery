import { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import translations from '../../constants/translations';
import axios from 'axios';
import './ProfilePage.css';

const MenuItems = [
  { id: 'overview', label: 'Tổng Quan', icon: '🏠' },
  { id: 'account-info', label: 'Thông tin tài khoản', icon: '👤' },
  { id: 'favorites', label: 'Yêu Thích', icon: '❤️' },
  { id: 'ratings', label: 'Đánh giá', icon: '⭐' },
  { id: 'support', label: 'Góp ý & hỗ trợ', icon: '💬' }
];


function ProfilePage() {
  const { language } = useLanguage();
  const { user, token } = useAuth();
  const t = translations[language];
  const [activeMenu, setActiveMenu] = useState('account-info');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    birthDate: '',
    address: '',
    gender: 'Nam',
    bio: ''
  });

  const [editData, setEditData] = useState(formData);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordVisibility, setPasswordVisibility] = useState({
    current: false,
    next: false,
    confirm: false
  });

  // Fetch user profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
        const response = await axios.get(`${apiUrl}/users/profile`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          params: { email: user?.email || editData.email || formData.email }
        });
        
        const userData = response.data.user;
        const profileData = {
          name: userData.fullname || user?.fullname || '',
          email: userData.email || user?.email || '',
          phone: userData.phone || '',
          birthDate: userData.birthDate || '',
          address: userData.address || '',
          gender: userData.gender || 'Nam',
          bio: userData.bio || ''
        };
        
        setFormData(profileData);
        setEditData(profileData);
        setError(null);
        setSuccessMessage('');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setShowPasswordForm(false);
        setPasswordVisibility({ current: false, next: false, confirm: false });
      } catch (err) {
        console.error('Failed to fetch profile:', err);
        // Use fallback data from auth context
        const fallbackData = {
          name: user?.fullname || 'Nguyễn Hữu Lộc',
          email: user?.email || '',
          phone: '',
          birthDate: '',
          address: '',
          gender: 'Nam',
          bio: ''
        };
        setFormData(fallbackData);
        setEditData(fallbackData);
        setSuccessMessage('');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setShowPasswordForm(false);
        setPasswordVisibility({ current: false, next: false, confirm: false });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, token]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      const digitsOnly = value.replace(/\D/g, '');
      setEditData({
        ...editData,
        phone: digitsOnly
      });
      return;
    }
    setEditData({
      ...editData,
      [name]: value
    });
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData({
      ...passwordData,
      [name]: value
    });
  };

  const validateProfile = (data) => {
    if (!data.name || !data.name.trim()) {
      return 'Vui lòng nhập họ tên.';
    }

    const emailValue = (data.email || '').trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailValue || !emailRegex.test(emailValue)) {
      return 'Email không đúng định dạng.';
    }

    const phoneValue = (data.phone || '').trim();
    if (phoneValue && !/^\d+$/.test(phoneValue)) {
      return 'Số điện thoại không đúng định dạng.';
    }

    if (phoneValue) {
      if (phoneValue.length !== 10) {
        return 'Số điện thoại không đúng định dạng.';
      }
    }

    const birthDateValue = (data.birthDate || '').trim();
    if (birthDateValue && !/^\d{2}\/\d{2}\/\d{4}$/.test(birthDateValue)) {
      return 'Ngày sinh phải theo định dạng DD/MM/YYYY.';
    }

    return '';
  };

  const validatePasswordChange = (data) => {
    const { currentPassword, newPassword, confirmPassword } = data;
    const hasAny = currentPassword || newPassword || confirmPassword;
    if (!hasAny) {
      return '';
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return 'Vui lòng nhập đầy đủ mật khẩu hiện tại, mật khẩu mới và xác nhận.';
    }

    if (newPassword.length < 8) {
      return 'Mật khẩu mới phải có ít nhất 8 ký tự.';
    }

    if (!/[A-Z]/.test(newPassword)) {
      return 'Mật khẩu mới phải có ít nhất 1 chữ in hoa (A-Z).';
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};:\'",.<>?\/\\|`~]/.test(newPassword)) {
      return 'Mật khẩu mới phải có ít nhất 1 ký tự đặc biệt.';
    }

    if (newPassword !== confirmPassword) {
      return 'Xác nhận mật khẩu không khớp.';
    }

    return '';
  };

  const handleSave = async () => {
    try {
      const validationError = validateProfile(editData);
      if (validationError) {
        setError(validationError);
        setSuccessMessage('');
        setTimeout(() => setError(''), 1500);
        return;
      }

      const passwordValidation = validatePasswordChange(passwordData);
      if (passwordValidation) {
        setError(passwordValidation);
        setSuccessMessage('');
        setTimeout(() => setError(''), 1500);
        return;
      }

      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
      await axios.put(
        `${apiUrl}/users/profile`,
        {
          fullname: editData.name,
          email: editData.email,
          phone: editData.phone,
          birthDate: editData.birthDate,
          address: editData.address,
          gender: editData.gender,
          bio: editData.bio
        },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );

      if (passwordData.currentPassword || passwordData.newPassword || passwordData.confirmPassword) {
        await axios.put(
          `${apiUrl}/users/password`,
          {
            currentPassword: passwordData.currentPassword,
            newPassword: passwordData.newPassword
          },
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          }
        );
      }
      
      setFormData(editData);
      setError(null);
      setSuccessMessage('Lưu thành công.');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
      setPasswordVisibility({ current: false, next: false, confirm: false });
      setTimeout(() => {
        setSuccessMessage('');
      }, 1200);
    } catch (err) {
      console.error('Failed to update profile:', err);
      const apiMessage = err.response?.data?.message;
      setError(apiMessage || 'Cập nhật thất bại. Vui lòng thử lại.');
      setSuccessMessage('');
      setTimeout(() => setError(''), 1500);
    }
  };

  const handleCancel = () => {
    setEditData(formData);
    setIsEditing(false);
    setSuccessMessage('');
    setError('');
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setShowPasswordForm(false);
    setPasswordVisibility({ current: false, next: false, confirm: false });
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="profile-content">
          <p>Đang tải thông tin...</p>
        </div>
      );
    }

    switch (activeMenu) {
      case 'account-info':
        return (
          <div className="profile-content">
            <div className="profile-content-header">
              <h2>Thông tin cá nhân</h2>
              {!isEditing && (
                <button
                  className="btn-edit"
                  onClick={() => {
                    setIsEditing(true);
                    setSuccessMessage('');
                    setError('');
                  }}
                >
                  ✎ Chỉnh sửa
                </button>
              )}
            </div>

            {!isEditing ? (
              <div className="info-display">
                <div className="info-row">
                  <div className="info-group">
                    <label>Họ và tên</label>
                    <p>{formData.name}</p>
                  </div>
                  <div className="info-group">
                    <label>Email</label>
                    <p>{formData.email}</p>
                  </div>
                </div>
                <div className="info-row">
                  <div className="info-group">
                    <label>Giới tính</label>
                    <p>{formData.gender}</p>
                  </div>
                  <div className="info-group">
                    <label>Số điện thoại</label>
                    <p>{formData.phone}</p>
                  </div>
                </div>
                <div className="info-row">
                  <div className="info-group">
                    <label>Ngày sinh</label>
                    <p>{formData.birthDate}</p>
                  </div>
                  <div className="info-group">
                    <label>Địa chỉ</label>
                    <p>{formData.address}</p>
                  </div>
                </div>
              </div>
            ) : (
              <form className="info-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="name">Họ và tên</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={editData.name}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={editData.email}
                      onChange={handleInputChange}
                      readOnly
                      disabled
                    />
                    <small className="helper-text">Email đã khóa, không thể thay đổi.</small>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="gender">Giới tính</label>
                    <select
                      id="gender"
                      name="gender"
                      value={editData.gender}
                      onChange={handleInputChange}
                    >
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="phone">Số điện thoại</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={editData.phone}
                      onChange={handleInputChange}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Nhập số điện thoại"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="birthDate">Ngày sinh</label>
                    <input
                      type="text"
                      id="birthDate"
                      name="birthDate"
                      value={editData.birthDate}
                      onChange={handleInputChange}
                      placeholder="DD/MM/YYYY"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="address">Địa chỉ</label>
                    <input
                      type="text"
                      id="address"
                      name="address"
                      value={editData.address}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="password-section">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowPasswordForm((prev) => !prev)}
                  >
                    {showPasswordForm ? 'Ẩn đổi mật khẩu' : 'Thay đổi mật khẩu'}
                  </button>

                  {showPasswordForm && (
                    <>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="currentPassword">Mật khẩu hiện tại</label>
                    <div className="password-input">
                      <input
                        type={passwordVisibility.current ? 'text' : 'password'}
                        id="currentPassword"
                        name="currentPassword"
                        value={passwordData.currentPassword}
                        onChange={handlePasswordChange}
                        placeholder="Nhập mật khẩu hiện tại"
                      />
                      <button
                        type="button"
                        className="btn-eye"
                        onClick={() =>
                          setPasswordVisibility((prev) => ({
                            ...prev,
                            current: !prev.current
                          }))
                        }
                      >
                        {passwordVisibility.current ? 'Ẩn' : 'Hiện'}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="newPassword">Mật khẩu mới</label>
                    <div className="password-input">
                      <input
                        type={passwordVisibility.next ? 'text' : 'password'}
                        id="newPassword"
                        name="newPassword"
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        placeholder="Ít nhất 8 ký tự"
                      />
                      <button
                        type="button"
                        className="btn-eye"
                        onClick={() =>
                          setPasswordVisibility((prev) => ({
                            ...prev,
                            next: !prev.next
                          }))
                        }
                      >
                        {passwordVisibility.next ? 'Ẩn' : 'Hiện'}
                      </button>
                    </div>
                    <small className="helper-text">
                      (Mật khẩu phải từ 8 ký tự, có 1 chữ viết hoa và ký tự đặc biệt.)
                    </small>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="confirmPassword">Xác nhận mật khẩu mới</label>
                    <div className="password-input">
                      <input
                        type={passwordVisibility.confirm ? 'text' : 'password'}
                        id="confirmPassword"
                        name="confirmPassword"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        placeholder="Nhập lại mật khẩu mới"
                      />
                      <button
                        type="button"
                        className="btn-eye"
                        onClick={() =>
                          setPasswordVisibility((prev) => ({
                            ...prev,
                            confirm: !prev.confirm
                          }))
                        }
                      >
                        {passwordVisibility.confirm ? 'Ẩn' : 'Hiện'}
                      </button>
                    </div>
                  </div>
                </div>
                    </>
                  )}
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-save"
                    onClick={handleSave}
                  >
                    Lưu
                  </button>
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={handleCancel}
                  >
                    Hủy
                  </button>
                </div>
                {successMessage && <div className="success-message">{successMessage}</div>}
                {error && <div className="error-message">{error}</div>}
              </form>
            )}
          </div>
        );

      case 'favorites':
        return (
          <div className="profile-content">
            <h2>Yêu Thích</h2>
            <p className="placeholder-text">Các địa điểm yêu thích của bạn sẽ hiển thị ở đây</p>
          </div>
        );

      case 'ratings':
        return (
          <div className="profile-content">
            <h2>Đánh giá của tôi</h2>
            <p className="placeholder-text">Các đánh giá bạn đã gửi sẽ hiển thị ở đây</p>
          </div>
        );

      case 'posts':
        return (
          <div className="profile-content">
            <h2>Bài viết của tôi</h2>
            <p className="placeholder-text">Các bài viết của bạn sẽ hiển thị ở đây</p>
          </div>
        );

      case 'support':
        return (
          <div className="profile-content">
            <h2>Góp ý & Hỗ trợ</h2>
            <p className="placeholder-text">Liên hệ với chúng tôi để được hỗ trợ tốt nhất</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="profile-page">
      {/* Header Section */}
      <div className="profile-header">
        <div className="user-card">
          <div className="user-avatar">
            <div className="avatar-initial" style={{ backgroundColor: '#ff6b35' }}>
              N
            </div>
          </div>
          <div className="user-info">
            <h1 className="user-name">
              Nguyễn Hữu Lộc
              <span className="verify-badge">✓</span>
            </h1>
          </div>
        </div>

        <div className="rating-card">
          <div className="rating-header">
            <h3>Đánh giá</h3>
            <div className="rating-badge">👍</div>
          </div>
          <div className="rating-stars">
            ⭐⭐⭐⭐⭐
          </div>
          <div className="rating-count">4.7 (0 đánh giá)</div>
        </div>
      </div>

      <div className="profile-container">
        {/* Sidebar */}
        <aside className="profile-sidebar">
          <nav className="sidebar-menu">
            {MenuItems.map((item) => (
              <button
                key={item.id}
                className={`menu-item ${activeMenu === item.id ? 'active' : ''}`}
                onClick={() => setActiveMenu(item.id)}
              >
                <span className="menu-icon">{item.icon}</span>
                <span className="menu-label">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="profile-main">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default ProfilePage;
