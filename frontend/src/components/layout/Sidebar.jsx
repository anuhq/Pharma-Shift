
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';

const navigationItems = [
  {
    label: 'Dashboard',
    path: '/',
    icon: 'dashboard',
  },
  {
    label: 'Employee & Shift Management',
    path: '/employee-shift',
    icon: 'employees',
  },
  {
    label: 'Attendance, Leave & Overtime',
    path: '/attendance-leave-overtime',
    icon: 'attendance',
  },
  {
    label: 'Daily Task & Shift Handover',
    path: '/task-handover',
    icon: 'tasks',
  },
  {
    label: 'Staff Incident & Corrective Action',
    path: '/incident-corrective-action',
    icon: 'incidents',
  },
];

function SidebarIcon({ type }) {
  return (
    <svg
      className="sidebar-icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {type === 'dashboard' && (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </>
      )}

      {type === 'employees' && (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20v-2a6 6 0 0 1 12 0v2" />
          <path d="M17 5a3 3 0 0 1 0 6" />
          <path d="M18 14a5 5 0 0 1 3 5v1" />
        </>
      )}

      {type === 'attendance' && (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4" />
          <path d="M8 3v4" />
          <path d="M3 10h18" />
          <path d="m8 16 3 3 5-6" />
        </>
      )}

      {type === 'tasks' && (
        <>
          <rect x="5" y="4" width="14" height="18" rx="2" />
          <path d="M9 4.5h6" />
          <path d="m8 11 1.5 1.5L12 10" />
          <path d="M14 11h2" />
          <path d="m8 17 1.5 1.5L12 16" />
          <path d="M14 17h2" />
        </>
      )}

      {type === 'incidents' && (
        <>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
          <path d="M12 8v5" />
          <path d="M12 17h.01" />
        </>
      )}
    </svg>
  );
}

function Sidebar({ mobileOpen = false, onNavigate }) {
  const { user, logout } = useAuth();

  const employeeName =
    user?.fullName || user?.username || 'Employee';

  return (
    <aside
      className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`}
    >
      <div className="sidebar-mobile-user d-lg-none">
        <div className="fw-semibold">
          {employeeName}
        </div>

        <div className="sidebar-mobile-role">
          {user?.roleName}
        </div>
      </div>

      <nav
        className="d-flex flex-column gap-2"
        aria-label="Main navigation"
      >
        {navigationItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            <SidebarIcon type={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <footer className="sidebar-footer">
        <button
          type="button"
          className="btn btn-outline-light w-100 mb-3 d-lg-none"
          onClick={logout}
        >
          Logout
        </button>

        <div className="fw-semibold">
          PharmaShift
        </div>

        <div className="sidebar-version">
          Version 1.0
        </div>
      </footer>
    </aside>
  );
}

export default Sidebar;
