import { API_BASE_URL } from '../../api/config';
import { useEffect, useState } from 'react';

const API_URL = API_BASE_URL + "/api";

const emptyForm = {
  shift_name: '',
  start_time: '',
  end_time: '',
  status: 'Active',
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

export default function ShiftTypeManagement() {
  const [shiftTypes, setShiftTypes] = useState([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function loadShiftTypes() {
      try {
        const data = await request('/shift-types');
        setShiftTypes(data);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadShiftTypes();
  }, []);

  function openAddForm() {
    setForm({ ...emptyForm });
    setEditingId(null);
    setError('');
    setSuccess('');
    setShowForm(true);
  }

  function openEditForm(shiftType) {
    setForm({
      shift_name: shiftType.shift_name,
      start_time: shiftType.start_time.slice(0, 5),
      end_time: shiftType.end_time.slice(0, 5),
      status: shiftType.status,
    });
    setEditingId(shiftType.shift_type_id);
    setError('');
    setSuccess('');
    setShowForm(true);
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (form.start_time === form.end_time) {
      setError('Start time and end time cannot be the same.');
      return;
    }

    setSaving(true);

    try {
      const path =
        editingId === null ? '/shift-types' : `/shift-types/${editingId}`;

      const savedShiftType = await request(path, {
        method: editingId === null ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      setShiftTypes((current) =>
        editingId === null
          ? [savedShiftType, ...current]
          : current.map((shiftType) =>
              shiftType.shift_type_id === editingId
                ? savedShiftType
                : shiftType,
            ),
      );

      setSuccess(
        editingId === null
          ? 'Shift type added successfully.'
          : 'Shift type updated successfully.',
      );
      setShowForm(false);
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
          <h3 className="h5 mb-1">Shift Types</h3>
          <p className="text-muted mb-0">
            Define the working times used in rosters.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={openAddForm}
          disabled={loading || saving}
        >
          Add Shift Type
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
            <h4 className="h5">
              {editingId === null ? 'Add Shift Type' : 'Edit Shift Type'}
            </h4>

            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label htmlFor="shift-name" className="form-label">
                    Shift name
                  </label>
                  <input
                    id="shift-name"
                    name="shift_name"
                    className="form-control"
                    value={form.shift_name}
                    onChange={handleChange}
                    minLength={2}
                    maxLength={50}
                    required
                  />
                </div>

                <div className="col-md-3">
                  <label htmlFor="shift-start" className="form-label">
                    Start time
                  </label>
                  <input
                    id="shift-start"
                    name="start_time"
                    type="time"
                    className="form-control"
                    value={form.start_time}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="col-md-3">
                  <label htmlFor="shift-end" className="form-label">
                    End time
                  </label>
                  <input
                    id="shift-end"
                    name="end_time"
                    type="time"
                    className="form-control"
                    value={form.end_time}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label htmlFor="shift-status" className="form-label">
                    Status
                  </label>
                  <select
                    id="shift-status"
                    name="status"
                    className="form-select"
                    value={form.status}
                    onChange={handleChange}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="d-flex gap-2 mt-4">
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save Shift Type'}
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
        <p>Loading shift types…</p>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Shift</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftTypes.map((shiftType) => (
                    <tr key={shiftType.shift_type_id}>
                      <td>{shiftType.shift_name}</td>
                      <td>{shiftType.start_time.slice(0, 5)}</td>
                      <td>{shiftType.end_time.slice(0, 5)}</td>
                      <td>
                        <span
                          className={`badge ${
                            shiftType.status === 'Active'
                              ? 'text-bg-success'
                              : 'text-bg-secondary'
                          }`}
                        >
                          {shiftType.status}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => openEditForm(shiftType)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}

                  {shiftTypes.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-4">
                        No shift types found.
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