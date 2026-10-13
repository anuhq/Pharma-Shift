
import { Link } from 'react-router-dom';

const modules = [
  {
    title: 'Employee & Shift Management',
    description: 'Manage employees, shifts and staff rosters.',
    path: '/employee-shift',
    icon: 'employees',
    iconColor: '#2563eb',
    iconBackground: '#e8f1ff',
  },
  {
    title: 'Attendance, Leave & Overtime',
    description: 'Track attendance, leave requests and overtime.',
    path: '/attendance-leave-overtime',
    icon: 'attendance',
    iconColor: '#0d9488',
    iconBackground: '#e5f7f2',
  },
  {
    title: 'Daily Task & Shift Handover',
    description: 'Organise tasks, checklists and shift handovers.',
    path: '/task-handover',
    icon: 'tasks',
    iconColor: '#d97706',
    iconBackground: '#fff2d8',
  },
  {
    title: 'Staff Incident & Corrective Action',
    description: 'Record incidents and track corrective actions.',
    path: '/incident-corrective-action',
    icon: 'incidents',
    iconColor: '#dc2626',
    iconBackground: '#fde8e8',
  },
];

function ModuleIcon({ type }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
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

function Dashboard() {
  return (
    <div>
      <div className="mb-4">
        <h2 className="mb-1">Dashboard</h2>

        <p className="mb-0">
          Welcome to PharmaShift. Select a module to continue.
        </p>
      </div>

      <div className="row g-4">
        {modules.map((module) => (
          <div
            className="col-12 col-md-6"
            key={module.path}
          >
            <div className="card h-100 border-0 shadow-sm rounded-3">
              <div className="card-body p-4 d-flex flex-column">
                <div
                  className="d-flex align-items-center justify-content-center rounded-3 mb-3"
                  style={{
                    width: '56px',
                    height: '56px',
                    backgroundColor: module.iconBackground,
                    color: module.iconColor,
                  }}
                >
                  <ModuleIcon type={module.icon} />
                </div>

                <h3 className="h5 fw-semibold mb-2">
                  {module.title}
                </h3>

                <p className="text-secondary mb-4">
                  {module.description}
                </p>

                <div className="mt-auto">
                  <Link
                    to={module.path}
                    className="btn btn-outline-primary"
                  >
                    Open Module
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
