
import { NavLink } from 'react-router-dom';

import { useAuth } from '../../auth/useAuth';

const navigationItems = [
  {
    label: 'Dashboard',
    path: '/',
  },
  {
    label: 'Employee & Shift Management',
    path: '/employee-shift',
  },
  {
    label: 'Attendance, Leave & Overtime',
    path: '/attendance-leave-overtime',
  },
  {
    label: 'Daily Task & Shift Handover',
    path: '/task-handover',
  },
  {
    label: 'Staff Incident & Corrective Action',
    path: '/incident-corrective-action',
  },
];

function Sidebar({ mobileOpen = false, onNavigate }) {
  const { logout } = useAuth();

  return (
    <aside
      className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`}
    >
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
            {item.label}
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
