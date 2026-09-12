import { useCallback, useEffect, useState } from 'react';

const API_URL = 'http://127.0.0.1:5000/api/investigations';

const emptyForm = {
  incident_id: '',
  investigation_date: '',
  findings: '',
  outcome: '',
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

function Investigations({ incidents, onSaved }) {
  const [investigations, setInvestigations] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadInvestigations = useCallback(async () => {
    try {
      const data = await requestJson(API_URL);
      setInvestigations(data.investigations || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadInvestigations().catch((requestError) => {
        setError(requestError.message);
      });
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [loadInvestigations]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function editInvestigation(investigation) {
    setEditingId(investigation.investigation_id);

    setForm({
      incident_id: String(investigation.incident_id),
      investigation_date: investigation.investigation_date,
      findings: investigation.findings,
      outcome: investigation.outcome || '',
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
        loadInvestigations(),
        onSaved(),
      ]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const investigatedIds = new Set(
    investigations.map((item) => Number(item.incident_id)),
  );

  const selectableIncidents = incidents.filter((incident) => {
    const id = Number(incident.incident_id);

    if (editingId !== null) {
      return id === Number(form.incident_id);
    }

    return (
      String(incident.status).toLowerCase() !== 'closed' &&
      !investigatedIds.has(id)
    );
  });

  const selectedIncident = incidents.find(
    (incident) =>
      Number(incident.incident_id) === Number(form.incident_id),
  );

  return (
    <section className="mt-4" aria-labelledby="investigations-heading">
      <h3 id="investigations-heading" className="mb-3">
        Investigations
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
                  ? 'Record Investigation'
                  : 'Edit Investigation'}
              </h4>

              <form onSubmit={handleSubmit}>
                <fieldset disabled={saving || loading}>
                  <div className="mb-3">
                    <label
                      className="form-label"
                      htmlFor="investigation_incident"
                    >
                      Incident
                    </label>

                    <select
                      id="investigation_incident"
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
                          #{incident.incident_id} — {incident.full_name}
                          {' — '}
                          {incident.category_name}
                          {' — '}
                          {incident.incident_date}
                        </option>
                      ))}
                    </select>

                    {!loading &&
                      editingId === null &&
                      selectableIncidents.length === 0 && (
                        <p className="text-muted small mt-2 mb-0">
                          No incidents are available for a new investigation.
                          You can edit an existing investigation below.
                        </p>
                      )}
                  </div>

                  {selectedIncident && (
                    <p className="small text-muted">
                      Incident details: {selectedIncident.description}
                    </p>
                  )}

                  <div className="mb-3">
                    <label
                      className="form-label"
                      htmlFor="investigation_date"
                    >
                      Investigation date
                    </label>

                    <input
                      id="investigation_date"
                      name="investigation_date"
                      type="date"
                      className="form-control"
                      value={form.investigation_date}
                      min={selectedIncident?.incident_date || undefined}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label
                      className="form-label"
                      htmlFor="investigation_findings"
                    >
                      Findings
                    </label>

                    <textarea
                      id="investigation_findings"
                      name="findings"
                      className="form-control"
                      rows={4}
                      value={form.findings}
                      onChange={handleChange}
                      maxLength={500}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label
                      className="form-label"
                      htmlFor="investigation_outcome"
                    >
                      Outcome (optional)
                    </label>

                    <textarea
                      id="investigation_outcome"
                      name="outcome"
                      className="form-control"
                      rows={3}
                      value={form.outcome}
                      onChange={handleChange}
                      maxLength={255}
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
                        ? 'Record Investigation'
                        : 'Update Investigation'}
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
              <h4 className="mb-3">Investigation Records</h4>

              {loading ? (
                <p className="text-muted">Loading investigations...</p>
              ) : investigations.length === 0 ? (
                <p className="text-muted">No investigations found.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-bordered align-middle">
                    <thead>
                      <tr>
                        <th>Incident</th>
                        <th>Date</th>
                        <th>Findings</th>
                        <th>Outcome</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {investigations.map((investigation) => (
                        <tr key={investigation.investigation_id}>
                          <td>
                            #{investigation.incident_id}
                            {' — '}
                            {investigation.full_name}

                            <div className="small text-muted">
                              {investigation.category_name}
                            </div>

                            <div className="small">
                              {investigation.incident_status}
                            </div>
                          </td>

                          <td>{investigation.investigation_date}</td>

                          <td style={{ whiteSpace: 'pre-wrap' }}>
                            {investigation.findings}
                          </td>

                          <td style={{ whiteSpace: 'pre-wrap' }}>
                            {investigation.outcome || '—'}
                          </td>

                          <td>
                            {String(
                              investigation.incident_status,
                            ).toLowerCase() === 'closed' ? (
                              <span className="text-muted">Closed</span>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() =>
                                  editInvestigation(investigation)
                                }
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

export default Investigations;