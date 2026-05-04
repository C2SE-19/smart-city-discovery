import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { APP_ROUTES } from '../../constants/routes';
import axios from 'axios';
import { FiGrid, FiHeart, FiMessageSquare, FiStar, FiUser } from 'react-icons/fi';
import UserPreferenceWizard from '../../components/preferences/UserPreferenceWizard';
import { fetchUserPreferences } from '../../services/api/userPreferencesApi';
import { getApiBaseUrl } from '../../services/api/client';
import './ProfilePage.css';

const COPY = {
  vi: {
    menu: {
      overview: 'Tổng quan',
      account: 'Thông tin tài khoản',
      favorites: 'Yêu thích',
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
      phone: 'Số điện thoại',
      address: 'Địa chỉ'
    },
    loading: 'Đang tải thông tin...',
    edit: 'Chỉnh sửa',
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
      phone: 'Phone',
      address: 'Address'
    },
    loading: 'Loading profile...',
  edit: '✎ Edit',
    save: 'Save',
    cancel: 'Cancel',
    ratingTitle: 'Ratings',
    ratingCount: '4.7 (0 reviews)'
  }
};

const VI_COPY_OVERRIDE = {
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
    support: 'Góp ý & hỗ trợ'
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
    phone: 'Số điện thoại',
    address: 'Địa chỉ'
  },
  loading: 'Đang tải thông tin...',
  edit: '✎ Chỉnh sửa',
  save: 'Lưu',
  cancel: 'Hủy',
  ratingTitle: 'Đánh giá',
  ratingCount: '4.7 (0 đánh giá)'
};

const VI_UI_OVERRIDE = {
  labels: {
    currentPassword: 'Mật khẩu hiện tại',
    newPassword: 'Mật khẩu mới',
    confirmPassword: 'Xác nhận mật khẩu mới'
  },
  helpers: {
    emailLocked: 'Email đã khóa, không thể thay đổi.',
    passwordRule: '(Mật khẩu phải từ 8 ký tự, có 1 chữ viết hoa và ký tự đặc biệt.)'
  },
  placeholders: {
    phone: 'Nhập số điện thoại',
    currentPassword: 'Nhập mật khẩu hiện tại',
    newPassword: 'Ít nhất 8 ký tự',
    confirmPassword: 'Nhập lại mật khẩu mới'
  },
  actions: {
    show: 'Hiện',
    hide: 'Ẩn',
    showPasswordForm: 'Thay đổi mật khẩu',
    hidePasswordForm: 'Ẩn đổi mật khẩu',
    editInterests: 'Sửa sở thích',
    removeFavorite: 'Bỏ yêu thích',
    confirm: 'Có',
    decline: 'Không'
  },
  favorites: {
    removeTitle: 'Bỏ yêu thích',
    removeMessage: 'Bạn có muốn bỏ yêu thích mục "{name}" không?',
    unnamed: 'Không có tên'
  },
  messages: {
    nameRequired: 'Vui lòng nhập họ tên.',
    emailInvalid: 'Email không đúng định dạng.',
    phoneInvalid: 'Số điện thoại không đúng định dạng.',
    passwordRequired: 'Vui lòng nhập đầy đủ mật khẩu hiện tại, mật khẩu mới và xác nhận.',
    passwordLength: 'Mật khẩu mới phải có ít nhất 8 ký tự.',
    passwordUpper: 'Mật khẩu mới phải có ít nhất 1 chữ in hoa (A-Z).',
    passwordSpecial: 'Mật khẩu mới phải có ít nhất 1 ký tự đặc biệt.',
    passwordMismatch: 'Xác nhận mật khẩu không khớp.',
    saveSuccess: 'Lưu thành công.',
    saveFailed: 'Cập nhật thất bại. Vui lòng thử lại.',
    favoriteRemoved: 'Đã bỏ yêu thích.',
    favoriteRemoveFailed: 'Không thể bỏ yêu thích. Vui lòng thử lại.'
  }
};

function shouldRepairMojibake(value) {
  const text = String(value || '');
  return /Ã|Ä|á»|â|ðŸ|�/.test(text);
}

function repairMojibakeText(value) {
  if (typeof value !== 'string') {
    return value;
  }

  if (!shouldRepairMojibake(value)) {
    return value;
  }

  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder('utf-8').decode(bytes);
    return decoded || value;
  } catch {
    return value;
  }
}

function repairMojibakeDeep(input) {
  if (Array.isArray(input)) {
    return input.map((item) => repairMojibakeDeep(item));
  }

  if (input && typeof input === 'object') {
    return Object.keys(input).reduce((accumulator, key) => {
      accumulator[key] = repairMojibakeDeep(input[key]);
      return accumulator;
    }, {});
  }

  return repairMojibakeText(input);
}

function mergeDeep(baseValue, overrideValue) {
  if (Array.isArray(baseValue) || Array.isArray(overrideValue)) {
    return overrideValue ?? baseValue;
  }

  if (
    baseValue &&
    typeof baseValue === 'object' &&
    overrideValue &&
    typeof overrideValue === 'object'
  ) {
    const keys = new Set([...Object.keys(baseValue), ...Object.keys(overrideValue)]);
    return [...keys].reduce((accumulator, key) => {
      accumulator[key] = mergeDeep(baseValue[key], overrideValue[key]);
      return accumulator;
    }, {});
  }

  return overrideValue ?? baseValue;
}


function ProfilePage() {
  const { language } = useLanguage();
  const { user, token, loading: authLoading, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const copy = useMemo(() => {
    const source = COPY[language] || COPY.vi;
    if (language !== 'vi') {
      return source;
    }

    return mergeDeep(repairMojibakeDeep(source), VI_COPY_OVERRIDE);
  }, [language]);

  const handleFavoriteCardClick = (item) => {
    if (String(item?.itemType || '').toLowerCase() !== 'place' || !item?.itemId) {
      return;
    }
    navigate(`/venues/${item.itemId}`);
  };

  const handleFavoriteRemoveClick = (event, item) => {
    event.stopPropagation();
    setConfirmFavorite(item);
  };

  const uiRaw =
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
            currentPassword: 'Nhập mật khẩu hiện tại',
            newPassword: 'Ít nhất 8 ký tự',
            confirmPassword: 'Nhập lại mật khẩu mới'
          },
          actions: {
            show: 'Hiện',
            hide: 'Ẩn',
            showPasswordForm: 'Thay đổi mật khẩu',
            hidePasswordForm: 'Ẩn đổi mật khẩu',
            editInterests: 'Chỉnh sửa sở thích',
            removeFavorite: 'Bỏ yêu thích',
            confirm: 'Có',
            decline: 'Không'
          },
          favorites: {
            removeTitle: 'Bỏ yêu thích',
            removeMessage: 'Bạn có muốn bỏ yêu thích mục "{name}" không?',
            unnamed: 'Không có tên'
          },
          messages: {
            nameRequired: 'Vui lòng nhập họ tên.',
            emailInvalid: 'Email không đúng định dạng.',
            phoneInvalid: 'Số điện thoại không đúng định dạng.',
            passwordRequired:
              'Vui lòng nhập đầy đủ mật khẩu hiện tại, mật khẩu mới và xác nhận.',
            passwordLength: 'Mật khẩu mới phải có ít nhất 8 ký tự.',
            passwordUpper: 'Mật khẩu mới phải có ít nhất 1 chữ in hoa (A-Z).',
            passwordSpecial: 'Mật khẩu mới phải có ít nhất 1 ký tự đặc biệt.',
            passwordMismatch: 'Xác nhận mật khẩu không khớp.',
            saveSuccess: 'Lưu thành công.',
            saveFailed: 'Cập nhật thất bại. Vui lòng thử lại.',
            favoriteRemoved: 'Đã bỏ yêu thích.',
            favoriteRemoveFailed: 'Không thể bỏ yêu thích. Vui lòng thử lại.'
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
            currentPassword: 'Enter current password',
            newPassword: 'At least 8 characters',
            confirmPassword: 'Re-enter new password'
          },
          actions: {
            show: 'Show',
            hide: 'Hide',
            showPasswordForm: 'Change password',
            hidePasswordForm: 'Hide password form',
            editInterests: 'Edit interests',
            removeFavorite: 'Remove favorite',
            confirm: 'Yes',
            decline: 'No'
          },
          favorites: {
            removeTitle: 'Remove favorite',
            removeMessage: 'Do you want to remove "{name}" from favorites?',
            unnamed: 'Untitled'
          },
          messages: {
            nameRequired: 'Please enter your full name.',
            emailInvalid: 'Invalid email format.',
            phoneInvalid: 'Invalid phone format.',
            passwordRequired: 'Please enter current password, new password, and confirmation.',
            passwordLength: 'New password must be at least 8 characters.',
            passwordUpper: 'New password must include at least 1 uppercase letter (A-Z).',
            passwordSpecial: 'New password must include at least 1 special character.',
            passwordMismatch: 'Password confirmation does not match.',
            saveSuccess: 'Saved successfully.',
            saveFailed: 'Update failed. Please try again.',
            favoriteRemoved: 'Removed from favorites.',
            favoriteRemoveFailed: 'Unable to remove favorite. Please try again.'
          }
        };

  const ui = useMemo(() => {
    if (language !== 'vi') {
      return uiRaw;
    }

    return mergeDeep(repairMojibakeDeep(uiRaw), VI_UI_OVERRIDE);
  }, [language, uiRaw]);

  const MenuItems = [
    { id: 'overview', label: copy.menu.overview, icon: FiGrid },
    { id: 'account-info', label: copy.menu.account, icon: FiUser },
    { id: 'favorites', label: copy.menu.favorites, icon: FiHeart },
    { id: 'support', label: copy.menu.support, icon: FiMessageSquare }
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
    address: '',
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
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [confirmFavorite, setConfirmFavorite] = useState(null);
  const [removingFavorite, setRemovingFavorite] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(
    () => user?.avatarUrl || user?.avatar_url || ''
  );
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [avatarCropOpen, setAvatarCropOpen] = useState(false);
  const [avatarImageSrc, setAvatarImageSrc] = useState('');
  const [avatarCrop, setAvatarCrop] = useState({ x: 0, y: 0 });
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarCroppedArea, setAvatarCroppedArea] = useState(null);
  const [preferenceWizardOpen, setPreferenceWizardOpen] = useState(false);
  const [userPreference, setUserPreference] = useState(null);
  const menuIdSet = useMemo(() => new Set(MenuItems.map((item) => item.id)), [MenuItems]);

  const apiUrl = useMemo(() => getApiBaseUrl(), []);

  const apiBase = useMemo(() => apiUrl.replace(/\/api\/v1$|\/api$/i, ''), [apiUrl]);

  useEffect(() => {
    const requestedMenu = location.state?.activeMenu;
    if (requestedMenu && menuIdSet.has(requestedMenu)) {
      setActiveMenu(requestedMenu);
    }
  }, [location.state, menuIdSet]);

  useEffect(() => {
    if (user?.avatarUrl && user.avatarUrl !== avatarUrl) {
      setAvatarUrl(user.avatarUrl);
    } else if (user?.avatar_url && user.avatar_url !== avatarUrl) {
      setAvatarUrl(user.avatar_url);
    }
  }, [user?.avatarUrl, user?.avatar_url, avatarUrl]);

  const displayAvatarUrl = useMemo(() => {
    const resolved =
      avatarUrl || user?.avatarUrl || user?.avatar_url || formData.avatarUrl || '';
    if (!resolved) return '';
    if (/^https?:\/\//i.test(resolved)) return resolved;
    return `${apiBase}${resolved}`;
  }, [avatarUrl, apiBase, formData.avatarUrl, user?.avatarUrl, user?.avatar_url]);

  const loadUserPreferences = useCallback(async () => {
    if (!token) {
      setUserPreference(null);
      return null;
    }

    try {
      const response = await fetchUserPreferences();
      const preference = response?.preference || null;
      setUserPreference(preference);
      return preference;
    } catch (preferenceError) {
      console.error('Failed to fetch preferences:', preferenceError);
      return null;
    }
  }, [token]);

  useEffect(() => {
    loadUserPreferences();
  }, [loadUserPreferences]);

  // Fetch user profile on mount
  useEffect(() => {
    if (authLoading) {
      return;
    }

    const fetchProfile = async () => {
      try {
        setLoading(true);
        const emailParam = user?.email || editData.email || formData.email || '';
        if (!token && !emailParam) {
          setLoading(false);
          return;
        }

        const response = await axios.get(`${apiUrl}/users/profile`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          params: emailParam ? { email: emailParam } : {}
        });
        
        const userData = response.data.user;
        const profileData = {
          name: userData.fullname || user?.fullname || '',
          email: userData.email || user?.email || '',
          phone: userData.phone || '',
          address: userData.address || '',
          bio: userData.bio || '',
          avatarUrl: userData.avatarUrl || userData.avatar_url || ''
        };
        
        setFormData(profileData);
        setEditData(profileData);
        setAvatarUrl(profileData.avatarUrl || '');
        setError(null);
        setSuccessMessage('');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setShowPasswordForm(false);
        setPasswordVisibility({ current: false, next: false, confirm: false });
      } catch (err) {
        console.error('Failed to fetch profile:', err);
        // Use fallback data from auth context
        const fallbackData = {
          name: user?.fullname || 'User',
          email: user?.email || '',
          phone: '',
          address: '',
          bio: '',
          avatarUrl: user?.avatarUrl || ''
        };
        setFormData(fallbackData);
        setEditData(fallbackData);
        setAvatarUrl(fallbackData.avatarUrl || '');
        setSuccessMessage('');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setShowPasswordForm(false);
        setPasswordVisibility({ current: false, next: false, confirm: false });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, token, apiUrl]);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (activeMenu !== 'favorites') {
        return;
      }
      if (!token) {
        setFavorites([]);
        return;
      }
      try {
        setFavoritesLoading(true);
        const response = await axios.get(`${apiUrl}/users/favorites`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setFavorites(response.data?.favorites || []);
      } catch (err) {
        console.error('Failed to fetch favorites:', err);
        setFavorites([]);
      } finally {
        setFavoritesLoading(false);
      }
    };

    fetchFavorites();
  }, [activeMenu, apiUrl, token]);

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

    if (!/[!@#$%^&*()_+\-=[\]{};:'",.<>?/\\|`~]/.test(newPassword)) {
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

      await axios.put(
        `${apiUrl}/users/profile`,
        {
          fullname: editData.name,
          email: editData.email,
          phone: editData.phone,
          address: editData.address,
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
  window.dispatchEvent(new CustomEvent('smart-city-notification-refresh'));
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

  const handleOpenPreferenceWizard = async () => {
    setError('');
    setSuccessMessage('');

    if (!userPreference) {
      await loadUserPreferences();
    }

    setPreferenceWizardOpen(true);
  };

  const handlePreferenceSaved = (savedPreference) => {
    setUserPreference(savedPreference || null);
    setSuccessMessage(language === 'vi' ? 'Cập nhật sở thích thành công.' : 'Preferences updated successfully.');
    setError('');
    setTimeout(() => setSuccessMessage(''), 1200);
  };

  const handleConfirmRemoveFavorite = async () => {
    if (!confirmFavorite || removingFavorite) {
      return;
    }
    try {
      setRemovingFavorite(true);
      await axios.post(
        `${apiUrl}/users/favorites/toggle`,
        {
          itemId: confirmFavorite.itemId,
          itemType: confirmFavorite.itemType,
          name: confirmFavorite.name,
          image: confirmFavorite.image,
          price: confirmFavorite.price,
          description: confirmFavorite.description
        },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );
      setFavorites((prev) =>
        prev.filter(
          (item) =>
            !(item.itemId === confirmFavorite.itemId && item.itemType === confirmFavorite.itemType)
        )
      );
      setConfirmFavorite(null);
      setError('');
      setSuccessMessage(ui.messages.favoriteRemoved);
      setTimeout(() => setSuccessMessage(''), 1200);
    } catch (err) {
      console.error('Failed to remove favorite:', err);
      setError(ui.messages.favoriteRemoveFailed);
      setSuccessMessage('');
      setTimeout(() => setError(''), 1500);
    } finally {
      setRemovingFavorite(false);
    }
  };

  const maskedPhone = useMemo(() => {
    const phone = formData.phone || '';
    if (phone.length <= 4) return phone;
    const visible = phone.slice(0, 4);
    return `${visible}${'*'.repeat(Math.max(phone.length - 4, 0))}`;
  }, [formData.phone]);

  const userInitial = useMemo(() => {
    const name = formData.name || user?.fullname || user?.username || '';
    return name.trim().charAt(0).toUpperCase() || 'U';
  }, [formData.name, user?.fullname, user?.username]);

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setAvatarImageSrc(reader.result?.toString() || '');
        setAvatarCrop({ x: 0, y: 0 });
        setAvatarZoom(1);
        setAvatarCroppedArea(null);
        setAvatarCropOpen(true);
      });
      reader.readAsDataURL(file);
    } finally {
      event.target.value = '';
    }
  };

  const onAvatarCropComplete = useCallback((_croppedArea, croppedAreaPixels) => {
    setAvatarCroppedArea(croppedAreaPixels);
  }, []);

  const getCroppedAvatarBlob = async () => {
    if (!avatarImageSrc || !avatarCroppedArea) return null;
    const image = new Image();
    image.src = avatarImageSrc;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    canvas.width = avatarCroppedArea.width;
    canvas.height = avatarCroppedArea.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(
      image,
      avatarCroppedArea.x,
      avatarCroppedArea.y,
      avatarCroppedArea.width,
      avatarCroppedArea.height,
      0,
      0,
      avatarCroppedArea.width,
      avatarCroppedArea.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
    });
  };

  const handleUploadCroppedAvatar = async () => {
    if (!token) {
      setError('Bạn cần đăng nhập để cập nhật ảnh đại diện.');
      setSuccessMessage('');
      setTimeout(() => setError(''), 1500);
      return;
    }

    try {
      setAvatarUploading(true);
      setError('');
      setSuccessMessage('');

      const blob = await getCroppedAvatarBlob();
      if (!blob) {
        setError('Không thể cắt ảnh. Vui lòng thử lại.');
        setTimeout(() => setError(''), 1500);
        return;
      }

      const form = new FormData();
      form.append('avatar', blob, 'avatar.jpg');

      const response = await axios.put(`${apiUrl}/users/avatar`, form, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const nextAvatar =
        response.data?.user?.avatarUrl ||
        response.data?.user?.avatar_url ||
        response.data?.avatarUrl ||
        response.data?.avatar_url ||
        '';
      if (nextAvatar) {
        setAvatarUrl(nextAvatar);
        updateUser({ avatarUrl: nextAvatar });
      }
      setAvatarCropOpen(false);
      setSuccessMessage('Cập nhật ảnh đại diện thành công.');
      setTimeout(() => setSuccessMessage(''), 1200);
    } catch (err) {
      console.error('Avatar upload error:', err);
      const apiMessage = err.response?.data?.message;
      setError(apiMessage || 'Tải ảnh thất bại. Vui lòng thử lại.');
      setTimeout(() => setError(''), 1500);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleOpenAvatarPicker = () => {
    setAvatarMenuOpen(false);
    avatarInputRef.current?.click();
  };

  const handleEditAvatar = async () => {
    setAvatarMenuOpen(false);
    if (!displayAvatarUrl) {
      setError('Chưa có avatar để chỉnh sửa.');
      setTimeout(() => setError(''), 1500);
      return;
    }

    try {
      const response = await fetch(displayAvatarUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setAvatarImageSrc(reader.result?.toString() || '');
        setAvatarCrop({ x: 0, y: 0 });
        setAvatarZoom(1);
        setAvatarCroppedArea(null);
        setAvatarCropOpen(true);
      });
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('Avatar load error:', err);
      setError('Không thể tải ảnh để chỉnh sửa.');
      setTimeout(() => setError(''), 1500);
    }
  };

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
            <div className="profile-content-header" data-onboarding="profile-main-header">
              <h2>{copy.headings.personal}</h2>
              {!isEditing && (
                <div className="profile-content-actions">
                  <button
                    type="button"
                    className="btn-edit btn-edit-secondary"
                    onClick={handleOpenPreferenceWizard}
                  >
                    {ui.actions.editInterests}
                  </button>
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
                </div>
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
                    <label>{copy.labels.phone}</label>
                    <p>{maskedPhone}</p>
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
            {favoritesLoading ? (
              <p className="placeholder-text">{copy.loading}</p>
            ) : favorites.length === 0 ? (
              <p className="placeholder-text">{copy.placeholder.favorites}</p>
            ) : (
              <>
                <div className="favorites-grid">
                  {favorites.map((item) => (
                    <article
                      key={`${item.itemType}-${item.itemId}`}
                      className="favorite-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => handleFavoriteCardClick(item)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleFavoriteCardClick(item);
                        }
                      }}
                    >
                      <button
                        type="button"
                        className="favorite-remove"
                        onClick={(event) => handleFavoriteRemoveClick(event, item)}
                        aria-label={ui.actions.removeFavorite}
                      >
                        <span aria-hidden="true">-</span>
                      </button>
                      {item.image && (
                        <img src={item.image} alt={item.name} className="favorite-image" />
                      )}
                      <div className="favorite-body">
                        <h3>{item.name || ui.favorites.unnamed}</h3>
                        {item.description && <p>{item.description}</p>}
                        {item.price && <span className="favorite-price">{item.price}</span>}
                      </div>
                    </article>
                  ))}
                </div>
                {confirmFavorite && (
                  <div className="confirm-overlay" role="dialog" aria-modal="true">
                    <div className="confirm-dialog">
                      <h3>{ui.favorites.removeTitle}</h3>
                      <p>
                        {ui.favorites.removeMessage.replace(
                          '{name}',
                          confirmFavorite.name || ui.favorites.unnamed
                        )}
                      </p>
                      <div className="confirm-actions">
                        <button
                          type="button"
                          className="btn-confirm"
                          onClick={handleConfirmRemoveFavorite}
                          disabled={removingFavorite}
                        >
                          {ui.actions.confirm}
                        </button>
                        <button
                          type="button"
                          className="btn-decline"
                          onClick={() => setConfirmFavorite(null)}
                          disabled={removingFavorite}
                        >
                          {ui.actions.decline}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
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
      <div className="profile-header" data-onboarding="profile-header">
        <div className="user-card">
          <div className="user-avatar">
            <div className={`avatar-button ${avatarUploading ? 'is-uploading' : ''}`} aria-label="Avatar">
              {displayAvatarUrl ? (
                <img src={displayAvatarUrl} alt={user?.fullname || 'User avatar'} className="avatar-image" />
              ) : (
                <div className="avatar-initial" style={{ backgroundColor: '#ff6b35' }}>
                  {userInitial}
                </div>
              )}
              {avatarUploading && <span className="avatar-uploading">Uploading...</span>}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="avatar-input"
              onChange={handleAvatarChange}
            />
          </div>
          <div className="user-info">
            <h1 className="user-name">
              {user?.fullname || 'User'}
              <span className="verify-badge">✓</span>
            </h1>
          </div>
          <div className="avatar-menu">
            <button
              type="button"
              className="avatar-menu-trigger"
              aria-label="Profile menu"
              aria-expanded={avatarMenuOpen}
              onClick={() => setAvatarMenuOpen((prev) => !prev)}
            >
              ...
            </button>
            {avatarMenuOpen && (
              <div className="avatar-menu-dropdown">
                <button type="button" onClick={handleOpenAvatarPicker}>
                  {language === 'vi' ? 'Thêm avatar' : 'Add avatar'}
                </button>
                <button type="button" onClick={handleEditAvatar}>
                  {language === 'vi' ? 'Chỉnh sửa avatar' : 'Edit avatar'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {avatarCropOpen && (
        <div className="avatar-crop-overlay" role="dialog" aria-modal="true">
          <div className="avatar-crop-modal">
            <div className="avatar-crop-header">
              <h3>{language === 'vi' ? 'Cắt avatar' : 'Crop avatar'}</h3>
              <button type="button" className="avatar-crop-close" onClick={() => setAvatarCropOpen(false)}>
                ×
              </button>
            </div>
            <div className="avatar-cropper">
              <Cropper
                image={avatarImageSrc}
                crop={avatarCrop}
                zoom={avatarZoom}
                aspect={1}
                cropShape="round"
                onCropChange={setAvatarCrop}
                onZoomChange={setAvatarZoom}
                onCropComplete={onAvatarCropComplete}
              />
            </div>
            <div className="avatar-crop-controls">
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={avatarZoom}
                onChange={(e) => setAvatarZoom(Number(e.target.value))}
              />
              <div className="avatar-crop-actions">
                <button type="button" className="btn-cancel" onClick={() => setAvatarCropOpen(false)}>
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
                <button type="button" className="btn-save" onClick={handleUploadCroppedAvatar} disabled={avatarUploading}>
                  {language === 'vi' ? 'Lưu avatar' : 'Save avatar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="profile-container">
        {/* Sidebar */}
        <aside className="profile-sidebar" data-onboarding="profile-sidebar">
          <nav className="sidebar-menu">
            {MenuItems.map((item) => {
              const MenuIcon = item.icon;

              if (item.id === 'overview') {
                return (
                  <div key={item.id} className="menu-item menu-item-heading">
                    <span className="menu-icon" aria-hidden="true">
                      <MenuIcon />
                    </span>
                    <span className="menu-label">{item.label}</span>
                  </div>
                );
              }

              return (
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
                  <span className="menu-icon" aria-hidden="true">
                    <MenuIcon />
                  </span>
                  <span className="menu-label">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="profile-main" data-onboarding="profile-main">
          {renderContent()}
        </main>
      </div>

      <UserPreferenceWizard
        isOpen={preferenceWizardOpen}
        onClose={() => setPreferenceWizardOpen(false)}
        onSaved={handlePreferenceSaved}
        initialPreference={userPreference}
        title={language === 'vi' ? 'Cập nhật sở thích của bạn' : 'Update your interests'}
      />
    </div>
  );
}

export default ProfilePage;

