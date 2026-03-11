import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { navigationGroups } from '../data/navigation';

function WorkspaceLayout() {
  const location = useLocation();
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
          <p className="brand-copy">
            Bộ sườn chia theo role và feature để cả team code song song mà vẫn bám đúng đồ án.
          </p>
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
          <p className="nav-footnote-title">Backend base URL</p>
          <p className="nav-footnote-copy">VITE_API_BASE_URL or http://localhost:5000/api/v1</p>
        </div>
      </aside>

      <main className="shell-main">
        <header className="topbar">
          <div>
            <p className="topbar-kicker">Current workspace</p>
            <h2 className="topbar-title">{activeItem?.label ?? 'Overview'}</h2>
            <p className="topbar-copy">{activeItem?.description ?? 'Project command center and delivery split.'}</p>
          </div>

          <div className="topbar-chip">GIS-first scaffold</div>
        </header>

        <Outlet />
      </main>
    </div>
  );
}

export default WorkspaceLayout;