import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';

function getWorkspaceCopy(language) {
  const copy = {
    vi: {
      groupTitle: 'Không gian làm việc',
      overview: 'Tổng quan',
      overviewDesc: 'Trung tâm điều phối dự án',
      discovery: 'Khám phá',
      discoveryDesc: 'Khám phá địa điểm',
      adminBoundaries: 'Ranh giới quản trị',
      adminBoundariesDesc: 'Quản lý bản đồ phường',
      merchantWorkbench: 'Bảng điều khiển Merchant',
      merchantWorkbenchDesc: 'Công cụ quản lý địa điểm',
      brandCopy: 'Khung làm việc theo vai trò và tính năng để team triển khai song song đúng luồng.',
      backendBaseUrl: 'Đường dẫn backend',
      workspaceCurrent: 'Không gian hiện tại',
      workspaceFallback: 'Tổng quan',
      workspaceFallbackDesc: 'Trung tâm điều phối dự án.',
      scaffoldChip: 'Khung GIS ưu tiên',
      language: 'Ngôn ngữ',
      themeDark: 'Tối',
      themeLight: 'Sáng',
    },
    en: {
      groupTitle: 'Workspace',
      overview: 'Overview',
      overviewDesc: 'Project command center',
      discovery: 'Discovery',
      discoveryDesc: 'Explore venues',
      adminBoundaries: 'Admin Boundaries',
      adminBoundariesDesc: 'Manage GIS wards',
      merchantWorkbench: 'Merchant Workbench',
      merchantWorkbenchDesc: 'Merchant venue tools',
      brandCopy: 'Role and feature-based workspace so teams can deliver in parallel with clear flow.',
      backendBaseUrl: 'Backend base URL',
      workspaceCurrent: 'Current workspace',
      workspaceFallback: 'Overview',
      workspaceFallbackDesc: 'Project command center and delivery split.',
      scaffoldChip: 'GIS-first scaffold',
      language: 'Language',
      themeDark: 'Dark',
      themeLight: 'Light',
    },
  };

  return copy[language] || copy.vi;
}

function WorkspaceLayout() {
  const location = useLocation();
  const { language, changeLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const t = getWorkspaceCopy(language);
  const navigationGroups = [
    {
      title: t.groupTitle,
      items: [
        {
          code: 'OVR',
          label: t.overview,
          description: t.overviewDesc,
          path: '/',
        },
        {
          code: 'DSC',
          label: t.discovery,
          description: t.discoveryDesc,
          path: '/discovery',
        },
        {
          code: 'ADM',
          label: t.adminBoundaries,
          description: t.adminBoundariesDesc,
          path: '/admin/boundaries',
        },
        {
          code: 'MER',
          label: t.merchantWorkbench,
          description: t.merchantWorkbenchDesc,
          path: '/merchant',
        },
      ],
    },
  ];

  const flatItems = navigationGroups.flatMap((group) => group.items);
  const activeItem = flatItems.find((item) => {
    if (item.path === '/') {
      return location.pathname === '/';
    }

    return location.pathname.startsWith(item.path);
  });

  return (
    <div className="shell">
      <aside className="shell-sidebar">
        <div className="brand-block">
          <p className="brand-kicker">Smart City Discovery</p>
          <h1 className="brand-title">Delivery Cockpit</h1>
          <p className="brand-copy">{t.brandCopy}</p>
        </div>

        {navigationGroups.map((group) => (
          <div key={group.title} className="nav-group">
            <p className="nav-group-title">{group.title}</p>

            <div className="nav-links">
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`.trim()}
                >
                  <span className="nav-link-code">{item.code}</span>
                  <span>
                    <strong className="nav-link-label">{item.label}</strong>
                    <span className="nav-link-copy">{item.description}</span>
                  </span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        <div className="nav-footnote">
          <p className="nav-footnote-title">{t.backendBaseUrl}</p>
          <p className="nav-footnote-copy">VITE_API_BASE_URL or http://localhost:5000/api/v1</p>
        </div>
      </aside>

      <main className="shell-main">
        <header className="topbar">
          <div>
            <p className="topbar-kicker">{t.workspaceCurrent}</p>
            <h2 className="topbar-title">{activeItem?.label ?? t.workspaceFallback}</h2>
            <p className="topbar-copy">{activeItem?.description ?? t.workspaceFallbackDesc}</p>
          </div>

          <div className="topbar-actions-wrap">
            <label className="topbar-lang-wrap">
              <span>{t.language}</span>
              <select value={language} onChange={(event) => changeLanguage(event.target.value)}>
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </select>
            </label>
            <button type="button" className="topbar-theme-btn" onClick={toggleTheme}>
              {theme === 'light' ? `🌙 ${t.themeDark}` : `☀️ ${t.themeLight}`}
            </button>
            <div className="topbar-chip">{t.scaffoldChip}</div>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  );
}

export default WorkspaceLayout;
