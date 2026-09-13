import { useCallback, useEffect, useState } from 'react';

const API_URL = 'http://127.0.0.1:5000/api/corrective-actions';

const STATUSES = [
  'Pending',
  'In Progress',
  'Completed',
  'Cancelled',
];

const emptyForm = {
  incident_id: '',
  assigned_employee_id: '',
  action_description: '',
  due_date: '',
  status: 'Pending',
  follow_up_details: '',
  completed_date: '',
};

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Request failed.');
  }

  return data;
}

function CorrectiveActions({ incidents, employees, onSaved }) {
  const [actions, setActions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadActions = useCallback(async () => {
    try {
      const data = await requestJson(API_URL);
      setActions(data.actions || []);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadActions();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [loadActions]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'status' && value !== 'Completed'
        ? { completed_date: '' }
        : {}),
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function editAction(action) {
    setEditingId(action.action_id);

    setForm({
      incident_id: String(action.incident_id),
      assigned_employee_id: String(action.assigned_employee_id),
      action_description: action.action_description,
      due_date: action.due_date,
      status: action.status,
      follow_up_details: action.follow_up_details || '',
      completed_date: action.completed_date || '',
    });

    setError('');
    setMessage('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    const isEditing = editingId !== null;

    try {
      const data = await requestJson(
        isEditing ? `${API_URL}/${editingId}` : API_URL,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(form),
        },
      );

      resetForm();
      setMessage(data.message);

      await Promise.all([
        loadActions(),
        onSaved(),
      ]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const selectedIncident = incidents.find(
    (incident) =>
      Number(incident.incident_id) === Number(form.incident_id),
  );

  const selectableIncidents = incidents.filter((incident) => {
    if (editingId !== null) {
      return (
        Number(incident.incident_id) === Number(form.incident_id)
      );
    }

    return String(incident.status).toLowerCase() !== 'closed';
  });

  const activeEmployees = employees.filter(
    (employee) =>
      String(employee.status).toLowerCase() === 'active',
  );

  return (
    <section
      className="mt-4"
      aria-labelledby="corrective-actions-heading"
    >
      <h3 id="corrective-actions-heading" className="mb-3">
        Corrective Actions
      </h3>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="alert alert-success" role="status">
          {message}
        </div>
      )}

      <div className="row g-4">
        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h4 className="mb-3">
                {editingId === null
                  ? 'Create Corrective Action'
                  : 'Edit Corrective Action'}
              </h4>

              <form onSubmit={handleSubmit}>
                <fieldset disabled={saving || loading}>
                  <div className="mb-3">
                    <label
                      className="form-label"
                      htmlFor="action_incident"
                    >
                      Incident
                    </label>

                    <select
                      id="action_incident"
                      name="incident_id"
                      className="form-select"
                      value={form.incident_id}
                      onChange={handleChange}
                      disabled={editingId !== null}
                      required
                    >
                      <option value="">Select incident</option>

                      {selectableIncidents.map((incident) => (
                        <option
                          key={incident.incident_id}
                          value={incident.incident_id}
                        >
                          #{incident.incident_id} —{' '}
                          {incident.full_name} —{' '}
                          {incident.category_name} —{' '}
                          {incident.incident_date}
                        </option>
                      ))}
                    </select>

                    {!loading &&
                      editingId === null &&
                      selectableIncidents.length === 0 && (
                        <p className="small text-muted mt-2 mb-0">
                          No open incidents are available.
                        </p>
                      )}
                  </div>

                  {selectedIncident && (
                    <p className="small text-muted">
                      Incident: {selectedIncident.description}
                    </p>
                  )}

                  <div className="mb-3">
                    <label
                      className="form-label"
                      htmlFor="action_employee"
                    >
                      Assigned employee
                    </label>

                    <select
                      id="action_employee"
                      name="assigned_employee_id"
                      className="form-select"
                      value={form.assigned_employee_id}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select employee</option>

                      {activeEmployees.map((employee) => (
                        <option
                          key={employee.employee_id}
                          value={employee.employee_id}
                        >
                          {employee.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label
                      className="form-label"
                      htmlFor="action_description"
                    >
                      Action description
                    </label>

                    <textarea
                      id="action_description"
                      name="action_description"
                      className="form-control"
                      rows={4}
                      value={form.action_description}
                      onChange={handleChange}
                      maxLength={500}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label
                      className="form-label"
                      htmlFor="action_due_date"
                    >
                      Due date
                    </label>

                    <input
                      id="action_due_date"
                      name="due_date"
                      type="date"
                      className="form-control"
                      value={form.due_date}
                      min={selectedIncident?.incident_date || undefined}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label
                      className="form-label"
                      htmlFor="action_status"
                    >
                      Status
                    </label>

                    <select
                      id="action_status"
                      name="status"
                      className="form-select"
                      value={form.status}
                      onChange={handleChange}
                      required
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label
                      className="form-label"
                      htmlFor="follow_up_details"
                    >
                      Follow-up details
                    </label>

                    <textarea
                      id="follow_up_details"
                      name="follow_up_details"
                      className="form-control"
                      rows={3}
                      value={form.follow_up_details}
                      onChange={handleChange}
                      maxLength={500}
                    />
                  </div>

                  <div className="mb-3">
                    <label
                      className="form-label"
                      htmlFor="completed_date"
                    >
                      Completed date
                    </label>

                    <input
                      id="completed_date"
                      name="completed_date"
                      type="date"
                      className="form-control"
                      value={form.completed_date}
                      min={selectedIncident?.incident_date || undefined}
                      onChange={handleChange}
                      required={form.status === 'Completed'}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary me-2"
                    disabled={
                      editingId === null &&
                      selectableIncidents.length === 0
                    }
                  >
                    {saving
                      ? 'Saving...'
                      : editingId === null
                        ? 'Create Action'
                        : 'Update Action'}
                  </button>

                  {editingId !== null && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={resetForm}
                    >
                      Cancel
                    </button>
                  )}
                </fieldset>
              </form>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-7">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h4 className="mb-3">
                Corrective Action Records
              </h4>

              {loading ? (
                <p className="text-muted">Loading actions...</p>
              ) : actions.length === 0 ? (
                <p className="text-muted">
                  No corrective actions found.
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-bordered align-middle">
                    <thead>
                      <tr>
                        <th>Incident</th>
                        <th>Assigned employee</th>
                        <th>Action</th>
                        <th>Due date</th>
                        <th>Status</th>
                        <th>Follow-up</th>
                        <th>Edit</th>
                      </tr>
                    </thead>

                    <tbody>
                      {actions.map((action) => (
                        <tr key={action.action_id}>
                          <td>
                            #{action.incident_id}

                            <div className="small text-muted">
                              {action.category_name}
                            </div>

                            <div className="small">
                              {action.incident_status}
                            </div>
                          </td>

                          <td>{action.assigned_employee_name}</td>

                          <td style={{ whiteSpace: 'pre-wrap' }}>
                            {action.action_description}
                          </td>

                          <td>{action.due_date}</td>
                          <td>{action.status}</td>

                          <td style={{ whiteSpace: 'pre-wrap' }}>
                            {action.follow_up_details || '—'}

                            {action.completed_date && (
                              <div className="small text-muted">
                                Completed: {action.completed_date}
                              </div>
                            )}
                          </td>

                          <td>
                            {String(
                              action.incident_status,
                            ).toLowerCase() === 'closed' ? (
                              <span className="text-muted">
                                Closed
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => editAction(action)}
                                disabled={saving}
                              >
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CorrectiveActions;