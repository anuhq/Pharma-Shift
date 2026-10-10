import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../auth/useAuth';

const emptyReport = { category_id: '', incident_date: '', description: '' };

async function requestJson(url, options = {}) {
  const response = await fetch(url, { ...options, credentials: 'include' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed.');
  return data;
}

function StaffIncidentReport() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyReport);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadCategories() {
      try {
        const data = await requestJson(`${API_BASE_URL}/api/incidents/report-categories`);
        if (!cancelled) setCategories(data.categories || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadCategories();
    return () => { cancelled = true; };
  }, []);

  async function submitReport(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const data = await requestJson(`${API_BASE_URL}/api/incidents/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: form.category_id,
          incident_date: form.incident_date,
          description: form.description.trim(),
        }),
      });
      setForm(emptyReport);
      setMessage(`Incident report #${data.incident_id} submitted. A manager can review it.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container-fluid py-4">
      <h2 className="mb-2">Report a Staff Incident</h2>
      <p className="text-muted mb-4">
        Submit a report related to your own work. Only authorized managers can
        review incident records, investigations, and corrective actions.
      </p>

      <div className="card border-0 shadow-sm" style={{ maxWidth: '760px' }}>
        <div className="card-body">
          <p className="mb-3">
            <strong>Reporting employee:</strong> {user?.fullName || user?.username}
          </p>
          <p className="text-muted small">
            Your employee identity is taken from your login, not from this form.
            Do not include unrelated confidential information.
          </p>

          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          {message && <div className="alert alert-success" role="status">{message}</div>}

          {loading ? (
            <p className="text-muted" role="status">Loading incident categories...</p>
          ) : categories.length === 0 ? (
            <p className="text-muted">No incident categories are available. Ask a manager to add one.</p>
          ) : (
            <form onSubmit={submitReport}>
              <div className="mb-3">
                <label className="form-label" htmlFor="staff_incident_category">Incident category</label>
                <select
                  className="form-select"
                  id="staff_incident_category"
                  value={form.category_id}
                  onChange={(event) => setForm((current) => ({ ...current, category_id: event.target.value }))}
                  required
                  disabled={saving}
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.category_id} value={category.category_id}>
                      {category.category_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="staff_incident_date">Incident date</label>
                <input
                  type="date"
                  className="form-control"
                  id="staff_incident_date"
                  value={form.incident_date}
                  onChange={(event) => setForm((current) => ({ ...current, incident_date: event.target.value }))}
                  required
                  disabled={saving}
                />
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="staff_incident_description">Incident description</label>
                <textarea
                  className="form-control"
                  id="staff_incident_description"
                  rows={5}
                  maxLength={500}
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  required
                  disabled={saving}
                  placeholder="Describe what happened factually and clearly"
                />
                <small className="text-muted">{form.description.length}/500 characters</small>
              </div>

              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Submitting...' : 'Submit Incident Report'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default StaffIncidentReport;
