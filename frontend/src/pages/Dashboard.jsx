import { Link } from 'react-router-dom';

const modules = [
  {
    title: 'Employee & Shift Management',
    description: 'Manage employee, shift and roster related functions.',
    path: '/employee-shift',
  },
  {
    title: 'Attendance, Leave & Overtime',
    description: 'Manage attendance, leave and overtime related functions.',
    path: '/attendance-leave-overtime',
  },
  {
    title: 'Daily Task & Shift Handover',
    description: 'Manage daily tasks, checklists and shift handovers.',
    path: '/task-handover',
  },
  {
    title: 'Staff Incident & Corrective Action',
    description: 'Manage staff incidents, investigations and corrective actions.',
    path: '/incident-corrective-action',
  },
];

function Dashboard() {
  return (
    <div>
      <div className="mb-4">
        <h2 className="mb-1">Dashboard</h2>
        <p className="mb-0">
          Welcome to PharmaShift. Select a module to continue.
        </p>
      </div>

      <div className="row g-3">
        {modules.map((module) => (
          <div className="col-12 col-md-6" key={module.path}>
            <div className="card h-100 border-0 shadow-sm">
              <div className="card-body p-4">
                <h3 className="h5">{module.title}</h3>

                <p className="mb-4">
                  {module.description}
                </p>

                <Link
                  to={module.path}
                  className="btn btn-outline-primary"
                >
                  Open Module
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;