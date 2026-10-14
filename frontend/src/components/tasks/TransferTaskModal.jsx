
import { useEffect, useRef, useState } from 'react';
import {
  getTaskOptions,
  transferTaskAssignment,
} from '../../services/taskApi';

function TransferTaskModal({ task, onClose, onTransferred }) {
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [userId, setUserId] = useState('');
  const [shiftTypeId, setShiftTypeId] = useState('');
  const [assignedDate, setAssignedDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOptions() {
      try {
        const options = await getTaskOptions(controller.signal);

        if (!controller.signal.aborted) {
          setUsers(options.users || []);
          setShifts(options.shifts || []);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Unable to load transfer options.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadOptions();

    return () => controller.abort();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    if (savingRef.current) return;

    if (!userId || !shiftTypeId || !assignedDate) {
      setError('Please complete all transfer details.');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError('');

    try {
      const result = await transferTaskAssignment(
        task.assignment_id,
        {
          user_id: Number(userId),
          shift_type_id: Number(shiftTypeId),
          assigned_date: assignedDate,
        }
      );

      onTransferred(result);
    } catch (err) {
      setError(err.message || 'Unable to transfer this task.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div
      className="modal d-block"
      tabIndex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-task-title"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title fs-5" id="transfer-task-title">
              Transfer Unfinished Task
            </h2>

            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={onClose}
              disabled={saving}
            />
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <p className="mb-3">
                <strong>Task:</strong> {task.title}
              </p>

              <p className="text-muted small">
                The new assignment will be linked to the original task.
              </p>

              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}

              {loading ? (
                <p className="text-muted">Loading options...</p>
              ) : (
                <>
                  <div className="mb-3">
                    <label htmlFor="transfer-user" className="form-label">
                      Receiving Employee
                    </label>
                    <select
                      id="transfer-user"
                      className="form-select"
                      value={userId}
                      onChange={(event) => setUserId(event.target.value)}
                      required
                    >
                      <option value="">Select employee</option>

                      {users.map((user) => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.full_name} ({user.username})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="transfer-shift" className="form-label">
                      Receiving Shift
                    </label>
                    <select
                      id="transfer-shift"
                      className="form-select"
                      value={shiftTypeId}
                      onChange={(event) => setShiftTypeId(event.target.value)}
                      required
                    >
                      <option value="">Select shift</option>

                      {shifts.map((shift) => (
                        <option
                          key={shift.shift_type_id}
                          value={shift.shift_type_id}
                        >
                          {shift.shift_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="transfer-date" className="form-label">
                      Transfer Date
                    </label>
                    <input
                      id="transfer-date"
                      type="date"
                      className="form-control"
                      value={assignedDate}
                      min={task.assigned_date || undefined}
                      onChange={(event) => setAssignedDate(event.target.value)}
                      required
                    />
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={
                  loading ||
                  saving ||
                  !userId ||
                  !shiftTypeId ||
                  !assignedDate
                }
              >
                {saving ? 'Transferring...' : 'Transfer Task'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default TransferTaskModal;
