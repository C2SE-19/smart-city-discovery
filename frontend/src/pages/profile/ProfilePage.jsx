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
  { id: 'posts', label: 'Bài viết của tôi', icon: '📝' },
  { id: 'support', label: 'Góp ý & hỗ trợ', icon: '💬' }
];

function ProfilePage() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const t = translations[language];
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

  const renderContent = () => {
    if (loading) {
      return (
        <div className="profile-content">
          <p>Đang tải thông tin...</p>
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
              <h2>Thông tin cá nhân</h2>
              {!isEditing && (
                <button className="btn-edit" onClick={() => setIsEditing(true)}>
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
                    />
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
