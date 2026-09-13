import { API_BASE_URL } from '../../api/config';
import { useEffect, useState } from 'react';

const API_URL = API_BASE_URL + "/api";

const emptyForm = {
  employee_id: '',
  shift_type_id: '',
  shift_date: '',
};

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Request failed.');
  }

  return data;
}

export default function RosterManagement() {
  const [rosters, setRosters] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [shiftTypes, setShiftTypes] = useState([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function loadRosterData() {
      try {
        const [rosterData, employeeData, shiftData] = await Promise.all([
          request('/roster'),
          request('/employees'),
          request('/shift-types'),
        ]);

        setRosters(rosterData);
        setEmployees(employeeData);
        setShiftTypes(shiftData);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadRosterData();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const newRoster = await request('/roster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: Number(form.employee_id),
          shift_type_id: Number(form.shift_type_id),
          shift_date: form.shift_date,
          status: 'Scheduled',
        }),
      });

      setRosters((current) => [newRoster, ...current]);
      setForm({ ...emptyForm });
      setShowForm(false);
      setSuccess('Shift assigned successfully.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div>
          <h3 className="h5 mb-1">Work Roster</h3>
          <p className="text-muted mb-0">
            Assign employees to shifts and dates.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setError('');
            setSuccess('');
            setShowForm(true);
          }}
          disabled={loading || saving}
        >
          Assign Shift
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success" role="status">
          {success}
        </div>
      )}

      {showForm && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <h4 className="h5">Assign Employee to Shift</h4>

            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label htmlFor="roster-employee" className="form-label">
                    Employee
                  </label>
                  <select
                    id="roster-employee"
                    name="employee_id"
                    className="form-select"
                    value={form.employee_id}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select employee</option>
                    {employees.map((employee) => (
                      <option
                        key={employee.employee_id}
                        value={employee.employee_id}
                      >
                        {employee.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-4">
                  <label htmlFor="roster-shift" className="form-label">
                    Shift type
                  </label>
                  <select
                    id="roster-shift"
                    name="shift_type_id"
                    className="form-select"
                    value={form.shift_type_id}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select shift</option>
                    {shiftTypes.map((shiftType) => (
                      <option
                        key={shiftType.shift_type_id}
                        value={shiftType.shift_type_id}
                      >
                        {shiftType.shift_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-4">
                  <label htmlFor="roster-date" className="form-label">
                    Shift date
                  </label>
                  <input
                    id="roster-date"
                    name="shift_date"
                    type="date"
                    className="form-control"
                    value={form.shift_date}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="d-flex gap-2 mt-4">
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save Assignment'}
                </button>

                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <p>Loading roster…</p>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Shift</th>
                    <th>Time</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {rosters.map((roster) => (
                    <tr key={roster.roster_id}>
                      <td>{roster.full_name}</td>
                      <td>{roster.shift_name}</td>
                      <td>
                        {roster.start_time.slice(0, 5)}–
                        {roster.end_time.slice(0, 5)}
                      </td>
                      <td>{roster.shift_date.slice(0, 10)}</td>
                      <td>
                        <span className="badge text-bg-success">
                          {roster.status}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {rosters.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-4">
                        No roster assignments found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}