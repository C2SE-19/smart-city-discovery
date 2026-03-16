import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import translations from '../../constants/translations';
import { APP_ROUTES } from '../../constants/routes';
import axios from 'axios';
import './ProfilePage.css';

const MenuItems = [
  { id: 'overview', label: 'Tổng Quan', icon: '🏠' },
  { id: 'account-info', label: 'Thông tin tài khoản', icon: '👤' },
  { id: 'favorites', label: 'Yêu Thích', icon: '❤️' },
  { id: 'ratings', label: 'Đánh giá', icon: '⭐' },
  { id: 'support', label: 'Góp ý & hỗ trợ', icon: '💬' }
];
const COPY = {
  vi: {
    menu: {
      overview: 'Tổng Quan',
      account: 'Thông tin tài khoản',
      favorites: 'Yêu Thích',
      ratings: 'Đánh giá',
      posts: 'Bài viết của tôi',
      support: 'Góp ý & hỗ trợ'
    },
    headings: {
      personal: 'Thông tin cá nhân',
      favorites: 'Yêu Thích',
      ratings: 'Đánh giá của tôi',
      posts: 'Bài viết của tôi',
      support: 'Góp ý & Hỗ trợ'
    },
    placeholder: {
      favorites: 'Các địa điểm yêu thích của bạn sẽ hiển thị ở đây',
      ratings: 'Các đánh giá bạn đã gửi sẽ hiển thị ở đây',
      posts: 'Các bài viết của bạn sẽ hiển thị ở đây',
      support: 'Liên hệ với chúng tôi để được hỗ trợ tốt nhất'
    },
    labels: {
      name: 'Họ và tên',
      email: 'Email',
      gender: 'Giới tính',
      phone: 'Số điện thoại',
      birthDate: 'Ngày sinh',
      address: 'Địa chỉ'
    },
    genderOptions: ['Nam', 'Nữ', 'Khác'],
    loading: 'Đang tải thông tin...',
    edit: '✎ Chỉnh sửa',
    save: 'Lưu',
    cancel: 'Hủy',
    ratingTitle: 'Đánh giá',
    ratingCount: '4.7 (0 đánh giá)'
  },
  en: {
    menu: {
      overview: 'Overview',
      account: 'Account Info',
      favorites: 'Favorites',
      ratings: 'My Ratings',
      posts: 'My Posts',
      support: 'Feedback & Support'
    },
    headings: {
      personal: 'Personal Information',
      favorites: 'Favorites',
      ratings: 'My Ratings',
      posts: 'My Posts',
      support: 'Feedback & Support'
    },
    placeholder: {
      favorites: 'Your favorite places will appear here',
      ratings: 'Your submitted ratings will appear here',
      posts: 'Your posts will appear here',
      support: 'Contact us for the best support'
    },
    labels: {
      name: 'Full name',
      email: 'Email',
      gender: 'Gender',
      phone: 'Phone',
      birthDate: 'Date of birth',
      address: 'Address'
    },
    genderOptions: ['Male', 'Female', 'Other'],
    loading: 'Loading profile...',
    edit: '✎ Edit',
    save: 'Save',
    cancel: 'Cancel',
    ratingTitle: 'Ratings',
    ratingCount: '4.7 (0 reviews)'
  }
};


function ProfilePage() {
  const { language } = useLanguage();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const t = translations[language];
  const copy = COPY[language] || COPY.vi;
  const ui =
    language === 'vi'
      ? {
          labels: {
            currentPassword: 'Mật khẩu hiện tại',
            newPassword: 'Mật khẩu mới',
            confirmPassword: 'Xác nhận mật khẩu mới'
          },
          helpers: {
            emailLocked: 'Email đã khóa, không thể thay đổi.',
            passwordRule:
              '(Mật khẩu phải từ 8 ký tự, có 1 chữ viết hoa và ký tự đặc biệt.)'
          },
          placeholders: {
            phone: 'Nhập số điện thoại',
            birthDate: 'DD/MM/YYYY',
            currentPassword: 'Nhập mật khẩu hiện tại',
            newPassword: 'Ít nhất 8 ký tự',
            confirmPassword: 'Nhập lại mật khẩu mới'
          },
          actions: {
            show: 'Hiện',
            hide: 'Ẩn',
            showPasswordForm: 'Thay đổi mật khẩu',
            hidePasswordForm: 'Ẩn đổi mật khẩu'
          },
          messages: {
            nameRequired: 'Vui lòng nhập họ tên.',
            emailInvalid: 'Email không đúng định dạng.',
            phoneInvalid: 'Số điện thoại không đúng định dạng.',
            birthInvalid: 'Ngày sinh phải theo định dạng DD/MM/YYYY.',
            passwordRequired:
              'Vui lòng nhập đầy đủ mật khẩu hiện tại, mật khẩu mới và xác nhận.',
            passwordLength: 'Mật khẩu mới phải có ít nhất 8 ký tự.',
            passwordUpper: 'Mật khẩu mới phải có ít nhất 1 chữ in hoa (A-Z).',
            passwordSpecial: 'Mật khẩu mới phải có ít nhất 1 ký tự đặc biệt.',
            passwordMismatch: 'Xác nhận mật khẩu không khớp.',
            saveSuccess: 'Lưu thành công.',
            saveFailed: 'Cập nhật thất bại. Vui lòng thử lại.'
          }
        }
      : {
          labels: {
            currentPassword: 'Current password',
            newPassword: 'New password',
            confirmPassword: 'Confirm new password'
          },
          helpers: {
            emailLocked: 'Email is locked and cannot be changed.',
            passwordRule:
              '(Password must be at least 8 characters, include 1 uppercase letter and 1 special character.)'
          },
          placeholders: {
            phone: 'Enter phone number',
            birthDate: 'DD/MM/YYYY',
            currentPassword: 'Enter current password',
            newPassword: 'At least 8 characters',
            confirmPassword: 'Re-enter new password'
          },
          actions: {
            show: 'Show',
            hide: 'Hide',
            showPasswordForm: 'Change password',
            hidePasswordForm: 'Hide password form'
          },
          messages: {
            nameRequired: 'Please enter your full name.',
            emailInvalid: 'Invalid email format.',
            phoneInvalid: 'Invalid phone format.',
            birthInvalid: 'Date of birth must be DD/MM/YYYY.',
            passwordRequired: 'Please enter current password, new password, and confirmation.',
            passwordLength: 'New password must be at least 8 characters.',
            passwordUpper: 'New password must include at least 1 uppercase letter (A-Z).',
            passwordSpecial: 'New password must include at least 1 special character.',
            passwordMismatch: 'Password confirmation does not match.',
            saveSuccess: 'Saved successfully.',
            saveFailed: 'Update failed. Please try again.'
          }
        };
  const MenuItems = [
    { id: 'overview', label: copy.menu.overview, icon: '🏠' },
    { id: 'account-info', label: copy.menu.account, icon: '👤' },
    { id: 'favorites', label: copy.menu.favorites, icon: '❤️' },
    { id: 'ratings', label: copy.menu.ratings, icon: '⭐' },
    { id: 'posts', label: copy.menu.posts, icon: '📝' },
    { id: 'support', label: copy.menu.support, icon: '💬' }
  ];
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

  const validateProfileLocalized = (data) => {
    if (!data.name || !data.name.trim()) {
      return ui.messages.nameRequired;
    }

    const emailValue = (data.email || '').trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailValue || !emailRegex.test(emailValue)) {
      return ui.messages.emailInvalid;
    }

    const phoneValue = (data.phone || '').trim();
    if (phoneValue && (!/^\d+$/.test(phoneValue) || phoneValue.length !== 10)) {
      return ui.messages.phoneInvalid;
    }

    const birthDateValue = (data.birthDate || '').trim();
    if (birthDateValue && !/^\d{2}\/\d{2}\/\d{4}$/.test(birthDateValue)) {
      return ui.messages.birthInvalid;
    }

    return '';
  };

  const validatePasswordChangeLocalized = (data) => {
    const { currentPassword, newPassword, confirmPassword } = data;
    const hasAny = currentPassword || newPassword || confirmPassword;
    if (!hasAny) {
      return '';
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return ui.messages.passwordRequired;
    }

    if (newPassword.length < 8) {
      return ui.messages.passwordLength;
    }

    if (!/[A-Z]/.test(newPassword)) {
      return ui.messages.passwordUpper;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};:\'",.<>?\/\\|`~]/.test(newPassword)) {
      return ui.messages.passwordSpecial;
    }

    if (newPassword !== confirmPassword) {
      return ui.messages.passwordMismatch;
    }

    return '';
  };

  const handleSave = async () => {
    try {
      const validationError = validateProfileLocalized(editData);
      if (validationError) {
        setError(validationError);
        setSuccessMessage('');
        setTimeout(() => setError(''), 1500);
        return;
      }

      const passwordValidation = validatePasswordChangeLocalized(passwordData);
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
      setSuccessMessage(ui.messages.saveSuccess);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
      setPasswordVisibility({ current: false, next: false, confirm: false });
      setTimeout(() => {
        setSuccessMessage('');
      }, 1200);
    } catch (err) {
      console.error('Failed to update profile:', err);
      const apiMessage = err.response?.data?.message;
      setError(apiMessage || ui.messages.saveFailed);
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

  const maskedPhone = useMemo(() => {
    const phone = formData.phone || '';
    if (phone.length <= 4) return phone;
    const visible = phone.slice(0, 4);
    return `${visible}${'*'.repeat(Math.max(phone.length - 4, 0))}`;
  }, [formData.phone]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="profile-content">
          <p>{copy.loading}</p>
        </div>
      );
    }

    switch (activeMenu) {
      case 'account-info':
        return (
          <div className="profile-content">
            <div className="profile-content-header">
              <h2>{copy.headings.personal}</h2>
              {!isEditing && (
                <button
                  className="btn-edit"
                  onClick={() => {
                    setIsEditing(true);
                    setSuccessMessage('');
                    setError('');
                  }}
                >
                  {copy.edit}
                </button>
              )}
            </div>

            {!isEditing ? (
              <div className="info-display">
                <div className="info-row">
                  <div className="info-group">
                    <label>{copy.labels.name}</label>
                    <p>{formData.name}</p>
                  </div>
                  <div className="info-group">
                    <label>{copy.labels.email}</label>
                    <p>{formData.email}</p>
                  </div>
                </div>
                <div className="info-row">
                  <div className="info-group">
                    <label>{copy.labels.gender}</label>
                    <p>{formData.gender}</p>
                  </div>
                  <div className="info-group">
                    <label>{copy.labels.phone}</label>
                    <p>{maskedPhone}</p>
                  </div>
                </div>
                <div className="info-row">
                  <div className="info-group">
                    <label>{copy.labels.birthDate}</label>
                    <p>{formData.birthDate}</p>
                  </div>
                  <div className="info-group">
                    <label>{copy.labels.address}</label>
                    <p>{formData.address}</p>
                  </div>
                </div>
              </div>
            ) : (
              <form className="info-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="name">{copy.labels.name}</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={editData.name}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="email">{copy.labels.email}</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={editData.email}
                      onChange={handleInputChange}
                      readOnly
                      disabled
                    />
                    <small className="helper-text">{ui.helpers.emailLocked}</small>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="gender">{copy.labels.gender}</label>
                    <select
                      id="gender"
                      name="gender"
                      value={editData.gender}
                      onChange={handleInputChange}
                    >
                      {copy.genderOptions.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="phone">{copy.labels.phone}</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={editData.phone}
                      onChange={handleInputChange}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={ui.placeholders.phone}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="birthDate">{copy.labels.birthDate}</label>
                    <input
                      type="text"
                      id="birthDate"
                      name="birthDate"
                      value={editData.birthDate}
                      onChange={handleInputChange}
                      placeholder={ui.placeholders.birthDate}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="address">{copy.labels.address}</label>
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
                    {showPasswordForm ? ui.actions.hidePasswordForm : ui.actions.showPasswordForm}
                  </button>

                  {showPasswordForm && (
                    <>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="currentPassword">{ui.labels.currentPassword}</label>
                    <div className="password-input">
                      <input
                        type={passwordVisibility.current ? 'text' : 'password'}
                        id="currentPassword"
                        name="currentPassword"
                        value={passwordData.currentPassword}
                        onChange={handlePasswordChange}
                        placeholder={ui.placeholders.currentPassword}
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
                        {passwordVisibility.current ? ui.actions.hide : ui.actions.show}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="newPassword">{ui.labels.newPassword}</label>
                    <div className="password-input">
                      <input
                        type={passwordVisibility.next ? 'text' : 'password'}
                        id="newPassword"
                        name="newPassword"
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        placeholder={ui.placeholders.newPassword}
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
                        {passwordVisibility.next ? ui.actions.hide : ui.actions.show}
                      </button>
                    </div>
                    <small className="helper-text">
                      {ui.helpers.passwordRule}
                    </small>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="confirmPassword">{ui.labels.confirmPassword}</label>
                    <div className="password-input">
                      <input
                        type={passwordVisibility.confirm ? 'text' : 'password'}
                        id="confirmPassword"
                        name="confirmPassword"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        placeholder={ui.placeholders.confirmPassword}
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
                        {passwordVisibility.confirm ? ui.actions.hide : ui.actions.show}
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
                    {copy.save}
                  </button>
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={handleCancel}
                  >
                    {copy.cancel}
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
            <h2>{copy.headings.favorites}</h2>
            <p className="placeholder-text">{copy.placeholder.favorites}</p>
          </div>
        );

      case 'ratings':
        return (
          <div className="profile-content">
            <h2>{copy.headings.ratings}</h2>
            <p className="placeholder-text">{copy.placeholder.ratings}</p>
          </div>
        );

      case 'posts':
        return (
          <div className="profile-content">
            <h2>{copy.headings.posts}</h2>
            <p className="placeholder-text">{copy.placeholder.posts}</p>
          </div>
        );

      case 'support':
        return (
          <div className="profile-content">
            <h2>{copy.headings.support}</h2>
            <p className="placeholder-text">{copy.placeholder.support}</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`profile-page theme-${theme}`}>
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
              {user?.fullname || 'Nguyễn Hữu Lộc'}
              <span className="verify-badge">✓</span>
            </h1>
          </div>
        </div>

        <div className="rating-card">
          <div className="rating-header">
            <h3>{copy.ratingTitle}</h3>
            <div className="rating-badge">👍</div>
          </div>
          <div className="rating-stars">
            ⭐⭐⭐⭐⭐
          </div>
            <div className="rating-count">{copy.ratingCount}</div>
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
                onClick={() => {
                  if (item.id === 'support') {
                    navigate(APP_ROUTES.FEEDBACK);
                  } else {
                    setActiveMenu(item.id);
                  }
                }}
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
