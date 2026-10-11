
import { useEffect, useRef, useState } from 'react';

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function LeaveRequestForm({
  employee,
  leaveTypes,
  onSubmit,
  onCancel,
  submitting = false,
  initialRequest = null,
}) {
  const isEditing = Boolean(initialRequest);

  const [values, setValues] = useState(() => ({
    leave_type: initialRequest?.leave_type ?? '',
    start_date: initialRequest?.start_date ?? '',
    end_date: initialRequest?.end_date ?? '',
    reason: initialRequest?.reason ?? '',
  }));

  const [errors, setErrors] = useState({});
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  function updateField(event) {
    const { name, value } = event.target;

    setValues((current) => ({
      ...current,
      [name]: value,
    }));

    setErrors((current) => ({
      ...current,
      [name]: undefined,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (submitting) return;

    const nextErrors = {};
    const reason = values.reason.trim();

    if (!leaveTypes.includes(values.leave_type)) {
      nextErrors.leave_type = 'Select a leave type.';
    }

    if (!isValidDate(values.start_date)) {
      nextErrors.start_date = 'Enter a valid start date.';
    }

    if (!isValidDate(values.end_date)) {
      nextErrors.end_date = 'Enter a valid end date.';
    }

    if (
      !nextErrors.start_date &&
      !nextErrors.end_date &&
      values.end_date < values.start_date
    ) {
      nextErrors.end_date =
        'End date cannot be before start date.';
    }

    if (!reason) {
      nextErrors.reason = 'Enter a reason for this request.';
    } else if (reason.length > 255) {
      nextErrors.reason = 'Use 255 characters or fewer.';
    }

    setErrors(nextErrors);

    const firstError = Object.keys(nextErrors)[0];

    if (firstError) {
      event.currentTarget.elements
        .namedItem(firstError)
        ?.focus();
      return;
    }

    onSubmit({
      ...values,
      reason,
    });
  }

  return (
    <section
      className="border rounded p-3 mb-4 bg-light"
      aria-labelledby="leave-form-title"
    >
      <h4
        id="leave-form-title"
        className="h5 mb-3"
        tabIndex={-1}
        ref={headingRef}
      >
        {isEditing ? 'Edit leave request' : 'Submit leave request'}
      </h4>

      <form onSubmit={handleSubmit} noValidate>
        {Object.values(errors).some(Boolean) && (
          <div className="alert alert-danger" role="alert">
            Please correct the highlighted fields.
          </div>
        )}

        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label
              htmlFor="leave-request-employee"
              className="form-label"
            >
              Employee
            </label>

            <input
              id="leave-request-employee"
              className="form-control"
              readOnly
              value={`${employee.full_name} (${employee.employee_id})`}
            />
          </div>

          <div className="col-12 col-md-6">
            <label
              htmlFor="leave-request-type"
              className="form-label"
            >
              Leave type
            </label>

            <select
              id="leave-request-type"
              name="leave_type"
              required
              disabled={submitting}
              className={`form-select${
                errors.leave_type ? ' is-invalid' : ''
              }`}
              value={values.leave_type}
              onChange={updateField}
              aria-invalid={Boolean(errors.leave_type)}
            >
              <option value="">Select leave type</option>

              {leaveTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            {errors.leave_type && (
              <div className="invalid-feedback">
                {errors.leave_type}
              </div>
            )}
          </div>

          <div className="col-12 col-md-6">
            <label
              htmlFor="leave-request-start"
              className="form-label"
            >
              Start date
            </label>

            <input
              id="leave-request-start"
              name="start_date"
              type="date"
              required
              disabled={submitting}
              className={`form-control${
                errors.start_date ? ' is-invalid' : ''
              }`}
              value={values.start_date}
              onChange={updateField}
              aria-invalid={Boolean(errors.start_date)}
            />

            {errors.start_date && (
              <div className="invalid-feedback">
                {errors.start_date}
              </div>
            )}
          </div>

          <div className="col-12 col-md-6">
            <label
              htmlFor="leave-request-end"
              className="form-label"
            >
              End date
            </label>

            <input
              id="leave-request-end"
              name="end_date"
              type="date"
              required
              disabled={submitting}
              className={`form-control${
                errors.end_date ? ' is-invalid' : ''
              }`}
              value={values.end_date}
              onChange={updateField}
              aria-invalid={Boolean(errors.end_date)}
            />

            {errors.end_date && (
              <div className="invalid-feedback">
                {errors.end_date}
              </div>
            )}
          </div>

          <div className="col-12">
            <label
              htmlFor="leave-request-reason"
              className="form-label"
            >
              Reason
            </label>

            <textarea
              id="leave-request-reason"
              name="reason"
              rows={3}
              required
              maxLength={255}
              disabled={submitting}
              className={`form-control${
                errors.reason ? ' is-invalid' : ''
              }`}
              value={values.reason}
              onChange={updateField}
              aria-invalid={Boolean(errors.reason)}
            />

            {errors.reason && (
              <div className="invalid-feedback">
                {errors.reason}
              </div>
            )}

            <div className="form-text">
              Maximum 255 characters.
            </div>
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2 mt-3">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting
              ? 'Saving...'
              : isEditing
                ? 'Save changes'
                : 'Submit leave request'}
          </button>

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

export default LeaveRequestForm;
