import { useEffect, useRef, useState } from 'react';

// Reject dates such as 30 February that JavaScript would adjust.
function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function LeaveRequestForm({ employee, leaveTypes, onSubmit, onCancel }) {
  // Keep a draft so Cancel leaves the request list unchanged.
  const [values, setValues] = useState({
    leave_type: '', start_date: '', end_date: '', reason: '',
  });
  const [errors, setErrors] = useState({});
  const headingRef = useRef(null);

  useEffect(() => { headingRef.current?.focus(); }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    // Spaces alone should not count as a reason.
    const reason = values.reason.trim();
    if (!leaveTypes.includes(values.leave_type)) nextErrors.leave_type = 'Select a leave type.';
    if (!isValidDate(values.start_date)) nextErrors.start_date = 'Enter a valid start date.';
    if (!isValidDate(values.end_date)) nextErrors.end_date = 'Enter a valid end date.';
    if (!nextErrors.start_date && !nextErrors.end_date && values.end_date < values.start_date) {
      nextErrors.end_date = 'End date cannot be before start date.';
    }
    if (!reason) nextErrors.reason = 'Enter a reason for this request.';
    else if (reason.length > 255) nextErrors.reason = 'Use 255 characters or fewer.';
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      event.currentTarget.elements.namedItem(firstError)?.focus();
      return;
    }
    onSubmit({ ...values, reason });
  }

  return (
    <section className="border rounded p-3 mb-4 bg-light" aria-labelledby="leave-form-title">
      <h4 id="leave-form-title" className="h5" tabIndex={-1} ref={headingRef}>
        Submit leave request — staff preview
      </h4>
      <p className="small">This request will be added to the demo list with Pending status.</p>
      <form onSubmit={handleSubmit} noValidate>
        {Object.keys(errors).length > 0 && (
          <div className="alert alert-danger" role="alert">Check the highlighted fields.</div>
        )}
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label htmlFor="leave-request-employee" className="form-label">Employee</label>
            <input id="leave-request-employee" className="form-control" readOnly
              value={`${employee.full_name} (${employee.employee_id})`} />
          </div>
          <div className="col-12 col-md-6">
            <label htmlFor="leave-request-type" className="form-label">Leave type</label>
            <select id="leave-request-type" name="leave_type" required
              className={`form-select${errors.leave_type ? ' is-invalid' : ''}`}
              value={values.leave_type} onChange={updateField}
              aria-invalid={Boolean(errors.leave_type)}
              aria-describedby={errors.leave_type ? 'leave-type-error' : undefined}>
              <option value="">Select leave type</option>
              {leaveTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            {errors.leave_type && <div id="leave-type-error" className="invalid-feedback">{errors.leave_type}</div>}
          </div>
          <div className="col-12 col-md-6">
            <label htmlFor="leave-request-start" className="form-label">Start date</label>
            <input id="leave-request-start" name="start_date" type="date" required
              className={`form-control${errors.start_date ? ' is-invalid' : ''}`}
              value={values.start_date} onChange={updateField}
              aria-invalid={Boolean(errors.start_date)}
              aria-describedby={errors.start_date ? 'leave-start-error' : undefined} />
            {errors.start_date && <div id="leave-start-error" className="invalid-feedback">{errors.start_date}</div>}
          </div>
          <div className="col-12 col-md-6">
            <label htmlFor="leave-request-end" className="form-label">End date</label>
            <input id="leave-request-end" name="end_date" type="date" required
              className={`form-control${errors.end_date ? ' is-invalid' : ''}`}
              value={values.end_date} onChange={updateField}
              aria-invalid={Boolean(errors.end_date)}
              aria-describedby={errors.end_date ? 'leave-end-error' : undefined} />
            {errors.end_date && <div id="leave-end-error" className="invalid-feedback">{errors.end_date}</div>}
          </div>
          <div className="col-12">
            <label htmlFor="leave-request-reason" className="form-label">Reason</label>
            <textarea id="leave-request-reason" name="reason" rows={3} required maxLength={255}
              className={`form-control${errors.reason ? ' is-invalid' : ''}`}
              value={values.reason} onChange={updateField}
              aria-invalid={Boolean(errors.reason)}
              aria-describedby={`leave-reason-help${errors.reason ? ' leave-reason-error' : ''}`} />
            {errors.reason && <div id="leave-reason-error" className="invalid-feedback">{errors.reason}</div>}
            <div id="leave-reason-help" className="form-text">Up to 255 characters. Use fictional information.</div>
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2 mt-3">
          <button type="submit" className="btn btn-primary">Submit preview request</button>
          <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </section>
  );
}

export default LeaveRequestForm;
