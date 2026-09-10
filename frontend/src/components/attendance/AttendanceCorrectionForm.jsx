import { useEffect, useRef, useState } from 'react';

function AttendanceCorrectionForm({ record, onSave, onCancel }) {
  // Edit a separate draft so Cancel leaves the displayed record unchanged.
  const [draft, setDraft] = useState({
    check_in_time: record.check_in_time.slice(0, 5),
    check_out_time: record.check_out_time?.slice(0, 5) ?? '',
    status: record.status,
    correction_note: '',
  });
  const [errors, setErrors] = useState({});
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    const reason = draft.correction_note.trim();

    if (!validTime.test(draft.check_in_time)) {
      nextErrors.check_in_time = 'Enter a valid check-in time.';
    }
    if (draft.check_out_time && !validTime.test(draft.check_out_time)) {
      nextErrors.check_out_time = 'Enter a valid check-out time.';
    } else if (
      draft.check_out_time &&
      validTime.test(draft.check_in_time) &&
      draft.check_out_time < draft.check_in_time
    ) {
      nextErrors.check_out_time = 'Check-out cannot be before check-in on this date.';
    }
    if (!['Present', 'Late'].includes(draft.status)) {
      nextErrors.status = 'Select a valid attendance status.';
    }
    if (!reason) {
      nextErrors.correction_note = 'Enter a reason for this correction.';
    } else if (reason.length > 255) {
      nextErrors.correction_note = 'Keep the reason within 255 characters.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    // Keep the original seconds when the manager did not change that time.
    const checkIn = draft.check_in_time === record.check_in_time.slice(0, 5)
      ? record.check_in_time
      : `${draft.check_in_time}:00`;
    const checkOut = !draft.check_out_time
      ? null
      : draft.check_out_time === record.check_out_time?.slice(0, 5)
        ? record.check_out_time
        : `${draft.check_out_time}:00`;

    if (checkOut && checkOut < checkIn) {
      setErrors({ check_out_time: 'Check-out cannot be before check-in on this date.' });
      return;
    }

    onSave({
      check_in_time: checkIn,
      check_out_time: checkOut,
      status: draft.status,
      correction_note: reason,
    });
  }

  return (
    <section className="border rounded p-3 p-md-4 mb-4" aria-labelledby="correct-attendance-heading">
      <h4 id="correct-attendance-heading" className="h5" ref={headingRef} tabIndex={-1}>
        Correct attendance - manager preview
      </h4>
      <p>
        <strong>{record.full_name}</strong> · Employee {record.employee_id} · {record.attendance_date}
      </p>
      <p className="small text-secondary">
        Both times below refer to the displayed attendance date.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        {Object.keys(errors).length > 0 && (
          <div className="alert alert-danger" role="alert">
            Please correct the highlighted fields. The record has not been changed.
          </div>
        )}

        <div className="row g-3 mb-3">
          <div className="col-12 col-md-4">
            <label htmlFor="correction-check-in" className="form-label">Check-in time</label>
            <input
              id="correction-check-in"
              name="check_in_time"
              type="time"
              step="60"
              required
              className={`form-control ${errors.check_in_time ? 'is-invalid' : ''}`}
              value={draft.check_in_time}
              onChange={updateField}
              aria-invalid={Boolean(errors.check_in_time)}
              aria-describedby={errors.check_in_time ? 'correction-check-in-error' : undefined}
            />
            {errors.check_in_time && <div id="correction-check-in-error" className="invalid-feedback">{errors.check_in_time}</div>}
          </div>

          <div className="col-12 col-md-4">
            <label htmlFor="correction-check-out" className="form-label">Check-out time</label>
            <input
              id="correction-check-out"
              name="check_out_time"
              type="time"
              step="60"
              className={`form-control ${errors.check_out_time ? 'is-invalid' : ''}`}
              value={draft.check_out_time}
              onChange={updateField}
              aria-invalid={Boolean(errors.check_out_time)}
              aria-describedby={`correction-check-out-help${errors.check_out_time ? ' correction-check-out-error' : ''}`}
            />
            <div id="correction-check-out-help" className="form-text">Leave blank if the employee has not checked out.</div>
            {errors.check_out_time && <div id="correction-check-out-error" className="invalid-feedback">{errors.check_out_time}</div>}
          </div>

          <div className="col-12 col-md-4">
            <label htmlFor="correction-status" className="form-label">Status</label>
            <select
              id="correction-status"
              name="status"
              required
              className={`form-select ${errors.status ? 'is-invalid' : ''}`}
              value={draft.status}
              onChange={updateField}
              aria-invalid={Boolean(errors.status)}
              aria-describedby={errors.status ? 'correction-status-error' : undefined}
            >
              <option value="Present">Present</option>
              <option value="Late">Late</option>
            </select>
            {errors.status && <div id="correction-status-error" className="invalid-feedback">{errors.status}</div>}
          </div>
        </div>

        <div className="mb-3">
          <label htmlFor="correction-reason" className="form-label">Reason for correction</label>
          <textarea
            id="correction-reason"
            name="correction_note"
            rows={3}
            maxLength={255}
            required
            className={`form-control ${errors.correction_note ? 'is-invalid' : ''}`}
            value={draft.correction_note}
            onChange={updateField}
            aria-invalid={Boolean(errors.correction_note)}
            aria-describedby={`correction-reason-help${errors.correction_note ? ' correction-reason-error' : ''}`}
          />
          <div id="correction-reason-help" className="form-text">Required. Up to 255 characters.</div>
          {errors.correction_note && <div id="correction-reason-error" className="invalid-feedback">{errors.correction_note}</div>}
        </div>

        <div className="d-flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary">Apply preview correction</button>
          <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </section>
  );
}

export default AttendanceCorrectionForm;
