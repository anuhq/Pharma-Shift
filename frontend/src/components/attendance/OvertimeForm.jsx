
import { useEffect, useRef, useState } from 'react';

function isValidDate(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  if (Number(value.slice(0, 4)) < 1000) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function isValidHours(value) {
  const text = String(value).trim();

  if (!/^(0|[1-9]\d{0,2})(\.\d{1,2})?$/.test(text)) {
    return false;
  }

  const hours = Number(text);

  return (
    Number.isFinite(hours) &&
    hours > 0 &&
    hours <= 999.99
  );
}

function OvertimeForm({
  record = null,
  employees = [],
  onSave,
  onCancel,
}) {
  const isEditing = Boolean(record);

  const [values, setValues] = useState({
    employee_id: record ? String(record.employee_id) : '',
    overtime_date: record?.overtime_date ?? '',
    hours_worked: record
      ? String(record.hours_worked)
      : '',
  });

  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const headingRef = useRef(null);
  const savingRef = useRef(false);

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

    setSaveError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (savingRef.current) return;

    const nextErrors = {};
    const employeeId = Number(values.employee_id);

    if (
      !values.employee_id ||
      !employees.some(
        (employee) => employee.employee_id === employeeId
      )
    ) {
      nextErrors.employee_id = 'Select a valid employee.';
    }

    if (!isValidDate(values.overtime_date)) {
      nextErrors.overtime_date = 'Enter a valid overtime date.';
    }

    if (!isValidHours(values.hours_worked)) {
      nextErrors.hours_worked =
        'Enter valid hours greater than zero with up to two decimal places.';
    }

    setErrors(nextErrors);

    const firstError = Object.keys(nextErrors)[0];

    if (firstError) {
      event.currentTarget.elements
        .namedItem(firstError)
        ?.focus();

      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveError('');

    try {
      await onSave({
        employee_id: employeeId,
        overtime_date: values.overtime_date,
        hours_worked: Number(values.hours_worked),
      });
    } catch (error) {
      setSaveError(
        error.message || 'Unable to save overtime record.'
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <section
      className="border rounded p-3 mb-4 bg-light"
      aria-labelledby="overtime-form-title"
    >
      <h4
        id="overtime-form-title"
        className="h5 mb-3"
        tabIndex={-1}
        ref={headingRef}
      >
        {isEditing
          ? 'Edit overtime record'
          : 'Add overtime record'}
      </h4>

      <p className="text-secondary small mb-3">
        {isEditing
          ? 'Review the overtime details before saving your changes.'
          : 'Verify the overtime details before saving. New records will be saved as Approved.'}
      </p>

      <form onSubmit={handleSubmit} noValidate>
        {Object.values(errors).some(Boolean) && (
          <div
            className="alert alert-danger"
            role="alert"
          >
            Please correct the highlighted fields.
          </div>
        )}

        {saveError && (
          <div
            className="alert alert-danger"
            role="alert"
          >
            {saveError}
          </div>
        )}

        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label
              htmlFor="overtime-employee"
              className="form-label"
            >
              Employee
            </label>

            <select
              id="overtime-employee"
              name="employee_id"
              required
              disabled={saving}
              className={`form-select${
                errors.employee_id ? ' is-invalid' : ''
              }`}
              value={values.employee_id}
              onChange={updateField}
              aria-invalid={Boolean(errors.employee_id)}
            >
              <option value="">Select employee</option>

              {employees.map((employee) => (
                <option
                  key={employee.employee_id}
                  value={employee.employee_id}
                >
                  {employee.full_name} - {employee.role_name}
                </option>
              ))}
            </select>

            {errors.employee_id && (
              <div className="invalid-feedback">
                {errors.employee_id}
              </div>
            )}
          </div>

          <div className="col-12 col-md-6">
            <label
              htmlFor="overtime-entry-date"
              className="form-label"
            >
              Overtime date
            </label>

            <input
              id="overtime-entry-date"
              name="overtime_date"
              type="date"
              required
              disabled={saving}
              className={`form-control${
                errors.overtime_date ? ' is-invalid' : ''
              }`}
              value={values.overtime_date}
              onChange={updateField}
              aria-invalid={Boolean(errors.overtime_date)}
            />

            {errors.overtime_date && (
              <div className="invalid-feedback">
                {errors.overtime_date}
              </div>
            )}
          </div>

          <div className="col-12 col-md-6">
            <label
              htmlFor="overtime-hours"
              className="form-label"
            >
              Hours worked
            </label>

            <input
              id="overtime-hours"
              name="hours_worked"
              type="number"
              min="0.01"
              max="999.99"
              step="0.01"
              required
              disabled={saving}
              className={`form-control${
                errors.hours_worked ? ' is-invalid' : ''
              }`}
              value={values.hours_worked}
              onChange={updateField}
              aria-invalid={Boolean(errors.hours_worked)}
            />

            {errors.hours_worked && (
              <div className="invalid-feedback">
                {errors.hours_worked}
              </div>
            )}

            <div className="form-text">
              Enter decimal hours. For example, 1.5 represents
              1 hour and 30 minutes.
            </div>
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2 mt-3">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || employees.length === 0}
          >
            {saving
              ? 'Saving...'
              : isEditing
                ? 'Save changes'
                : 'Save Approved Overtime'}
          </button>

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

export default OvertimeForm;
