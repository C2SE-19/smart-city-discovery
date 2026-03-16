import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import translations from '../../constants/translations';
import { APP_ROUTES } from '../../constants/routes';
import axios from 'axios';
import './ProfilePage.css';

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const t = translations[language];
  const copy = COPY[language] || COPY.vi;
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

  // Fetch user profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
        const response = await axios.get(`${apiUrl}/v1/users/profile`);
        
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
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditData({
      ...editData,
      [name]: value
    });
  };

  const handleSave = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
      await axios.put(`${apiUrl}/v1/users/profile`, {
        fullname: editData.name,
        email: editData.email,
        phone: editData.phone,
        birthDate: editData.birthDate,
        address: editData.address,
        gender: editData.gender,
        bio: editData.bio
      });
      
      setFormData(editData);
      setIsEditing(false);
      setError(null);
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError('Failed to update profile. Please try again.');
    }
  };

  const handleCancel = () => {
    setEditData(formData);
    setIsEditing(false);
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

    if (error && activeMenu === 'account-info') {
      return (
        <div className="profile-content">
          <div className="error-message">{error}</div>
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
                <button className="btn-edit" onClick={() => setIsEditing(true)}>
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
                    />
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
                      placeholder="DD/MM/YYYY"
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
