import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import introJs from 'intro.js';
import 'intro.js/minified/introjs.min.css';
import { useAuth } from '../../contexts/AuthContext';
import './AppOnboarding.css';

const STORAGE_PREFIX = 'smart-city-onboarding';
const NEW_ACCOUNT_ONBOARDING_KEY = 'smart-city-onboarding:new-account';

function resolveOnboardingScope(pathname) {
  if (pathname.startsWith('/admin')) {
    return 'admin';
  }

  if (pathname === '/city-map') {
    return 'city-map';
  }

  if (pathname.startsWith('/merchant/workbench')) {
    return 'merchant-workbench';
  }

  if (pathname.startsWith('/merchant')) {
    return 'merchant';
  }

  if (pathname.startsWith('/discovery')) {
    return 'discovery';
  }

  if (pathname === '/profile') {
    return 'profile';
  }

  if (pathname === '/feedback') {
    return 'feedback';
  }

  if (pathname === '/') {
    return 'overview';
  }

  return null;
}

function buildScopeDefinitions(isAuthenticated) {
  return {
    overview: {
      steps: [
        {
          title: 'Chào mừng',
          intro:
            'Đây là hướng dẫn nhanh cho người mới. Bấm Tiếp tục để xem từng chức năng chính của hệ thống.',
        },
        {
          selector: '[data-onboarding="landing-logo"]',
          title: 'Trang chủ',
          intro: 'Bấm vào logo để quay lại màn hình tổng quan bất kỳ lúc nào.',
        },
        {
          selector: '[data-onboarding="landing-nav"]',
          title: 'Điều hướng chính',
          intro: 'Thanh này giúp bạn đi nhanh qua các khu chức năng và nội dung giới thiệu của đồ án.',
        },
        {
          selector: '[data-onboarding="overview-hero-actions"]',
          title: 'Lối vào nhanh',
          intro: 'Khu này cho phép bạn truy cập nhanh vào các thao tác quan trọng như tìm kiếm và các khu vực chính.',
        },
        {
          selector: '[data-onboarding="overview-search"]',
          title: 'Tìm kiếm',
          intro: 'Nhập tên quán, địa chỉ, phường hoặc dịch vụ để lọc dữ liệu ngay trên trang chủ.',
        },
        {
          selector: '[data-onboarding="overview-filter-button"]',
          title: 'Bộ lọc',
          intro: 'Mở bộ lọc để thu hẹp kết quả theo danh mục, phường và dịch vụ merchant.',
        },
        {
          selector: '[data-onboarding="overview-map-anchor"]',
          title: 'Bản đồ thành phố',
          intro: 'Bản đồ tổng quan giúp bạn nhìn nhanh các điểm nổi bật và đi vào khu bản đồ chi tiết.',
          position: 'floating',
          tooltipClass: 'app-onboarding-tooltip app-onboarding-tooltip--map-overlay',
        },
        {
          selector: isAuthenticated
            ? '[data-onboarding="landing-profile"]'
            : '[data-onboarding="landing-login"]',
          title: isAuthenticated ? 'Tài khoản của bạn' : 'Đăng nhập',
          intro: isAuthenticated
            ? 'Mở menu này để vào hồ sơ, quản lý bài đăng, feedback và các chức năng cá nhân.'
            : 'Đăng nhập để lưu trải nghiệm cá nhân hóa và sử dụng đầy đủ chức năng của hệ thống.',
        },
      ],
    },
    discovery: {
      steps: [
        {
          title: 'Khám phá',
          intro: 'Trang này giúp người dùng khám phá địa điểm theo bộ lọc và bản đồ.',
        },
        {
          selector: '[data-onboarding="workspace-nav"]',
          title: 'Sidebar làm việc',
          intro: 'Sidebar này là nơi chuyển nhanh giữa tổng quan, khám phá, merchant và admin.',
        },
        {
          selector: '[data-onboarding="discovery-filters"]',
          title: 'Bộ lọc khám phá',
          intro: 'Tại đây bạn lọc theo từ khóa, danh mục địa điểm và phường.',
        },
        {
          selector: '[data-onboarding="discovery-map"]',
          title: 'Bản đồ tương tác',
          intro: 'Bản đồ hiển thị ranh giới phường và các địa điểm đã duyệt để bạn khám phá trực quan.',
          position: 'floating',
          tooltipClass: 'app-onboarding-tooltip app-onboarding-tooltip--map-overlay',
        },
        {
          selector: '[data-onboarding="discovery-list"]',
          title: 'Danh sách kết quả',
          intro: 'Danh sách này đồng bộ với bộ lọc hiện tại để bạn theo dõi các địa điểm đang hiển thị.',
        },
      ],
    },
    'city-map': {
      steps: [
        {
          title: 'Bản đồ thành phố',
          intro: 'Đây là màn hình bản đồ chi tiết nhất của hệ thống.',
        },
        {
          selector: '[data-onboarding="city-map-header"]',
          title: 'Thanh tiêu đề',
          intro: 'Từ đây bạn quay về trang chủ và xác định mình đang ở màn hình bản đồ thành phố.',
        },
        {
          selector: '[data-onboarding="city-map-canvas"]',
          title: 'Vùng bản đồ',
          intro: 'Bấm vào marker để mở thông tin địa điểm.',
          position: 'floating',
          tooltipClass: 'app-onboarding-tooltip app-onboarding-tooltip--map-overlay',
        },
        {
          selector: '[data-onboarding="city-map-filters"]',
          title: 'Bộ lọc bản đồ',
          intro: 'Mở bộ lọc để tìm địa điểm theo từ khóa, phường, danh mục và dịch vụ merchant.',
        },
        {
          selector: '[data-onboarding="city-map-stats"]',
          title: 'Thống kê nhanh',
          intro: 'Khung này cho biết số ward, số địa điểm đang hiển thị và trạng thái định vị của bạn.',
        },
      ],
    },
    merchant: {
      steps: [
        {
          title: 'Khu merchant',
          intro: 'Đây là khu làm việc dành cho merchant. Bạn có thể đăng địa điểm mới và quản lý bài đăng.',
        },
        {
          selector: '[data-onboarding="merchant-sidebar"]',
          title: 'Bảng điều khiển merchant',
          intro: 'Đây là khu vực chính để merchant quản lý nội dung và điều hướng các tác vụ.',
        },
        {
          selector: '[data-onboarding="merchant-publish-button"]',
          title: 'Đăng địa điểm mới',
          intro: 'Bấm vào đây để tạo bài đăng hoặc gửi địa điểm mới lên hệ thống.',
        },
        {
          selector: '[data-onboarding="merchant-menu"]',
          title: 'Menu quản lý',
          intro: 'Bạn có thể chuyển giữa tổng quan, bài đăng và các khu hỗ trợ từ menu này.',
        },
        {
          selector: '[data-onboarding="merchant-post-tabs"]',
          title: 'Trạng thái bài đăng',
          intro: 'Dùng các tab này để xem bài đã duyệt, chờ duyệt hoặc bị từ chối.',
        },
        {
          selector: '[data-onboarding="merchant-post-list"]',
          title: 'Danh sách bài đăng',
          intro: 'Tại đây merchant chỉnh sửa, tạm ẩn hoặc xóa từng bài đăng.',
        },
      ],
    },
    'merchant-workbench': {
      steps: [
        {
          title: 'Form đăng bài',
          intro: 'Form này dùng để gửi địa điểm mới hoặc cập nhật địa điểm.',
        },
        {
          selector: '[data-onboarding="merchant-form-header"]',
          title: 'Biểu mẫu gửi địa điểm',
          intro: 'Đây là form chính để merchant đăng ký hoặc cập nhật địa điểm.',
        },
        {
          selector: '[data-onboarding="merchant-form-basic"]',
          title: 'Thông tin cơ bản',
          intro: 'Nhập tên địa điểm, danh mục, số điện thoại và mô tả để bài đăng đầy đủ thông tin.',
        },
        {
          selector: '[data-onboarding="merchant-form-location"]',
          title: 'Vị trí và giờ mở cửa',
          intro: 'Thiết lập địa chỉ, phường, vị trí trên bản đồ và lịch hoạt động theo ngày.',
        },
        {
          selector: '[data-onboarding="merchant-form-services"]',
          title: 'Dịch vụ cung cấp',
          intro: 'Chọn các dịch vụ mà cơ sở của bạn hỗ trợ để người dùng dễ lọc và tìm kiếm.',
        },
        {
          selector: '[data-onboarding="merchant-form-submit"]',
          title: 'Gửi duyệt',
          intro: 'Sau khi điền đủ dữ liệu, gửi biểu mẫu để admin kiểm duyệt trước khi hiển thị công khai.',
        },
      ],
    },
    admin: {
      steps: [
        {
          title: 'Khu admin',
          intro: 'Đây là khu quản trị hệ thống. Admin có thể theo dõi tổng quan và quản lý các luồng duyệt.',
        },
        {
          selector: '[data-onboarding="admin-nav"]',
          title: 'Điều hướng quản trị',
          intro: 'Sidebar admin gom toàn bộ khu quản lý người dùng, bản đồ, báo cáo và kiểm duyệt.',
        },
        {
          selector: '[data-onboarding="admin-topbar"]',
          title: 'Thanh công cụ',
          intro: 'Tại đây admin đổi ngôn ngữ, giao diện và theo dõi thông báo.',
        },
        {
          selector: '[data-onboarding="admin-hero"]',
          title: 'Tổng quan hệ thống',
          intro: 'Khối này mô tả nhanh phạm vi quản trị hiện tại của toàn bộ hệ thống.',
        },
        {
          selector: '[data-onboarding="admin-metrics"]',
          title: 'Chỉ số chính',
          intro: 'Các thẻ số liệu giúp admin theo dõi venue, kiểm duyệt, quảng cáo và độ phủ dữ liệu.',
        },
      ],
    },
    profile: {
      steps: [
        {
          title: 'Hồ sơ cá nhân',
          intro: 'Trang hồ sơ cho phép người dùng cập nhật thông tin cá nhân, quản lý mục yêu thích và điều chỉnh sở thích.',
        },
        {
          selector: '[data-onboarding="profile-header"]',
          title: 'Thông tin nhanh',
          intro: 'Khu trên cùng hiển thị avatar, tên tài khoản và các thao tác liên quan đến hồ sơ.',
        },
        {
          selector: '[data-onboarding="profile-sidebar"]',
          title: 'Menu hồ sơ',
          intro: 'Dùng menu này để chuyển giữa thông tin tài khoản, favorites, đánh giá và khu hỗ trợ.',
          position: 'right',
        },
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
        {
          title: 'Feedback và hỗ trợ',
          intro: 'Trang này dùng để gửi góp ý, báo lỗi hoặc yêu cầu hỗ trợ trực tiếp cho hệ thống.',
        },
        {
          selector: '[data-onboarding="feedback-header"]',
          title: 'Thông tin liên hệ',
          intro: 'Phần đầu trang cung cấp mục đích của form và thông tin liên hệ khi cần hỗ trợ nhanh.',
        },
        {
          selector: '[data-onboarding="feedback-form"]',
          position: 'floating',
          tooltipClass: 'app-onboarding-tooltip app-onboarding-tooltip--map-overlay',
          title: 'Form gửi phản hồi',
          intro: 'Chọn loại vấn đề, nhập nội dung, số điện thoại và đính kèm file nếu cần rồi bấm gửi.',
        },
      ],
    },
  };
}

function resolveUserStorageSegment(user) {
  const userId = String(user?.id || user?.user_id || user?.userId || '').trim();
  if (userId) {
    return `user:${userId}`;
  }

  const email = String(user?.email || '').trim().toLowerCase();
  if (email) {
    return `email:${email}`;
  }

  const username = String(user?.username || '').trim().toLowerCase();
  if (username) {
    return `username:${username}`;
  }

  return '';
}

function buildStorageKey(scope, userStorageSegment) {
  return `${STORAGE_PREFIX}:${userStorageSegment}:${scope}`;
}

function resolveMatchedSteps(definition) {
  return (definition?.steps || [])
    .map((step) => {
      if (!step.selector) {
        return {
          title: step.title,
          intro: step.intro,
        };
      }

      const element = document.querySelector(step.selector);
      if (!element) {
        return null;
      }

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
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);
    return parsedValue && typeof parsedValue === 'object' ? parsedValue : null;
  } catch {
    return null;
  }
}

function matchesPendingNewAccount(user, pendingAccount) {
  if (!user || !pendingAccount) {
    return false;
  }

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
  const tooltip = document.querySelector('.app-onboarding-tooltip');
  if (!tooltip) {
    return;
  }

  const skipButton = tooltip.querySelector('.introjs-skipbutton');
  const buttonRow = tooltip.querySelector('.introjs-tooltipbuttons');
  if (!skipButton || !buttonRow) {
    return;
  }

  if (skipButton.parentElement !== buttonRow) {
    buttonRow.prepend(skipButton);
  }
}

function AppOnboarding() {
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const introRef = useRef(null);
  const autoStartedScopeRef = useRef('');
  const allowExitRef = useRef(false);
  const skipStorageKeyRef = useRef('');
  const [preferenceSaveSignal, setPreferenceSaveSignal] = useState(0);
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);
  const [skipProcessing, setSkipProcessing] = useState(false);
  const onboardingDefinitions = useMemo(
    () => buildScopeDefinitions(isAuthenticated),
    [isAuthenticated]
  );

  const currentScope = useMemo(
    () => resolveOnboardingScope(location.pathname),
    [location.pathname]
  );

  const currentDefinition = currentScope ? onboardingDefinitions[currentScope] : null;
  const userStorageSegment = useMemo(() => resolveUserStorageSegment(user), [user]);
  const shouldAutoShow = useMemo(() => {
    if (!isAuthenticated || !userStorageSegment) {
      return false;
    }

    return canStartOnboardingForPendingAccount(user, readPendingNewAccount());
  }, [isAuthenticated, preferenceSaveSignal, user, userStorageSegment]);

  const clearPendingNewAccount = () => {
    window.localStorage.removeItem(NEW_ACCOUNT_ONBOARDING_KEY);
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

  const startOnboarding = (force = false) => {
    if (!currentScope || !currentDefinition || !userStorageSegment) {
      return;
    }

    const storageKey = buildStorageKey(currentScope, userStorageSegment);
    if (!force && !shouldAutoShow) {
      return;
    }

    if (!force && window.localStorage.getItem(storageKey) === 'done') {
      return;
    }

    const matchedSteps = resolveMatchedSteps(currentDefinition);
    if (!matchedSteps.length) {
      return;
    }

    stopCurrentIntro();

    const intro = introJs();
    introRef.current = intro;
    allowExitRef.current = false;

    intro.setOptions({
      steps: matchedSteps,
      nextLabel: 'Tiếp tục',
      prevLabel: '←',
      doneLabel: 'Hoàn tất',
      skipLabel: 'Bỏ qua',
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
      if (allowExitRef.current) {
        return true;
      }

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

    intro.start();
    window.setTimeout(moveSkipButtonToFooter, 0);
    intro.onafterchange(() => {
      window.setTimeout(moveSkipButtonToFooter, 0);
    });
  };

  useEffect(() => {
    autoStartedScopeRef.current = '';
    setSkipConfirmOpen(false);
    setSkipProcessing(false);
    stopCurrentIntro();
  }, [location.pathname]);

  useEffect(() => {
    const className = 'app-onboarding-confirm-open';
    document.body.classList.toggle(className, skipConfirmOpen);

    return () => {
      document.body.classList.remove(className);
    };
  }, [skipConfirmOpen]);

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
  }, [currentDefinition, currentScope, shouldAutoShow, userStorageSegment]);

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
  }, [currentDefinition, currentScope, shouldAutoShow, userStorageSegment]);

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
        <div className="app-onboarding-modal-badge">Hướng dẫn</div>
        <h3 id="app-onboarding-skip-title">Bạn đã nắm được cách sử dụng?</h3>
        <p id="app-onboarding-skip-description">
          Nếu chọn <strong>Có</strong>, hệ thống sẽ bỏ qua hướng dẫn cho tài khoản này. Nếu chọn <strong>Không</strong>,
          bạn sẽ quay lại ngay bước đang xem.
        </p>
        <div className="app-onboarding-modal-actions">
          <button
            type="button"
            className="app-onboarding-modal-button is-secondary"
            onClick={handleCancelSkip}
            disabled={skipProcessing}
          >
            Không
          </button>
          <button
            type="button"
            className="app-onboarding-modal-button is-primary"
            onClick={handleConfirmSkip}
            disabled={skipProcessing}
          >
            {skipProcessing ? 'Đang bỏ qua...' : 'Có, bỏ qua'}
          </button>
        </div>
      </div>
    </div>
  ) : null;
}

export default AppOnboarding;
