import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import introJs from 'intro.js';
import 'intro.js/minified/introjs.min.css';
import { useAuth } from '../../contexts/AuthContext';
import './AppOnboarding.css';

const STORAGE_PREFIX = 'smart-city-onboarding';
const NEW_ACCOUNT_ONBOARDING_KEY = 'smart-city-onboarding:new-account';
const ONBOARDING_LANGUAGE_KEY = 'smart-city-onboarding:language';

const ONBOARDING_UI = {
  vi: {
    nextLabel: 'Tiếp tục',
    prevLabel: '←',
    doneLabel: 'Hoàn tất',
    skipLabel: 'Bỏ qua',
    languageLabel: 'Ngôn ngữ',
    languageOptions: { vi: 'VI', en: 'EN' },
    guideBadge: 'Hướng dẫn',
    skipTitle: 'Bạn đã nắm được cách sử dụng?',
    skipDescription:
      'Nếu chọn Có, hệ thống sẽ bỏ qua hướng dẫn cho tài khoản này. Nếu chọn Không, bạn sẽ quay lại ngay bước đang xem.',
    skipNo: 'Không',
    skipYes: 'Có, bỏ qua',
    skipProcessing: 'Đang bỏ qua...',
  },
  en: {
    nextLabel: 'Next',
    prevLabel: '←',
    doneLabel: 'Finish',
    skipLabel: 'Skip',
    languageLabel: 'Language',
    languageOptions: { vi: 'VI', en: 'EN' },
    guideBadge: 'Guide',
    skipTitle: 'Have you understood how to use this?',
    skipDescription:
      'If you choose Yes, the system will skip this guide for this account. If you choose No, you will return to the current step immediately.',
    skipNo: 'No',
    skipYes: 'Yes, skip',
    skipProcessing: 'Skipping...',
  },
};

function resolveOnboardingScope(pathname) {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname === '/city-map') return 'city-map';
  if (pathname.startsWith('/merchant/workbench')) return 'merchant-workbench';
  if (pathname.startsWith('/merchant')) return 'merchant';
  if (pathname.startsWith('/discovery')) return 'discovery';
  if (pathname === '/profile') return 'profile';
  if (pathname === '/feedback') return 'feedback';
  if (pathname === '/') return 'overview';
  return null;
}

function buildScopeDefinitions(language, isAuthenticated) {
  const copy = {
    vi: {
      overview: {
        steps: [
          { title: 'Chào mừng', intro: 'Đây là hướng dẫn nhanh cho người mới. Bấm Tiếp tục để xem từng chức năng chính của hệ thống.' },
          { selector: '[data-onboarding="landing-logo"]', title: 'Trang chủ', intro: 'Bấm vào logo để quay lại màn hình tổng quan bất kỳ lúc nào.' },
          { selector: '[data-onboarding="landing-nav"]', title: 'Điều hướng chính', intro: 'Thanh này giúp bạn đi nhanh qua các khu chức năng và nội dung giới thiệu của đồ án.' },
          { selector: '[data-onboarding="overview-hero-actions"]', title: 'Lối vào nhanh', intro: 'Khu này cho phép bạn truy cập nhanh vào các thao tác quan trọng như tìm kiếm và các khu vực chính.' },
          { selector: '[data-onboarding="overview-search"]', title: 'Tìm kiếm', intro: 'Nhập tên quán, địa chỉ, phường hoặc dịch vụ để lọc dữ liệu ngay trên trang chủ.' },
          { selector: '[data-onboarding="overview-filter-button"]', title: 'Bộ lọc', intro: 'Mở bộ lọc để thu hẹp kết quả theo danh mục, phường và dịch vụ merchant.' },
          {
            selector: '[data-onboarding="overview-map-anchor"]',
            title: 'Bản đồ thành phố',
            intro: 'Bản đồ tổng quan giúp bạn nhìn nhanh các điểm nổi bật và đi vào khu bản đồ chi tiết.',
            position: 'floating',
            tooltipClass: 'app-onboarding-tooltip app-onboarding-tooltip--map-overlay',
          },
          {
            selector: isAuthenticated ? '[data-onboarding="landing-profile"]' : '[data-onboarding="landing-login"]',
            title: isAuthenticated ? 'Tài khoản của bạn' : 'Đăng nhập',
            intro: isAuthenticated
              ? 'Mở menu này để vào hồ sơ, quản lý bài đăng, feedback và các chức năng cá nhân.'
              : 'Đăng nhập để lưu trải nghiệm cá nhân hóa và sử dụng đầy đủ chức năng của hệ thống.',
          },
        ],
      },
      discovery: {
        steps: [
          { title: 'Khám phá', intro: 'Trang này giúp người dùng khám phá địa điểm theo bộ lọc và bản đồ.' },
          { selector: '[data-onboarding="workspace-nav"]', title: 'Sidebar làm việc', intro: 'Sidebar này là nơi chuyển nhanh giữa tổng quan, khám phá, merchant và admin.' },
          { selector: '[data-onboarding="discovery-filters"]', title: 'Bộ lọc khám phá', intro: 'Tại đây bạn lọc theo từ khóa, danh mục địa điểm và phường.' },
          {
            selector: '[data-onboarding="discovery-map"]',
            title: 'Bản đồ tương tác',
            intro: 'Bản đồ hiển thị ranh giới phường và các địa điểm đã duyệt để bạn khám phá trực quan.',
            position: 'floating',
            tooltipClass: 'app-onboarding-tooltip app-onboarding-tooltip--map-overlay',
          },
          { selector: '[data-onboarding="discovery-list"]', title: 'Danh sách kết quả', intro: 'Danh sách này đồng bộ với bộ lọc hiện tại để bạn theo dõi các địa điểm đang hiển thị.' },
        ],
      },
      'city-map': {
        steps: [
          { title: 'Bản đồ thành phố', intro: 'Đây là màn hình bản đồ chi tiết nhất của hệ thống.' },
          { selector: '[data-onboarding="city-map-header"]', title: 'Thanh tiêu đề', intro: 'Từ đây bạn quay về trang chủ và xác định mình đang ở màn hình bản đồ thành phố.' },
          {
            selector: '[data-onboarding="city-map-canvas"]',
            title: 'Vùng bản đồ',
            intro: 'Bấm vào marker để mở thông tin địa điểm.',
            position: 'floating',
            tooltipClass: 'app-onboarding-tooltip app-onboarding-tooltip--map-overlay',
          },
          { selector: '[data-onboarding="city-map-filters"]', title: 'Bộ lọc bản đồ', intro: 'Mở bộ lọc để tìm địa điểm theo từ khóa, phường, danh mục và dịch vụ merchant.' },
          { selector: '[data-onboarding="city-map-stats"]', title: 'Thống kê nhanh', intro: 'Khung này cho biết số ward, số địa điểm đang hiển thị và trạng thái định vị của bạn.' },
        ],
      },
      merchant: {
        steps: [
          { title: 'Khu merchant', intro: 'Đây là khu làm việc dành cho merchant. Bạn có thể đăng địa điểm mới và quản lý bài đăng.' },
          { selector: '[data-onboarding="merchant-sidebar"]', title: 'Bảng điều khiển merchant', intro: 'Đây là khu vực chính để merchant quản lý nội dung và điều hướng các tác vụ.' },
          { selector: '[data-onboarding="merchant-publish-button"]', title: 'Đăng địa điểm mới', intro: 'Bấm vào đây để tạo bài đăng hoặc gửi địa điểm mới lên hệ thống.' },
          { selector: '[data-onboarding="merchant-menu"]', title: 'Menu quản lý', intro: 'Bạn có thể chuyển giữa tổng quan, bài đăng và các khu hỗ trợ từ menu này.' },
          { selector: '[data-onboarding="merchant-post-tabs"]', title: 'Trạng thái bài đăng', intro: 'Dùng các tab này để xem bài đã duyệt, chờ duyệt hoặc bị từ chối.' },
          {
            selector: '[data-onboarding="merchant-post-list"]',
            title: 'Danh sách bài đăng',
            intro: 'Tại đây merchant chỉnh sửa, tạm ẩn hoặc xóa từng bài đăng.',
            position: 'floating',
            tooltipClass: 'app-onboarding-tooltip app-onboarding-tooltip--compact',
          },
        ],
      },
      'merchant-workbench': {
        steps: [
          { title: 'Form đăng bài', intro: 'Form này dùng để gửi địa điểm mới hoặc cập nhật địa điểm.' },
          { selector: '[data-onboarding="merchant-form-header"]', title: 'Biểu mẫu gửi địa điểm', intro: 'Đây là form chính để merchant đăng ký hoặc cập nhật địa điểm.' },
          { selector: '[data-onboarding="merchant-form-basic"]', position: 'floating', title: 'Thông tin cơ bản', intro: 'Nhập tên địa điểm, danh mục, số điện thoại và mô tả để bài đăng đầy đủ thông tin.' },
          { selector: '[data-onboarding="merchant-form-location"]', position: 'floating', title: 'Vị trí và giờ mở cửa', intro: 'Thiết lập địa chỉ, phường, vị trí trên bản đồ và lịch hoạt động theo ngày.' },
          { selector: '[data-onboarding="merchant-form-services"]', position: 'floating', title: 'Dịch vụ cung cấp', intro: 'Chọn các dịch vụ mà cơ sở của bạn hỗ trợ để người dùng dễ lọc và tìm kiếm.' },
          { selector: '[data-onboarding="merchant-form-submit"]', title: 'Gửi duyệt', intro: 'Sau khi điền đủ dữ liệu, gửi biểu mẫu để admin kiểm duyệt trước khi hiển thị công khai.' },
        ],
      },
      admin: {
        steps: [
          { title: 'Khu admin', intro: 'Đây là khu quản trị hệ thống. Admin có thể theo dõi tổng quan và quản lý các luồng duyệt.' },
          { selector: '[data-onboarding="admin-nav"]', title: 'Điều hướng quản trị', intro: 'Sidebar admin gom toàn bộ khu quản lý người dùng, bản đồ, báo cáo và kiểm duyệt.' },
          { selector: '[data-onboarding="admin-topbar"]', title: 'Thanh công cụ', intro: 'Tại đây admin đổi ngôn ngữ, giao diện và theo dõi thông báo.' },
          { selector: '[data-onboarding="admin-hero"]', title: 'Tổng quan hệ thống', intro: 'Khối này mô tả nhanh phạm vi quản trị hiện tại của toàn bộ hệ thống.' },
          { selector: '[data-onboarding="admin-metrics"]', title: 'Chỉ số chính', intro: 'Các thẻ số liệu giúp admin theo dõi venue, kiểm duyệt, quảng cáo và độ phủ dữ liệu.' },
        ],
      },
      profile: {
        steps: [
          { title: 'Hồ sơ cá nhân', intro: 'Trang hồ sơ cho phép người dùng cập nhật thông tin cá nhân, quản lý mục yêu thích và điều chỉnh sở thích.' },
          { selector: '[data-onboarding="profile-header"]', title: 'Thông tin nhanh', intro: 'Khu trên cùng hiển thị avatar, tên tài khoản và các thao tác liên quan đến hồ sơ.' },
          { selector: '[data-onboarding="profile-sidebar"]', title: 'Menu hồ sơ', intro: 'Dùng menu này để chuyển giữa thông tin tài khoản, favorites, đánh giá và khu hỗ trợ.', position: 'right' },
          {
            selector: '[data-onboarding="profile-main-header"]',
            title: 'Nội dung chính',
            intro: 'Tại đây bạn xem và chỉnh sửa thông tin cá nhân, mở form đổi mật khẩu hoặc cập nhật sở thích.',
            position: 'bottom',
            tooltipClass: 'app-onboarding-tooltip app-onboarding-tooltip--compact',
          },
        ],
      },
      feedback: {
        steps: [
          { title: 'Feedback và hỗ trợ', intro: 'Trang này dùng để gửi góp ý, báo lỗi hoặc yêu cầu hỗ trợ trực tiếp cho hệ thống.' },
          { selector: '[data-onboarding="feedback-header"]', title: 'Thông tin liên hệ', intro: 'Phần đầu trang cung cấp mục đích của form và thông tin liên hệ khi cần hỗ trợ nhanh.' },
          {
            selector: '[data-onboarding="feedback-form"]',
            position: 'floating',
            tooltipClass: 'app-onboarding-tooltip app-onboarding-tooltip--map-overlay',
            title: 'Form gửi phản hồi',
            intro: 'Chọn loại vấn đề, nhập nội dung, số điện thoại và đính kèm file nếu cần rồi bấm gửi.',
          },
        ],
      },
    },
    en: {
      overview: {
        steps: [
          { title: 'Welcome', intro: 'This is a quick guide for new users. Click Next to walk through the main features of the system.' },
          { selector: '[data-onboarding="landing-logo"]', title: 'Home', intro: 'Click the logo to return to the overview screen at any time.' },
          { selector: '[data-onboarding="landing-nav"]', title: 'Main navigation', intro: 'This bar helps you move quickly through the main areas and project introduction content.' },
          { selector: '[data-onboarding="overview-hero-actions"]', title: 'Quick actions', intro: 'This area gives you fast access to important actions such as search and the main sections.' },
          { selector: '[data-onboarding="overview-search"]', title: 'Search', intro: 'Enter a venue name, address, ward, or service to filter data directly from the home page.' },
          { selector: '[data-onboarding="overview-filter-button"]', title: 'Filters', intro: 'Open filters to narrow results by category, ward, and merchant services.' },
          {
            selector: '[data-onboarding="overview-map-anchor"]',
            title: 'City map',
            intro: 'The overview map helps you quickly scan notable places and jump into the detailed map area.',
            position: 'floating',
            tooltipClass: 'app-onboarding-tooltip app-onboarding-tooltip--map-overlay',
          },
          {
            selector: isAuthenticated ? '[data-onboarding="landing-profile"]' : '[data-onboarding="landing-login"]',
            title: isAuthenticated ? 'Your account' : 'Sign in',
            intro: isAuthenticated
              ? 'Open this menu to access your profile, manage posts, send feedback, and use personal tools.'
              : 'Sign in to save a personalized experience and unlock the full system features.',
          },
        ],
      },
      discovery: {
        steps: [
          { title: 'Discovery', intro: 'This page helps users explore places through filters and the map.' },
          { selector: '[data-onboarding="workspace-nav"]', title: 'Workspace sidebar', intro: 'This sidebar lets you switch quickly between overview, discovery, merchant, and admin areas.' },
          { selector: '[data-onboarding="discovery-filters"]', title: 'Discovery filters', intro: 'Here you can filter by keyword, venue category, and ward.' },
          {
            selector: '[data-onboarding="discovery-map"]',
            title: 'Interactive map',
            intro: 'The map shows ward boundaries and approved venues so you can explore visually.',
            position: 'floating',
            tooltipClass: 'app-onboarding-tooltip app-onboarding-tooltip--map-overlay',
          },
          { selector: '[data-onboarding="discovery-list"]', title: 'Results list', intro: 'This list stays in sync with the current filters so you can track the visible venues.' },
        ],
      },
      'city-map': {
        steps: [
          { title: 'City map', intro: 'This is the most detailed map screen in the system.' },
          { selector: '[data-onboarding="city-map-header"]', title: 'Header bar', intro: 'From here you can return to the home page and confirm that you are on the city map screen.' },
          {
            selector: '[data-onboarding="city-map-canvas"]',
            title: 'Map canvas',
            intro: 'Click a marker to open venue information.',
            position: 'floating',
            tooltipClass: 'app-onboarding-tooltip app-onboarding-tooltip--map-overlay',
          },
          { selector: '[data-onboarding="city-map-filters"]', title: 'Map filters', intro: 'Open filters to search places by keyword, ward, category, and merchant services.' },
          { selector: '[data-onboarding="city-map-stats"]', title: 'Quick stats', intro: 'This panel shows the number of wards, visible venues, and your current location status.' },
        ],
      },
      merchant: {
        steps: [
          { title: 'Merchant area', intro: 'This is the merchant workspace. You can submit new venues and manage your posts here.' },
          { selector: '[data-onboarding="merchant-sidebar"]', title: 'Merchant dashboard', intro: 'This is the main area for merchants to manage content and move between tasks.' },
          { selector: '[data-onboarding="merchant-publish-button"]', title: 'Submit a new venue', intro: 'Click here to create a post or submit a new venue to the system.' },
          { selector: '[data-onboarding="merchant-menu"]', title: 'Management menu', intro: 'Use this menu to switch between overview, posts, and support sections.' },
          { selector: '[data-onboarding="merchant-post-tabs"]', title: 'Post status tabs', intro: 'Use these tabs to review approved, pending, or rejected posts.' },
          {
            selector: '[data-onboarding="merchant-post-list"]',
            title: 'Post list',
            intro: 'Here merchants can edit, hide temporarily, or delete each post.',
            position: 'floating',
            tooltipClass: 'app-onboarding-tooltip app-onboarding-tooltip--compact',
          },
        ],
      },
      'merchant-workbench': {
        steps: [
          { title: 'Submission form', intro: 'This form is used to submit a new venue or update an existing one.' },
          { selector: '[data-onboarding="merchant-form-header"]', title: 'Venue submission form', intro: 'This is the main form merchants use to register or update a venue.' },
          { selector: '[data-onboarding="merchant-form-basic"]', position: 'floating', title: 'Basic information', intro: 'Enter the venue name, category, phone number, and description so the listing is complete.' },
          { selector: '[data-onboarding="merchant-form-location"]', position: 'floating', title: 'Location and opening hours', intro: 'Set the address, ward, map position, and operating schedule by day.' },
          { selector: '[data-onboarding="merchant-form-services"]', position: 'floating', title: 'Available services', intro: 'Choose the services your venue supports so users can filter and search more easily.' },
          { selector: '[data-onboarding="merchant-form-submit"]', title: 'Submit for review', intro: 'After filling in the required data, submit the form so an admin can review it before public display.' },
        ],
      },
      admin: {
        steps: [
          { title: 'Admin area', intro: 'This is the system administration area. Admins can monitor the platform and manage approval flows.' },
          { selector: '[data-onboarding="admin-nav"]', title: 'Admin navigation', intro: 'The admin sidebar groups user management, maps, reports, and moderation tools in one place.' },
          { selector: '[data-onboarding="admin-topbar"]', title: 'Toolbar', intro: 'Admins can switch language, change theme, and monitor notifications here.' },
          { selector: '[data-onboarding="admin-hero"]', title: 'System overview', intro: 'This block gives a quick summary of the current administrative scope across the platform.' },
          { selector: '[data-onboarding="admin-metrics"]', title: 'Key metrics', intro: 'These metrics help admins track venues, approvals, ads, and data coverage.' },
        ],
      },
      profile: {
        steps: [
          { title: 'Profile', intro: 'The profile page lets users update personal information, manage favorites, and adjust preferences.' },
          { selector: '[data-onboarding="profile-header"]', title: 'Quick info', intro: 'The top section shows your avatar, account name, and profile-related actions.' },
          { selector: '[data-onboarding="profile-sidebar"]', title: 'Profile menu', intro: 'Use this menu to switch between account details, favorites, reviews, and support.', position: 'right' },
          {
            selector: '[data-onboarding="profile-main-header"]',
            title: 'Main content',
            intro: 'Here you can view and edit your personal information, open the password form, or update preferences.',
            position: 'bottom',
            tooltipClass: 'app-onboarding-tooltip app-onboarding-tooltip--compact',
          },
        ],
      },
      feedback: {
        steps: [
          { title: 'Feedback and support', intro: 'This page is used to send suggestions, report issues, or request direct support for the system.' },
          { selector: '[data-onboarding="feedback-header"]', title: 'Contact information', intro: 'The top section explains the purpose of the form and shows contact information for urgent support.' },
          {
            selector: '[data-onboarding="feedback-form"]',
            position: 'floating',
            tooltipClass: 'app-onboarding-tooltip app-onboarding-tooltip--map-overlay',
            title: 'Feedback form',
            intro: 'Choose the issue type, enter the message and phone number, attach a file if needed, then submit.',
          },
        ],
      },
    },
  };

  return copy[language] || copy.vi;
}

function resolveUserStorageSegment(user) {
  const userId = String(user?.id || user?.user_id || user?.userId || '').trim();
  if (userId) return `user:${userId}`;

  const email = String(user?.email || '').trim().toLowerCase();
  if (email) return `email:${email}`;

  const username = String(user?.username || '').trim().toLowerCase();
  if (username) return `username:${username}`;

  return '';
}

function buildStorageKey(scope, userStorageSegment) {
  return `${STORAGE_PREFIX}:${userStorageSegment}:${scope}`;
}

function resolveMatchedSteps(definition) {
  return (definition?.steps || [])
    .map((step) => {
      if (!step.selector) {
        return { title: step.title, intro: step.intro };
      }

      const element = document.querySelector(step.selector);
      if (!element) return null;

      return {
        element,
        title: step.title,
        intro: step.intro,
        position: step.position,
        tooltipClass: step.tooltipClass,
      };
    })
    .filter(Boolean);
}

function readPendingNewAccount() {
  try {
    const rawValue = window.localStorage.getItem(NEW_ACCOUNT_ONBOARDING_KEY);
    if (!rawValue) return null;
    const parsedValue = JSON.parse(rawValue);
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : null;
  } catch {
    return null;
  }
}

function matchesPendingNewAccount(user, pendingAccount) {
  if (!user || !pendingAccount) return false;

  const normalizedEmail = String(user.email || '').trim().toLowerCase();
  const normalizedUsername = String(user.username || '').trim().toLowerCase();
  const pendingEmail = String(pendingAccount.email || '').trim().toLowerCase();
  const pendingUsername = String(pendingAccount.username || '').trim().toLowerCase();

  return Boolean(
    (pendingEmail && normalizedEmail && pendingEmail === normalizedEmail)
      || (pendingUsername && normalizedUsername && pendingUsername === normalizedUsername)
  );
}

function canStartOnboardingForPendingAccount(user, pendingAccount) {
  return matchesPendingNewAccount(user, pendingAccount) && pendingAccount?.preferencesSaved === true;
}

function moveSkipButtonToFooter() {
  const tooltip = document.querySelector('.app-onboarding-tooltip, .introjs-tooltip');
  if (!tooltip) return;

  const skipButton = tooltip.querySelector('.introjs-skipbutton');
  const buttonRow = tooltip.querySelector('.introjs-tooltipbuttons');
  if (!skipButton || !buttonRow) return;

  if (skipButton.parentElement !== buttonRow) {
    buttonRow.prepend(skipButton);
  }
}

function syncTooltipLayoutWithRetry(language, onLanguageChange, ui, attempt = 0) {
  moveSkipButtonToFooter();
  injectLanguageSwitcher(language, onLanguageChange, ui);

  if (attempt >= 5) {
    return;
  }

  window.setTimeout(() => {
    syncTooltipLayoutWithRetry(language, onLanguageChange, ui, attempt + 1);
  }, 40);
}

function injectLanguageSwitcher(language, onLanguageChange, ui) {
  const tooltip = document.querySelector('.app-onboarding-tooltip');
  if (!tooltip) return;

  const existingControl = tooltip.querySelector('.app-onboarding-header-controls');
  if (existingControl) {
    existingControl.remove();
  }

  const controls = document.createElement('div');
  controls.className = 'app-onboarding-header-controls';

  const select = document.createElement('select');
  select.className = 'app-onboarding-language-select';
  select.setAttribute('aria-label', ui.languageLabel);

  Object.entries(ui.languageOptions).forEach(([langCode, label]) => {
    const option = document.createElement('option');
    option.value = langCode;
    option.textContent = label;
    select.appendChild(option);
  });

  select.value = language;
  select.addEventListener('change', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onLanguageChange(event.target.value);
  });

  controls.appendChild(select);
  tooltip.appendChild(controls);
}

function AppOnboarding() {
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const introRef = useRef(null);
  const autoStartedScopeRef = useRef('');
  const allowExitRef = useRef(false);
  const skipStorageKeyRef = useRef('');
  const pendingRestartStepRef = useRef(null);
  const [language, setLanguage] = useState(() => {
    if (typeof window === 'undefined') return 'vi';
    return window.localStorage.getItem(ONBOARDING_LANGUAGE_KEY) === 'en' ? 'en' : 'vi';
  });
  const previousLanguageRef = useRef(language);
  const languageRef = useRef(language);
  const [preferenceSaveSignal, setPreferenceSaveSignal] = useState(0);
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);
  const [skipProcessing, setSkipProcessing] = useState(false);

  const onboardingDefinitions = useMemo(
    () => buildScopeDefinitions(language, isAuthenticated),
    [language, isAuthenticated]
  );

  const onboardingUi = useMemo(
    () => ONBOARDING_UI[language] || ONBOARDING_UI.vi,
    [language]
  );
  const onboardingUiRef = useRef(onboardingUi);

  const currentScope = useMemo(
    () => resolveOnboardingScope(location.pathname),
    [location.pathname]
  );

  const currentDefinition = currentScope ? onboardingDefinitions[currentScope] : null;
  const userStorageSegment = useMemo(() => resolveUserStorageSegment(user), [user]);
  const shouldAutoShow = useMemo(() => {
    if (!isAuthenticated || !userStorageSegment) return false;
    return canStartOnboardingForPendingAccount(user, readPendingNewAccount());
  }, [isAuthenticated, preferenceSaveSignal, user, userStorageSegment]);

  const clearPendingNewAccount = () => {
    window.localStorage.removeItem(NEW_ACCOUNT_ONBOARDING_KEY);
  };

  const handleLanguageChange = (nextLanguage) => {
    const normalized = nextLanguage === 'en' ? 'en' : 'vi';
    pendingRestartStepRef.current = introRef.current?.currentStep?.() ?? 0;
    setLanguage(normalized);
    window.localStorage.setItem(ONBOARDING_LANGUAGE_KEY, normalized);
  };

  const finalizeIntroInstance = () => {
    introRef.current = null;
    allowExitRef.current = false;
    skipStorageKeyRef.current = '';
    setSkipProcessing(false);
  };

  const stopCurrentIntro = () => {
    if (introRef.current) {
      allowExitRef.current = true;
      introRef.current.exit();
      finalizeIntroInstance();
    }
  };

  const restartOnboardingAtStep = (step = 0) => {
    stopCurrentIntro();
    window.setTimeout(() => {
      startOnboarding(true, step);
    }, 90);
  };

  const syncTooltipLayout = () => {
    syncTooltipLayoutWithRetry(languageRef.current, handleLanguageChange, onboardingUiRef.current);
  };

  const handleCancelSkip = () => {
    setSkipConfirmOpen(false);
    setSkipProcessing(false);
  };

  const handleConfirmSkip = () => {
    if (!skipStorageKeyRef.current || !introRef.current) {
      setSkipConfirmOpen(false);
      return;
    }

    setSkipProcessing(true);
    window.localStorage.setItem(skipStorageKeyRef.current, 'done');
    clearPendingNewAccount();
    allowExitRef.current = true;
    setSkipConfirmOpen(false);
    window.setTimeout(() => {
      introRef.current?.exit();
      finalizeIntroInstance();
    }, 0);
  };

  const startOnboarding = (force = false, initialStep = 0) => {
    if (!currentScope || !currentDefinition || !userStorageSegment) return;

    const storageKey = buildStorageKey(currentScope, userStorageSegment);
    if (!force && !shouldAutoShow) return;
    if (!force && window.localStorage.getItem(storageKey) === 'done') return;

    const matchedSteps = resolveMatchedSteps(currentDefinition);
    if (!matchedSteps.length) return;

    const safeInitialStep = Math.max(0, Math.min(initialStep, matchedSteps.length - 1));

    stopCurrentIntro();

    const intro = introJs();
    introRef.current = intro;
    allowExitRef.current = false;

    intro.setOptions({
      steps: matchedSteps,
      nextLabel: onboardingUi.nextLabel,
      prevLabel: onboardingUi.prevLabel,
      doneLabel: onboardingUi.doneLabel,
      skipLabel: onboardingUi.skipLabel,
      tooltipPosition: 'bottom',
      positionPrecedence: ['bottom', 'right', 'left', 'top'],
      autoPosition: true,
      showProgress: true,
      showBullets: false,
      scrollToElement: true,
      scrollPadding: 24,
      exitOnOverlayClick: false,
      exitOnEsc: false,
      overlayOpacity: 0.82,
      showStepNumbers: false,
      nextToDone: true,
      tooltipClass: 'app-onboarding-tooltip',
      highlightClass: 'app-onboarding-highlight',
      helperElementPadding: 8,
    });

    intro.onbeforeexit(() => {
      if (allowExitRef.current) return true;
      skipStorageKeyRef.current = storageKey;
      setSkipConfirmOpen(true);
      return false;
    });

    intro.oncomplete(() => {
      allowExitRef.current = true;
      window.localStorage.setItem(storageKey, 'done');
      clearPendingNewAccount();
      intro.exit();
      finalizeIntroInstance();
    });

    intro.onexit(() => {
      finalizeIntroInstance();
    });

    intro.onafterchange(() => {
      window.setTimeout(syncTooltipLayout, 0);
    });

    Promise.resolve(intro.start())
      .then(() => {
        if (safeInitialStep > 0) {
          return intro.goToStep(safeInitialStep + 1);
        }
        return null;
      })
      .finally(() => {
        window.setTimeout(syncTooltipLayout, 0);
      });
  };

  useEffect(() => {
    autoStartedScopeRef.current = '';
    setSkipConfirmOpen(false);
    setSkipProcessing(false);
    stopCurrentIntro();
  }, [location.pathname]);

  useEffect(() => {
    languageRef.current = language;
    onboardingUiRef.current = onboardingUi;
  }, [language, onboardingUi]);

  useEffect(() => {
    const className = 'app-onboarding-confirm-open';
    document.body.classList.toggle(className, skipConfirmOpen);
    return () => {
      document.body.classList.remove(className);
    };
  }, [skipConfirmOpen]);

  useEffect(() => {
    const previousLanguage = previousLanguageRef.current;
    previousLanguageRef.current = language;

    if (previousLanguage === language) return;
    if (pendingRestartStepRef.current == null) return;

    const nextStep = pendingRestartStepRef.current;
    pendingRestartStepRef.current = null;
    restartOnboardingAtStep(nextStep);
  }, [language, currentDefinition]);

  useEffect(() => {
    const handlePreferencesSaved = () => {
      setPreferenceSaveSignal((currentValue) => currentValue + 1);
    };

    const handleRestartOnboarding = () => {
      startOnboarding(true);
    };

    window.addEventListener('smart-city-preferences-saved', handlePreferencesSaved);
    window.addEventListener('smart-city-onboarding-restart', handleRestartOnboarding);

    return () => {
      window.removeEventListener('smart-city-preferences-saved', handlePreferencesSaved);
      window.removeEventListener('smart-city-onboarding-restart', handleRestartOnboarding);
    };
  }, [currentDefinition, currentScope, shouldAutoShow, userStorageSegment, language]);

  useEffect(() => {
    if (!currentScope || !currentDefinition || !shouldAutoShow || !userStorageSegment) {
      return undefined;
    }

    const storageKey = buildStorageKey(currentScope, userStorageSegment);
    if (window.localStorage.getItem(storageKey) === 'done') {
      clearPendingNewAccount();
      return undefined;
    }

    if (autoStartedScopeRef.current === `${userStorageSegment}:${currentScope}`) {
      return undefined;
    }

    autoStartedScopeRef.current = `${userStorageSegment}:${currentScope}`;
    const timerId = window.setTimeout(() => startOnboarding(), 450);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [currentDefinition, currentScope, shouldAutoShow, userStorageSegment, language]);

  useEffect(
    () => () => {
      stopCurrentIntro();
    },
    []
  );

  return skipConfirmOpen ? (
    <div className="app-onboarding-modal-backdrop" role="presentation">
      <div
        className="app-onboarding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-onboarding-skip-title"
        aria-describedby="app-onboarding-skip-description"
      >
        <div className="app-onboarding-modal-top">
          <div className="app-onboarding-modal-badge">{onboardingUi.guideBadge}</div>
          <div className="app-onboarding-modal-language">
            <span>{onboardingUi.languageLabel}</span>
            <button
              type="button"
              className="app-onboarding-modal-language-toggle"
              onClick={() => handleLanguageChange(language === 'vi' ? 'en' : 'vi')}
            >
              {language === 'vi' ? 'EN' : 'VI'}
            </button>
          </div>
        </div>
        <h3 id="app-onboarding-skip-title">{onboardingUi.skipTitle}</h3>
        <p id="app-onboarding-skip-description">{onboardingUi.skipDescription}</p>
        <div className="app-onboarding-modal-actions">
          <button
            type="button"
            className="app-onboarding-modal-button is-secondary"
            onClick={handleCancelSkip}
            disabled={skipProcessing}
          >
            {onboardingUi.skipNo}
          </button>
          <button
            type="button"
            className="app-onboarding-modal-button is-primary"
            onClick={handleConfirmSkip}
            disabled={skipProcessing}
          >
            {skipProcessing ? onboardingUi.skipProcessing : onboardingUi.skipYes}
          </button>
        </div>
      </div>
    </div>
  ) : null;
}

export default AppOnboarding;
