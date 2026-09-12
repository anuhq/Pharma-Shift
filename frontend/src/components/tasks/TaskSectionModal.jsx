import { useEffect, useRef, useState } from 'react';
import { createTaskSection, getTaskOptions } from '../../services/taskApi';
import { taskSections } from './taskSections';

export default function TaskSectionModal({ section, onClose, onSaved }) {
  const config = taskSections[section];
  const dialogRef = useRef(null);
  const savingRef = useRef(false);
  const [values, setValues] = useState(() => Object.fromEntries(config.fields.map((field) => [field.name, field.initial || ''])));
  const [options, setOptions] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
    getTaskOptions(controller.signal).then(setOptions).catch((err) => {
      if (err.name !== 'AbortError') setLoadError(err.message);
    });
    return () => controller.abort();
  }, [attempt]);

  async function submit(event) {
    event.preventDefault();
    if (savingRef.current) return;
    const body = {};
    for (const field of config.fields) {
      const value = values[field.name].trim();
      if (!field.optional && !value) {
        setError(`Enter ${field.label.toLowerCase()}.`);
        event.currentTarget.elements.namedItem(field.name)?.focus();
        return;
      }
      body[field.name] = field.source ? (value ? Number(value) : null) : value;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const { record } = await createTaskSection(section, body);
      onSaved(record);
    } catch (err) {
      setError(err.errors ? Object.values(err.errors).join(' ') : err.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const missingOptions = options && config.fields.some((field) => field.source && !field.optional && !options[field.source]?.length);

  return (
    <dialog ref={dialogRef} className="task-modal border-0 rounded shadow p-0" aria-labelledby="section-modal-title"
      onCancel={(event) => { event.preventDefault(); if (!savingRef.current) onClose(); }}>
      <div className="modal-content">
        <div className="modal-header p-3 border-bottom">
          <h4 id="section-modal-title" className="modal-title h5">Add {config.label}</h4>
          <button type="button" className="btn-close" aria-label="Close" disabled={saving} onClick={onClose} />
        </div>
        {!options && !loadError && <p className="p-3" role="status">Loading form options...</p>}
        {loadError && <div className="alert alert-danger m-3" role="alert">{loadError}
          <button type="button" className="btn btn-outline-danger btn-sm ms-2" onClick={() => { setLoadError(''); setAttempt((value) => value + 1); }}>Retry</button>
        </div>}
        {options && <form onSubmit={submit}>
          <div className="modal-body p-3">
            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            <fieldset disabled={saving}>
              <legend className="visually-hidden">{config.label} details</legend>
              <div className="row g-3">
                {config.fields.map((field) => {
                  const id = `section-${field.name}`;
                  const props = {
                    id, name: field.name, value: values[field.name], required: !field.optional,
                    onChange: (event) => setValues((current) => ({ ...current, [field.name]: event.target.value })),
                  };
                  return <div key={field.name} className={field.type === 'textarea' ? 'col-12' : 'col-md-6'}>
                    <label htmlFor={id} className="form-label">{field.label}{field.optional ? ' (optional)' : ''}</label>
                    {field.type === 'select' ? <select {...props} className="form-select">
                      {!field.choices && <option value="">{field.optional ? 'None' : `Select ${field.label.toLowerCase()}`}</option>}
                      {field.choices ? field.choices.map((choice) => <option key={choice}>{choice}</option>) : options[field.source].map((item) => <option key={item[field.id]} value={item[field.id]}>{item[field.display]}</option>)}
                    </select> : field.type === 'textarea' ? <textarea {...props} className="form-control" rows={4} maxLength={field.maxLength} /> :
                      <input {...props} className="form-control" type={field.type || 'text'} maxLength={field.maxLength} placeholder={field.placeholder}
                        min={field.type === 'date' ? '1000-01-01' : undefined} max={field.type === 'date' ? '9999-12-31' : undefined} />}
                    {field.source && !options[field.source].length && <div className="form-text">No active {field.source} available.{field.source === 'checklists' ? ' You can create a checklist in the Checklists tab.' : ''}</div>}
                  </div>;
                })}
              </div>
              <p className="small mt-3 mb-0">Initial status: {config.status}</p>
            </fieldset>
          </div>
          <div className="modal-footer p-3 border-top gap-2">
            <button type="button" className="btn btn-outline-secondary" disabled={saving} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-success" disabled={saving || missingOptions}>{saving ? 'Saving...' : `Save ${config.label}`}</button>
          </div>
        </form>}
      </div>
    </dialog>
  );
}
