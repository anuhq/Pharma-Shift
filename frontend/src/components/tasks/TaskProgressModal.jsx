import { useEffect, useRef, useState } from 'react';
import { updateTaskProgress } from '../../services/taskApi';

export default function TaskProgressModal({ task, onClose, onSaved }) {
  const dialogRef = useRef(null);
  const savingRef = useRef(false);
  const [status, setStatus] = useState(task.status);
  const [note, setNote] = useState(task.completion_note || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const statuses = ['Assigned', 'In Progress', 'Completed'];

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const { task: updated } = await updateTaskProgress(task.assignment_id, { status, completion_note: note.trim() });
      onSaved(updated);
    } catch (err) {
      setError(err.errors ? Object.values(err.errors).join(' ') : err.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return <dialog ref={dialogRef} className="task-modal border-0 rounded shadow p-0" aria-labelledby="task-progress-title"
    onCancel={(event) => { event.preventDefault(); if (!savingRef.current) onClose(); }}>
    <div className="modal-content">
      <div className="modal-header p-3 border-bottom">
        <h4 id="task-progress-title" className="modal-title h5">Update Task Progress</h4>
        <button type="button" className="btn-close" aria-label="Close" disabled={saving} onClick={onClose} />
      </div>
      <form onSubmit={submit}>
        <div className="modal-body p-3">
          <p className="fw-semibold mb-1">{task.title}</p>
          <p className="small">Assigned to: {task.employee_name || 'Select a user in the task table'}</p>
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          <fieldset disabled={saving}>
            <legend className="visually-hidden">Progress details</legend>
            <label htmlFor="progress-status" className="form-label">Status</label>
            <select id="progress-status" className="form-select mb-3" required value={status} onChange={(event) => setStatus(event.target.value)}>
              {!statuses.includes(status) && <option value={status} disabled>{status} (select a new status)</option>}
              {statuses.map((value) => <option key={value}>{value}</option>)}
            </select>
            <label htmlFor="progress-note" className="form-label">Progress / completion note (optional)</label>
            <textarea id="progress-note" className="form-control" rows={4} maxLength={255} value={note} onChange={(event) => setNote(event.target.value)}
              aria-describedby="progress-note-help" />
            <div id="progress-note-help" className="form-text">Record work completed or explain what remains. Up to 255 characters.</div>
          </fieldset>
        </div>
        <div className="modal-footer p-3 border-top gap-2">
          <button type="button" className="btn btn-outline-secondary" disabled={saving} onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-success" disabled={saving || !statuses.includes(status)}>{saving ? 'Saving...' : 'Save Progress'}</button>
        </div>
      </form>
    </div>
  </dialog>;
}
