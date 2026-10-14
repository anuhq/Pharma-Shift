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
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [replacementRoster, setReplacementRoster] = useState(null);
  const [replacementCandidates, setReplacementCandidates] = useState([]);
  const [replacementLoading, setReplacementLoading] = useState(false);
  const [replacementError, setReplacementError] = useState('');

    // Use the user's local calendar date
  const now = new Date();

  const todayDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');

  function canEditOrCancel(roster) {
    return (
      roster.status === 'Scheduled' &&
      roster.shift_date.slice(0, 10) >= todayDate
    );
  }

  function canDeleteRoster(roster) {
    return (
      ['Scheduled', 'Cancelled'].includes(roster.status) &&
      roster.shift_date.slice(0, 10) > todayDate
    );
  }

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

  async function handleFindReplacements(roster) {
  if (saving || replacementLoading || !canEditOrCancel(roster)) {
    return;
  }

  setReplacementRoster(roster);
  setReplacementCandidates([]);
  setReplacementError('');
  setReplacementLoading(true);

  try {
    const data = await request(
      `/roster/${roster.roster_id}/replacements`
    );

    setReplacementCandidates(data.candidates);
  } catch (findError) {
    setReplacementError(findError.message);
  } finally {
    setReplacementLoading(false);
  }
}

// Confirm a suggested replacement employee
async function handleConfirmReplacement(candidate) {
  if (saving || replacementLoading || !replacementRoster) {
    return;
  }

  const original = replacementRoster;

  if (!canEditOrCancel(original)) {
    setReplacementError(
      'Only current or future Scheduled assignments can be replaced.'
    );
    return;
  }

  const confirmed = window.confirm(
    `Replace "${original.full_name}" with "${candidate.full_name}" ` +
    `for the shift on ${original.shift_date.slice(0, 10)}?\n\n` +
    'The original assignment will be marked Cancelled, and a new ' +
    'Scheduled assignment will be created.'
  );

  if (!confirmed) return;

  setSaving(true);
  setReplacementError('');
  setError('');
  setSuccess('');

  try {
    const result = await request(
      `/roster/${original.roster_id}/replace`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          replacement_employee_id: candidate.employee_id,
        }),
      }
    );

    // Update the table using the actual saved MySQL result.
    setRosters((current) => {
      const updated = current.map((roster) =>
        Number(roster.roster_id) ===
        Number(result.cancelled_roster_id)
          ? { ...roster, status: 'Cancelled' }
          : roster
      );

      return [result.replacement_roster, ...updated];
    });

    if (editingId === original.roster_id) {
      setEditingId(null);
      setShowForm(false);
    }

    setReplacementRoster(null);
    setReplacementCandidates([]);

    setSuccess(
      `Replacement assigned to ${candidate.full_name} successfully. ` +
      'The original assignment is preserved as Cancelled.'
    );

  } catch (confirmError) {
    setReplacementError(confirmError.message);
  } finally {
    setSaving(false);
  }
}

  function openEditForm(roster) {
  if (saving || !canEditOrCancel(roster)) return;

  setForm({
    employee_id: String(roster.employee_id),
    shift_type_id: String(roster.shift_type_id),
    shift_date: roster.shift_date.slice(0, 10),
  });

  setEditingId(roster.roster_id);
  setError('');
  setSuccess('');
  setShowForm(true);
}

  // Cancel a scheduled roster without removing its history
  async function handleCancel(roster) {
    if (saving || !canEditOrCancel(roster)) return;

    const confirmed = window.confirm(
      `Cancel the shift assignment for "${roster.full_name}" ` +
      `on ${roster.shift_date.slice(0, 10)}?`
    );

    if (!confirmed) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const updatedRoster = await request(
        `/roster/${roster.roster_id}/cancel`,
        { method: 'PATCH' }
      );

      setRosters((current) =>
        current.map((item) =>
          item.roster_id === roster.roster_id
            ? updatedRoster
            : item
        )
      );

      if (editingId === roster.roster_id) {
        setEditingId(null);
        setShowForm(false);
      }

      setSuccess('Shift assignment cancelled successfully.');
    } catch (cancelError) {
      setError(cancelError.message);
    } finally {
      setSaving(false);
    }
  }

  // Permanently delete an eligible future roster
  async function handleDelete(roster) {
    if (saving) return;

        if (!canDeleteRoster(roster)) {
      setError(
        'Only future Scheduled or Cancelled assignments can be deleted.'
      );
      return;
    }

    const confirmed = window.confirm(
      `Permanently delete the shift assignment for ` +
      `"${roster.full_name}" on ${roster.shift_date.slice(0, 10)}? ` +
      'This action cannot be undone. Historical assignments are protected.'
    );

    if (!confirmed) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const result = await request(
        `/roster/${roster.roster_id}`,
        { method: 'DELETE' }
      );

      setRosters((current) =>
        current.filter(
          (item) => item.roster_id !== roster.roster_id
        )
      );

      if (editingId === roster.roster_id) {
        setEditingId(null);
        setShowForm(false);
      }

      setSuccess(
        result.message || 'Roster assignment deleted successfully.'
      );
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event) {
  event.preventDefault();
  if (saving) return;

  setSaving(true);
  setError('');
  setSuccess('');

  const isEditing = editingId !== null;

  try {
    const savedRoster = await request(
      isEditing ? `/roster/${editingId}` : '/roster',
      {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: Number(form.employee_id),
          shift_type_id: Number(form.shift_type_id),
          shift_date: form.shift_date,
          ...(!isEditing ? { status: 'Scheduled' } : {}),
        }),
      }
    );

    setRosters((current) =>
      isEditing
        ? current.map((roster) =>
            roster.roster_id === editingId ? savedRoster : roster
          )
        : [savedRoster, ...current]
    );

    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(false);

    setSuccess(
      isEditing
        ? 'Shift assignment updated successfully.'
        : 'Shift assigned successfully.'
    );
  } catch (saveError) {
    setError(saveError.message);
  } finally {
    setSaving(false);
  }
}

  // Filter roster assignments without changing database records
  const filteredRosters = rosters.filter((roster) => {
    const search = searchTerm.trim().toLowerCase();

    const matchesSearch =
      !search ||
      roster.full_name.toLowerCase().includes(search) ||
      roster.shift_name.toLowerCase().includes(search);

    const matchesDate =
      !filterDate ||
      roster.shift_date.slice(0, 10) === filterDate;

    const matchesStatus =
      filterStatus === 'All' ||
      roster.status === filterStatus;

    return matchesSearch && matchesDate && matchesStatus;
  });

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
            setForm({ ...emptyForm });
            setEditingId(null);
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
            <h4 className="h5">{editingId === null ? 'Assign Employee to Shift' : 'Edit Shift Assignment'}</h4>

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
                    {employees.filter((employee) => employee.status === 'Active').map((employee) => (
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
                    {shiftTypes.filter((shiftType) => shiftType.status === 'Active').map((shiftType) => (
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

            {/* Search and filter roster assignments */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-3 align-items-end">

            <div className="col-md-4">
              <label htmlFor="roster-search" className="form-label">
                Search employee or shift
              </label>
              <input
                id="roster-search"
                type="search"
                className="form-control"
                placeholder="Enter employee or shift name"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <div className="col-md-3">
              <label htmlFor="filter-roster-date" className="form-label">
                Filter by date
              </label>
              <input
                id="filter-roster-date"
                type="date"
                className="form-control"
                value={filterDate}
                onChange={(event) => setFilterDate(event.target.value)}
              />
            </div>

            <div className="col-md-3">
              <label htmlFor="filter-roster-status" className="form-label">
                Filter by status
              </label>
              <select
                id="filter-roster-status"
                className="form-select"
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value)}
              >
                <option value="All">All statuses</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div className="col-md-2">
              <button
                type="button"
                className="btn btn-outline-secondary w-100"
                onClick={() => {
                  setSearchTerm('');
                  setFilterDate('');
                  setFilterStatus('All');
                }}
              >
                Clear Filters
              </button>
            </div>

          </div>

          {!loading && (
            <p className="text-muted small mt-3 mb-0">
              Showing {filteredRosters.length} of {rosters.length} assignments
            </p>
          )}
        </div>
      </div>

      {replacementRoster && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">

            <div className="d-flex justify-content-between align-items-center mb-3">
              <h4 className="h5 mb-0">
                Available Replacement Employees
              </h4>

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={saving || replacementLoading}
                onClick={() => {
                  setReplacementRoster(null);
                  setReplacementCandidates([]);
                  setReplacementError('');
                }}
              >
                Close
              </button>
            </div>

            <p className="text-muted">
              Replacements for {replacementRoster.full_name} on{' '}
              {replacementRoster.shift_date.slice(0, 10)}
            </p>

            {replacementLoading && (
              <p role="status">Finding available employees...</p>
            )}

            {replacementError && (
              <div className="alert alert-danger" role="alert">
                {replacementError}
              </div>
            )}

            {!replacementLoading &&
              !replacementError &&
              replacementCandidates.length === 0 && (
                <div className="alert alert-info">
                  No available replacement employees found.
                </div>
              )}

            {!replacementLoading &&
              !replacementError &&
              replacementCandidates.length > 0 && (
                <div className="table-responsive">
                  <table className="table table-hover align-middle">
                    <thead>
                      <tr>
                        <th>Employee ID</th>
                        <th>Employee Name</th>
                        <th>Role</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {replacementCandidates.map((candidate) => (
                        <tr key={candidate.employee_id}>
                          <td>{candidate.employee_id}</td>
                          <td>{candidate.full_name}</td>
                          <td>{candidate.role_name}</td>

                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-success"
                              onClick={() => handleConfirmReplacement(candidate)}
                              disabled={saving || replacementLoading}
                            >
                              {saving ? 'Processing...' : 'Confirm Replacement'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

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
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRosters.map((roster) => (
                    <tr key={roster.roster_id}>
                      <td>{roster.full_name}</td>
                      <td>{roster.shift_name}</td>
                      <td>
                        {roster.start_time.slice(0, 5)}–
                        {roster.end_time.slice(0, 5)}
                      </td>
                      <td>{roster.shift_date.slice(0, 10)}</td>
                     <td>
                        <span
                          className={`badge ${
                            roster.status === 'Scheduled'
                              ? 'text-bg-primary'
                              : roster.status === 'Completed'
                                ? 'text-bg-success'
                                : 'text-bg-secondary'
                          }`}
                        >
                          {roster.status}
                        </span>
                      </td>

                      <td>
                        <div className="d-flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => openEditForm(roster)}
                             disabled={saving || !canEditOrCancel(roster)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-warning"
                            onClick={() => handleCancel(roster)}
                           disabled={saving || !canEditOrCancel(roster)}
                          >
                            Cancel
                          </button>

                          <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDelete(roster)}
                              disabled={saving || !canDeleteRoster(roster)}
                              aria-label={`Delete assignment for ${roster.full_name}`}
                            >
                              Delete
                            </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success"
                            onClick={() => handleFindReplacements(roster)}
                            disabled={
                              saving ||
                              replacementLoading ||
                              !canEditOrCancel(roster)
                            }
                          >
                            Find Replacement
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredRosters.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-4">
                        {rosters.length === 0
                          ? 'No roster assignments found.'
                          : 'No roster assignments match your filters.'}
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