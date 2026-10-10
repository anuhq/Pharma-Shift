import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../api/config';

const ACTIONS_API = `${API_BASE_URL}/api/corrective-actions`;

async function requestJson(url, options = {}) {
  const response = await fetch(url, { ...options, credentials: 'include' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed.');
  return data;
}

function StaffCorrectiveActionList() {
  const [actions, setActions] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadActions = useCallback(async () => {
    try {
      const data = await requestJson(`${ACTIONS_API}/mine`);
      setActions(data.actions || []);
      setDrafts((previous) => {
        const next = { ...previous };
        for (const action of data.actions || []) {
          if (next[action.action_id] === undefined) {
            next[action.action_id] = action.staff_completion_feedback || '';
          }
        }
        return next;
      });
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadActions();
  }, [loadActions]);

  async function submitFeedback(event, actionId) {
    event.preventDefault();
    if (savingId !== null) return;
    setError('');
    setMessage('');
    setSavingId(actionId);

    try {
      const result = await requestJson(`${ACTIONS_API}/${actionId}/completion-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: (drafts[actionId] || '').trim() }),
      });
      setMessage(result.message);
      await loadActions();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="mt-4" aria-labelledby="staff-actions-heading">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h3 id="staff-actions-heading" className="mb-1">My Corrective Actions</h3>
          <p className="text-muted mb-0">
            Only actions assigned to your logged-in employee account appear here.
            Completion feedback is sent to your manager for review; it does not
            automatically mark the action completed.
          </p>
        </div>
        <button type="button" className="btn btn-outline-secondary btn-sm"
          onClick={() => void loadActions()} disabled={loading || savingId !== null}>
          Refresh assignments
        </button>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {message && <div className="alert alert-success" role="status">{message}</div>}
      {loading ? (
        <p className="text-muted" role="status">Loading your corrective actions...</p>
      ) : actions.length === 0 ? (
        <div className="alert alert-light border">You have no corrective actions assigned.</div>
      ) : (
        <div className="row g-3">
          {actions.map((action) => {
            const editable = ['Pending', 'In Progress'].includes(action.status);
            const draft = drafts[action.action_id] || '';
            return (
              <div className="col-12 col-lg-6" key={action.action_id}>
                <div className="card h-100 shadow-sm border-0">
                  <div className="card-body">
                    <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                      <h4 className="h6 mb-0">Action #{action.action_id}</h4>
                      <span className="badge text-bg-secondary">{action.status}</span>
                    </div>
                    <p className="small text-muted mb-2">
                      Incident #{action.incident_id} — {action.category_name}
                      {' · '}Due {action.due_date}
                    </p>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{action.action_description}</p>
                    {action.staff_feedback_submitted_at && (
                      <div className="alert alert-info py-2 small">
                        Feedback submitted (UTC): {action.staff_feedback_submitted_at}.
                        {' '}Await manager review.
                      </div>
                    )}
                    {editable ? (
                      <form onSubmit={(event) => void submitFeedback(event, action.action_id)}>
                        <label className="form-label" htmlFor={`staff-action-feedback-${action.action_id}`}>
                          Your completion feedback
                        </label>
                        <textarea
                          id={`staff-action-feedback-${action.action_id}`}
                          className="form-control mb-2"
                          rows={3}
                          required
                          maxLength={500}
                          value={draft}
                          onChange={(event) => setDrafts((current) => ({
                            ...current, [action.action_id]: event.target.value,
                          }))}
                          disabled={savingId !== null}
                          placeholder="Explain what you completed and any evidence for your manager"
                        />
                        <button type="submit" className="btn btn-primary btn-sm"
                          disabled={savingId !== null || !draft.trim()}>
                          {savingId === action.action_id ? 'Sending...' :
                            action.staff_feedback_submitted_at ? 'Update feedback' : 'Send feedback'}
                        </button>
                      </form>
                    ) : (
                      <p className="small text-muted mb-0">
                        Feedback cannot be changed on completed or cancelled actions.
                        {action.staff_completion_feedback && (
                          <span className="d-block mt-1" style={{ whiteSpace: 'pre-wrap' }}>
                            Your feedback: {action.staff_completion_feedback}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default StaffCorrectiveActionList;
