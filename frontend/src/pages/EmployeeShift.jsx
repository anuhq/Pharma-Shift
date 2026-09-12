import { useState } from 'react';
import EmployeeManagement from '../components/employeeShift/EmployeeManagement';
import ShiftTypeManagement from '../components/employeeShift/ShiftTypeManagement';
import RosterManagement from '../components/employeeShift/RosterManagement';
import AssignedShiftManagement, {
  MyAssignedShifts,
} from '../components/employeeShift/AssignedShiftManagement';
import { useAuth } from '../auth/useAuth';

function EmployeeShift() {
  const [activeSection, setActiveSection] = useState('employees');
  const { user, loading } = useAuth();

  if (loading) {
    return <p>Checking your session…</p>;
  }

  if (!user) {
    return <p>Please log in to view your shifts.</p>;
  }

  // Managers keep the management tabs; staff see their own shifts
  if (user.roleName !== 'Owner/Manager') {
    return <MyAssignedShifts key={user.employeeId} />;
  }
  const sections = [
    { id: 'employees', label: 'Employees' },
    { id: 'roles', label: 'Roles' },
    { id: 'shift-types', label: 'Shift Types' },
    { id: 'roster', label: 'Work Roster' },
  ];

  return (
    <div>
      <div className="mb-4">
        <h2 className="mb-1">Employee & Shift Management</h2>
        <p className="text-muted mb-0">
          Manage employees, roles, shift types and work assignments.
        </p>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="d-flex flex-wrap gap-2">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`btn ${
                  activeSection === section.id
                    ? 'btn-primary'
                    : 'btn-outline-primary'
                }`}
                onClick={() => setActiveSection(section.id)}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeSection === 'employees' && <EmployeeSection />}
      {activeSection === 'roles' && <RolesSection />}
      {activeSection === 'shift-types' && <ShiftTypesSection />}
      {activeSection === 'roster' && <RosterSection />}
    </div>
  );
}

// Show the employee interface connected to the API
function EmployeeSection() {
  return <EmployeeManagement />;
}

function RolesSection() {
  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h3 className="h5 mb-1">Employee Roles</h3>
            <p className="text-muted mb-0">
              View the roles used in the pharmacy.
            </p>
          </div>
          <button type="button" className="btn btn-success">
            Add Role
          </button>
        </div>

        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th>Role</th>
                <th>Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Pharmacist</td>
                <td>Manages medicines and pharmacy services</td>
                <td>
                  <span className="badge text-bg-success">Active</span>
                </td>
              </tr>
              <tr>
                <td>Pharmacy Assistant</td>
                <td>Supports daily pharmacy operations</td>
                <td>
                  <span className="badge text-bg-success">Active</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Show shift types connected to the API
function ShiftTypesSection() {
  return <ShiftTypeManagement />;
}

// Show roster assignment and assigned-shift viewing
function RosterSection() {
  return (
    <>
      <RosterManagement />
      <AssignedShiftManagement />
    </>
  );
}

export default EmployeeShift;