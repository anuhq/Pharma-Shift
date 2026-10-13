
import { useEffect, useRef, useState } from 'react';
import { updateTaskAssignment } from '../../services/taskApi';

const todayInColombo = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
  }).format(new Date());

export default function EditTaskModal({ task, onClose, onSaved }) {
  const dateRef = useRef(null);
  const savingRef = useRef(false);

  const [values, setValues] = useState({
    assigned_date: task.assigned_date || '',
    due_time: task.due_time || '',
    priority: task.priority || 'Medium',
  });

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dateRef.current?.focus();
  }, []);

  function change(event) {
    const { name, value } = event.target;

    setValues((current) => ({
      ...current,
      [name]: value,
    }));

    setError('');
  }

  async function submit(event) {
    event.preventDefault();

    if (savingRef.current) return;

    if (values.assigned_date < todayInColombo()) {
      setError('Task date cannot be before today.');
      dateRef.current?.focus();
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError('');

    try {
      const { task: updated } = await updateTaskAssignment(
        task.assignment_id,
        {
          assigned_date: values.assigned_date,
          due_time: values.due_time || null,
          priority: values.priority,
        }
      );

      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !saving) {
          onClose();
        }
      }}
    >
      <div
        className="modal-dialog modal-dialog-centered"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-task-title"
      >
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title fs-5" id="edit-task-title">
              Edit Task Assignment
            </h2>

            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={onClose}
              disabled={saving}
            />
          </div>

          <form onSubmit={submit}>
            <div className="modal-body">
              <p className="text-muted mb-3">
                {task.title}
              </p>

              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}

              <div className="mb-3">
                <label htmlFor="edit-task-date" className="form-label">
                  Task Date
                </label>

                <input
                  ref={dateRef}
                  id="edit-task-date"
                  name="assigned_date"
                  type="date"
                  className="form-control"
                  min={todayInColombo()}
                  max="2100-12-31"
                  value={values.assigned_date}
                  onChange={change}
                  disabled={saving}
                  required
                />
              </div>

              <div className="mb-3">
                <label htmlFor="edit-task-time" className="form-label">
                  Due Time (Optional)
                </label>

                <input
                  id="edit-task-time"
                  name="due_time"
                  type="time"
                  className="form-control"
                  value={values.due_time}
                  onChange={change}
                  disabled={saving}
                />
              </div>

              <div className="mb-3">
                <label htmlFor="edit-task-priority" className="form-label">
                  Priority
                </label>

                <select
                  id="edit-task-priority"
                  name="priority"
                  className="form-select"
                  value={values.priority}
                  onChange={change}
                  disabled={saving}
                  required
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
