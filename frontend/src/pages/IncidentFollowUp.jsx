import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../api/config';

async function requestJson(url, options = {}) {
  const response = await fetch(url, { ...options, credentials: 'include' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed.');
  return data;
}

// Manager-only follow-up and closure controls. Backend permissions and
// transaction checks remain authoritative even if a user bypasses this UI.
function IncidentFollowUp({ incidents, onSaved }) {
  const [selectedId, setSelectedId] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const activeId = selectedId || (incidents.length ? String(incidents[0].incident_id) : '');
  const incident = incidents.find((item) => String(item.incident_id) === activeId);
  const isClosed = incident?.status === 'Closed';
  const unreadyActions = Number(incident?.unready_action_count || 0);
  const hasInvestigationOutcome = Number(incident?.investigation_with_outcome_count || 0) > 0;
  const hasFollowUp = Boolean(incident?.follow_up_date && incident?.follow_up_notes);
  const ready = Boolean(incident && hasInvestigationOutcome && hasFollowUp && unreadyActions === 0);

  useEffect(() => {
    setDate(incident?.follow_up_date || '');
    setNotes(incident?.follow_up_notes || '');
  }, [incident?.incident_id, incident?.follow_up_date, incident?.follow_up_notes]);

  function chooseIncident(event) {
    setSelectedId(event.target.value);
    setError('');
    setMessage('');
  }

  async function saveFollowUp(event) {
    event.preventDefault();
    if (!incident) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const data = await requestJson(
        `${API_BASE_URL}/api/incidents/${incident.incident_id}/follow-up`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ follow_up_date: date, follow_up_notes: notes }),
        },
      );
      await onSaved();
      setMessage(data.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function closeIncident() {
    if (!incident) return;
    if (!window.confirm(
      `Close incident #${incident.incident_id}? Closed incidents and their linked work become read-only.`,
    )) return;
    setClosing(true);
    setError('');
    setMessage('');
    try {
      const data = await requestJson(
        `${API_BASE_URL}/api/incidents/${incident.incident_id}/close`,
        { method: 'POST' },
      );
      await onSaved();
      setMessage(data.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setClosing(false);
    }
  }

  return (
    <section className="mt-4" aria-labelledby="incident-follow-up-heading">
      <h3 id="incident-follow-up-heading" className="mb-3">Incident Follow-up &amp; Closure</h3>
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <p className="text-muted">
            Record a manager follow-up, verify corrective actions and close the incident.
            Closed records are preserved for history.
          </p>
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          {message && <div className="alert alert-success" role="status">{message}</div>}
          <label className="form-label" htmlFor="followup_incident">Select incident</label>
          <select
            id="followup_incident"
            className="form-select mb-3"
            value={activeId}
            onChange={chooseIncident}
            disabled={saving || closing || incidents.length === 0}
          >
            {incidents.length === 0 && <option value="">No incidents yet</option>}
            {incidents.map((item) => (
              <option key={item.incident_id} value={item.incident_id}>
                #{item.incident_id} — {item.full_name} — {item.status}
              </option>
            ))}
          </select>
          {incident && (
            <>
              <div className="mb-3 small">
                <div><strong>Investigation with outcome:</strong> {hasInvestigationOutcome ? 'Recorded' : 'Required'}</div>
                <div><strong>Corrective actions:</strong> {incident.corrective_action_count || 0}</div>
                <div><strong>Actions needing completion/review:</strong> {unreadyActions}</div>
                <div><strong>Follow-up:</strong> {hasFollowUp ? 'Recorded' : 'Required'}</div>
                <div><strong>Incident status:</strong> {incident.status}</div>
                {incident.closure_date && <div><strong>Closed on:</strong> {incident.closure_date}</div>}
              </div>
              {!isClosed && (
                <div className="mb-3">
                  <div className={`alert ${ready ? 'alert-success' : 'alert-warning'}`} role="status">
                    {ready
                      ? 'All summary checks are satisfied. Closure also verifies dates and records on the server.'
                      : 'Closure needs an investigation outcome, saved follow-up and all corrective actions completed with dates and manager follow-up details.'}
                  </div>
                  <form onSubmit={saveFollowUp}>
                    <div className="mb-3">
                      <label className="form-label" htmlFor="manager_follow_up_date">Follow-up date</label>
                      <input
                        id="manager_follow_up_date"
                        type="date"
                        className="form-control"
                        value={date}
                        min={incident.incident_date}
                        onChange={(event) => setDate(event.target.value)}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label" htmlFor="manager_follow_up_notes">Manager follow-up notes</label>
                      <textarea
                        id="manager_follow_up_notes"
                        className="form-control"
                        rows={3}
                        maxLength={500}
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        required
                      />
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                      <button type="submit" className="btn btn-primary" disabled={saving || closing}>
                        {saving ? 'Saving...' : 'Save Follow-up'}
                      </button>
                      <button type="button" className="btn btn-outline-success"
                        onClick={() => void closeIncident()} disabled={saving || closing}>
                        {closing ? 'Closing...' : 'Close Incident'}
                      </button>
                    </div>
                  </form>
                  <p className="small text-muted mt-2 mb-0">
                    You may attempt closure at any time; the backend rejects it until every rule passes.
                  </p>
                </div>
              )}
              {isClosed && (
                <div className="alert alert-secondary" role="status">
                  This incident is closed. Its follow-up and linked work are read-only.
                </div>
              )}
              {hasFollowUp && (
                <div className="border rounded p-3">
                  <strong>Saved follow-up — {incident.follow_up_date}</strong>
                  <p className="mb-0 mt-2" style={{ whiteSpace: 'pre-wrap' }}>
                    {incident.follow_up_notes}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default IncidentFollowUp;
