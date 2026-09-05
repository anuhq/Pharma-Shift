import { NavLink } from 'react-router-dom';

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
  return (
    <aside className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <nav className="d-flex flex-column gap-1">
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
    </aside>
  );
}

export default Sidebar;