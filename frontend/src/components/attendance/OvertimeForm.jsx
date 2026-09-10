import { useEffect, useRef, useState } from 'react';

// Reject dates that JavaScript would move into the next month.
function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function OvertimeForm({ record, employees, statuses, onSave, onCancel }) {
  // Keep a draft so Cancel leaves the saved record unchanged.
  const [values, setValues] = useState({
    employee_id: record ? String(record.employee_id) : '',
    overtime_date: record?.overtime_date ?? '',
    hours_worked: record ? String(record.hours_worked) : '',
    status: record?.status ?? 'Pending',
  });
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const headingRef = useRef(null);

  useEffect(() => { headingRef.current?.focus(); }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setSaveError('');
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    const employeeId = Number(values.employee_id);
    const hours = Number(values.hours_worked);

    if (!employees.some((employee) => employee.employee_id === employeeId)) {
      nextErrors.employee_id = 'Select an employee.';
    }
    if (!isValidDate(values.overtime_date)) nextErrors.overtime_date = 'Enter a valid overtime date.';
    if (!values.hours_worked.trim() || !Number.isFinite(hours) || hours <= 0 || hours > 24) {
      nextErrors.hours_worked = 'Enter hours greater than 0 and no more than 24.';
    } else if (!/^\d+(\.\d{1,2})?$/.test(values.hours_worked)) {
      nextErrors.hours_worked = 'Use a number with up to two decimal places.';
    }
    if (!statuses.includes(values.status)) nextErrors.status = 'Select a valid status.';

    setErrors(nextErrors);
    setSaveError('');
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      event.currentTarget.elements.namedItem(firstError)?.focus();
      return;
    }

    setSaveError(onSave({ ...values, employee_id: employeeId, hours_worked: hours }));
  }

  return (
    <section className="border rounded p-3 mb-4 bg-light" aria-labelledby="overtime-form-title">
      <h4 id="overtime-form-title" className="h5" tabIndex={-1} ref={headingRef}>
        {record ? 'Edit overtime' : 'Add overtime'} — manager preview
      </h4>
      <p className="small">Changes apply to the demo list only.</p>
      <form onSubmit={handleSubmit} noValidate>
        {Object.keys(errors).length > 0 && (
          <div className="alert alert-danger" role="alert">Check the highlighted fields.</div>
        )}
        {saveError && <div className="alert alert-danger" role="alert">{saveError}</div>}
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label htmlFor="overtime-employee" className="form-label">Employee</label>
            <select id="overtime-employee" name="employee_id" required
              className={`form-select${errors.employee_id ? ' is-invalid' : ''}`}
              value={values.employee_id} onChange={updateField}
              aria-invalid={Boolean(errors.employee_id)}
              aria-describedby={errors.employee_id ? 'overtime-employee-error' : undefined}>
              <option value="">Select employee</option>
              {employees.map((employee) => <option key={employee.employee_id} value={employee.employee_id}>
                {employee.full_name} ({employee.employee_id})
              </option>)}
            </select>
            {errors.employee_id && <div id="overtime-employee-error" className="invalid-feedback">{errors.employee_id}</div>}
          </div>
          <div className="col-12 col-md-6">
            <label htmlFor="overtime-entry-date" className="form-label">Overtime date</label>
            <input id="overtime-entry-date" name="overtime_date" type="date" required
              className={`form-control${errors.overtime_date ? ' is-invalid' : ''}`}
              value={values.overtime_date} onChange={updateField}
              aria-invalid={Boolean(errors.overtime_date)}
              aria-describedby={errors.overtime_date ? 'overtime-date-error' : undefined} />
            {errors.overtime_date && <div id="overtime-date-error" className="invalid-feedback">{errors.overtime_date}</div>}
          </div>
          <div className="col-12 col-md-6">
            <label htmlFor="overtime-hours" className="form-label">Hours worked</label>
            <input id="overtime-hours" name="hours_worked" type="number" min="0.01" max="24" step="0.01" required
              className={`form-control${errors.hours_worked ? ' is-invalid' : ''}`}
              value={values.hours_worked} onChange={updateField}
              aria-invalid={Boolean(errors.hours_worked)}
              aria-describedby={`overtime-hours-help${errors.hours_worked ? ' overtime-hours-error' : ''}`} />
            {errors.hours_worked && <div id="overtime-hours-error" className="invalid-feedback">{errors.hours_worked}</div>}
            <div id="overtime-hours-help" className="form-text">Use decimal hours: 1.5 means 1 hour 30 minutes.</div>
          </div>
          <div className="col-12 col-md-6">
            <label htmlFor="overtime-entry-status" className="form-label">Status</label>
            <select id="overtime-entry-status" name="status" required
              className={`form-select${errors.status ? ' is-invalid' : ''}`}
              value={values.status} onChange={updateField}
              aria-invalid={Boolean(errors.status)}
              aria-describedby={errors.status ? 'overtime-status-error' : undefined}>
              {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            {errors.status && <div id="overtime-status-error" className="invalid-feedback">{errors.status}</div>}
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2 mt-3">
          <button type="submit" className="btn btn-primary">{record ? 'Save preview changes' : 'Add preview record'}</button>
          <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </section>
  );
}

export default OvertimeForm;
