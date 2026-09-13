import { useEffect, useRef, useState } from 'react';

function AttendanceCorrectionForm({ record, onSave, onCancel }) {
  // Keep edits separate until the manager submits the form.
  const [draft, setDraft] = useState({
    check_in_time: record.check_in_time.slice(0, 5),
    check_out_time: record.check_out_time?.slice(0, 5) ?? '',
    correction_note: '',
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  function updateField(event) {
    const { name, value } = event.target;

    setDraft((current) => ({
      ...current,
      [name]: value,
    }));

    setErrors((current) => ({
      ...current,
      [name]: undefined,
      form: undefined,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = {};
    const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    const reason = draft.correction_note.trim();

    if (!validTime.test(draft.check_in_time)) {
      nextErrors.check_in_time = 'Enter a valid check-in time.';
    }

    if (
      draft.check_out_time &&
      !validTime.test(draft.check_out_time)
    ) {
      nextErrors.check_out_time = 'Enter a valid check-out time.';
    } else if (
      draft.check_out_time &&
      validTime.test(draft.check_in_time) &&
      draft.check_out_time < draft.check_in_time
    ) {
      nextErrors.check_out_time =
        'Check-out cannot be before check-in.';
    }

    if (reason.length < 3) {
      nextErrors.correction_note =
        'Enter a reason containing at least 3 characters.';
    } else if (reason.length > 255) {
      nextErrors.correction_note =
        'Keep the reason within 255 characters.';
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      const requestError = await onSave({
        check_in_time: `${draft.check_in_time}:00`,
        check_out_time: draft.check_out_time
          ? `${draft.check_out_time}:00`
          : null,
        correction_note: reason,
      });

      if (requestError) {
        setErrors({ form: requestError });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="border rounded p-3 p-md-4 mb-4"
      aria-labelledby="correct-attendance-heading"
    >
      <h4
        id="correct-attendance-heading"
        className="h5"
        ref={headingRef}
        tabIndex={-1}
      >
        Correct attendance
      </h4>

      <p>
        <strong>{record.full_name}</strong>
        {' · '}
        Employee {record.employee_id}
        {' · '}
        {record.attendance_date}
      </p>

      <p className="small text-secondary">
        Enter the corrected times and explain why the record changed.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        {errors.form && (
          <div className="alert alert-danger" role="alert">
            {errors.form}
          </div>
        )}

        <div className="row g-3 mb-3">
          <div className="col-12 col-md-4">
            <label
              htmlFor="correction-check-in"
              className="form-label"
            >
              Check-in time
            </label>

            <input
              id="correction-check-in"
              name="check_in_time"
              type="time"
              step="60"
              required
              className={`form-control ${
                errors.check_in_time ? 'is-invalid' : ''
              }`}
              value={draft.check_in_time}
              disabled={submitting}
              onChange={updateField}
            />

            {errors.check_in_time && (
              <div className="invalid-feedback">
                {errors.check_in_time}
              </div>
            )}
          </div>

          <div className="col-12 col-md-4">
            <label
              htmlFor="correction-check-out"
              className="form-label"
            >
              Check-out time
            </label>

            <input
              id="correction-check-out"
              name="check_out_time"
              type="time"
              step="60"
              className={`form-control ${
                errors.check_out_time ? 'is-invalid' : ''
              }`}
              value={draft.check_out_time}
              disabled={submitting}
              onChange={updateField}
            />

            {errors.check_out_time && (
              <div className="invalid-feedback">
                {errors.check_out_time}
              </div>
            )}
          </div>

          <div className="col-12 col-md-4">
            <label
              htmlFor="correction-note"
              className="form-label"
            >
              Correction reason
            </label>

            <input
              id="correction-note"
              name="correction_note"
              type="text"
              maxLength={255}
              className={`form-control ${
                errors.correction_note ? 'is-invalid' : ''
              }`}
              value={draft.correction_note}
              disabled={submitting}
              onChange={updateField}
            />

            {errors.correction_note && (
              <div className="invalid-feedback">
                {errors.correction_note}
              </div>
            )}
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Saving...' : 'Save correction'}
          </button>

          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={submitting}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

export default AttendanceCorrectionForm;