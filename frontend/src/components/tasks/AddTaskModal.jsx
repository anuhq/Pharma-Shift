import { useEffect, useRef, useState } from 'react';
import { createTask, getTaskOptions } from '../../services/taskApi';

function AddTaskModal({ onClose, onSaved }) {
  const dialogRef = useRef(null);
  const savingRef = useRef(false);
  const [options, setOptions] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [values, setValues] = useState({
    template_id: '', title: '', description: '', assigneeType: 'employee',
    assigneeId: '', assigned_date: '', due_time: '', priority: 'Medium',
  });

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

  useEffect(() => {
    const controller = new AbortController();
    getTaskOptions(controller.signal)
      .then(setOptions)
      .catch((err) => { if (err.name !== 'AbortError') setLoadError(err.message); });
    return () => controller.abort();
  }, [attempt]);

  function change(event) {
    const { name, value } = event.target;
    setValues((current) => {
      const next = { ...current, [name]: value };
      if (name === 'assigneeType') next.assigneeId = '';
      if (name === 'template_id' && value) {
        next.priority = options.templates.find((template) => template.template_id === Number(value)).priority;
      }
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (savingRef.current) return;
    if (!values.template_id && !values.title.trim()) {
      setError('Enter a task name.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const { task } = await createTask({
        template_id: values.template_id ? Number(values.template_id) : null,
        title: values.title.trim(), description: values.description.trim(),
        employee_id: values.assigneeType === 'employee' ? Number(values.assigneeId) : null,
        shift_type_id: values.assigneeType === 'shift' ? Number(values.assigneeId) : null,
        assigned_date: values.assigned_date, due_time: values.due_time || null,
        priority: values.priority,
      });
      onSaved(task);
    } catch (err) {
      setError(err.errors ? Object.values(err.errors).join(' ') : err.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const assignees = options ? (values.assigneeType === 'employee' ? options.employees : options.shifts) : [];

  return (
    <dialog ref={dialogRef} className="task-modal border-0 rounded shadow p-0"
      aria-labelledby="add-task-modal-title"
      onCancel={(event) => { event.preventDefault(); if (!savingRef.current) onClose(); }}>
      <div className="modal-content">
        <div className="modal-header p-3 border-bottom">
          <h4 id="add-task-modal-title" className="modal-title h5">Add Task</h4>
          <button type="button" className="btn-close" aria-label="Close" disabled={saving} onClick={onClose} />
        </div>
        {!options && !loadError && <p className="p-3 mb-0" role="status">Loading employees, shifts and templates...</p>}
        {loadError && <div className="alert alert-danger m-3" role="alert">
          {loadError}
          <button type="button" className="btn btn-outline-danger btn-sm ms-2" onClick={() => { setLoadError(''); setAttempt((value) => value + 1); }}>Retry</button>
        </div>}
        {options && <form onSubmit={submit}>
          <div className="modal-body p-3">
            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            <fieldset disabled={saving}>
              <legend className="visually-hidden">Task details</legend>
              <div className="row g-3">
                <div className="col-12">
                  <label htmlFor="task-template" className="form-label">Task template</label>
                  <select id="task-template" name="template_id" className="form-select" value={values.template_id} onChange={change}>
                    <option value="">Create a new task</option>
                    {options.templates.map((template) => <option key={template.template_id} value={template.template_id}>{template.template_name}</option>)}
                  </select>
                </div>
                {!values.template_id && <>
                  <div className="col-12">
                    <label htmlFor="task-title" className="form-label">Task name</label>
                    <input id="task-title" name="title" className="form-control" required maxLength={100} value={values.title} onChange={change} />
                  </div>
                  <div className="col-12">
                    <label htmlFor="task-description" className="form-label">Instructions (optional)</label>
                    <textarea id="task-description" name="description" className="form-control" rows={3} maxLength={255} value={values.description} onChange={change} />
                    <div className="form-text">New tasks are also saved as reusable templates.</div>
                  </div>
                </>}
                {values.template_id && <p className="mb-0 small">{options.templates.find((template) => template.template_id === Number(values.template_id))?.description}</p>}
                <div className="col-md-6">
                  <label htmlFor="task-assignee-type" className="form-label">Assign to</label>
                  <select id="task-assignee-type" name="assigneeType" className="form-select" value={values.assigneeType} onChange={change}>
                    <option value="employee">Employee</option><option value="shift">Shift</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label htmlFor="task-assignee" className="form-label">{values.assigneeType === 'employee' ? 'Employee' : 'Shift'}</label>
                  <select id="task-assignee" name="assigneeId" className="form-select" required value={values.assigneeId} onChange={change}>
                    <option value="">Select {values.assigneeType}</option>
                    {assignees.map((item) => <option key={item.employee_id ?? item.shift_type_id} value={item.employee_id ?? item.shift_type_id}>{item.full_name ?? item.shift_name}</option>)}
                  </select>
                  {!assignees.length && <div className="form-text">No active {values.assigneeType === 'employee' ? 'employees' : 'shifts'} are available. Add them to the database first.</div>}
                </div>
                <div className="col-md-6">
                  <label htmlFor="task-date" className="form-label">Date</label>
                  <input id="task-date" name="assigned_date" type="date" min="1000-01-01" max="9999-12-31" className="form-control" required value={values.assigned_date} onChange={change} />
                </div>
                <div className="col-md-6">
                  <label htmlFor="task-due-time" className="form-label">Due time (optional)</label>
                  <input id="task-due-time" name="due_time" type="time" className="form-control" value={values.due_time} onChange={change} />
                </div>
                <div className="col-md-6">
                  <label htmlFor="task-priority" className="form-label">Priority</label>
                  <select id="task-priority" name="priority" className="form-select" value={values.priority} onChange={change}>
                    {['Low', 'Medium', 'High'].map((priority) => <option key={priority}>{priority}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label htmlFor="task-status" className="form-label">Initial status</label>
                  <input id="task-status" className="form-control" value="Assigned" readOnly />
                </div>
              </div>
            </fieldset>
          </div>
          <div className="modal-footer p-3 border-top gap-2">
            <button type="button" className="btn btn-outline-secondary" disabled={saving} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-success" disabled={saving || !assignees.length}>{saving ? 'Saving...' : 'Save Task'}</button>
          </div>
        </form>}
      </div>
    </dialog>
  );
}

export default AddTaskModal;
