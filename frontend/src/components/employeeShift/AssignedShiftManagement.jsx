import { API_BASE_URL } from '../../api/config';
import { useEffect, useState } from 'react';

const API_URL = API_BASE_URL + "/api";

async function request(path) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Request failed.');
  }

  return data;
}
export default function AssignedShiftManagement() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadEmployees() {
      try {
        const data = await request('/employees');
        setEmployees(data);

        if (data.length > 0) {
          setSelectedEmployee(String(data[0].employee_id));
        }
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoadingEmployees(false);
      }
    }

    loadEmployees();
  }, []);

 useEffect(() => {
  if (!selectedEmployee) {
    return;
  }

    async function loadAssignments() {
      setLoadingAssignments(true);
      setError('');

      try {
        const data = await request(`/roster/employee/${selectedEmployee}`);
        setAssignments(data);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoadingAssignments(false);
      }
    }

    loadAssignments();
  }, [selectedEmployee]);

  return (
    <div className="card border-0 shadow-sm mt-4">
      <div className="card-body">
        <h3 className="h5 mb-1">Assigned Shifts</h3>
        <p className="text-muted">
          View shifts assigned to a selected employee.
        </p>

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        {loadingEmployees ? (
          <p>Loading employees…</p>
        ) : employees.length === 0 ? (
          <div className="alert alert-info">
            No employees are available.
          </div>
        ) : (
          <>
            <label htmlFor="assigned-employee" className="form-label">
              Employee
            </label>

            <select
              id="assigned-employee"
              className="form-select mb-4"
              value={selectedEmployee}
              onChange={(event) => setSelectedEmployee(event.target.value)}
            >
              {employees.map((employee) => (
                <option
                  key={employee.employee_id}
                  value={employee.employee_id}
                >
                  {employee.full_name}
                </option>
              ))}
            </select>

            {loadingAssignments ? (
              <p>Loading assigned shifts…</p>
            ) : assignments.length === 0 ? (
              <div className="alert alert-secondary">
                No shifts are assigned to this employee.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Shift</th>
                      <th>Time</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {assignments.map((assignment) => (
                      <tr key={assignment.roster_id}>
                        <td>{assignment.shift_name}</td>
                        <td>
                          {assignment.start_time.slice(0, 5)}–
                          {assignment.end_time.slice(0, 5)}
                        </td>
                        <td>{assignment.shift_date}</td>
                        <td>
                          <span className="badge text-bg-success">
                            {assignment.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Staff can view only their own assignments
export function MyAssignedShifts() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadMyShifts() {
      try {
        // The backend gets the employee ID from the login session
        const data = await request('/roster/me');

        if (!cancelled) {
          setAssignments(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMyShifts();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="card border-0 shadow-sm">
      <div className="card-body">
        <h2 className="h4">My Assigned Shifts</h2>
        <p className="text-muted">
          View your scheduled shifts.
        </p>

        {loading && <p role="status">Loading your shifts…</p>}

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        {!loading && !error && (
          assignments.length === 0 ? (
            <div className="alert alert-info">
              No shifts are assigned to you.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Shift</th>
                    <th>Time</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => (
                    <tr key={assignment.roster_id}>
                      <td>{assignment.shift_name}</td>
                      <td>
                        {assignment.start_time.slice(0, 5)}–
                        {assignment.end_time.slice(0, 5)}
                      </td>
                      <td>{assignment.shift_date}</td>
                      <td>{assignment.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </section>
  );
}