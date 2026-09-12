import { useEffect, useRef, useState } from 'react';

function AttendanceRecordingForm({ employee, onRecord, onCancel }) {
  const [action, setAction] = useState('check-in');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function handleSubmit(event) {
       event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const requestError = await onRecord(action);

      if (requestError) {
        setError(requestError);
           }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="border rounded p-3 p-md-4 mb-4"
      aria-labelledby="record-attendance-heading"
    >
      <h4
        id="record-attendance-heading"
        className="h5"
        ref={headingRef}
        tabIndex={-1}
      >
        Record attendance
      </h4>

      <p className="small text-secondary">
        The server will record the current date and time.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label
            htmlFor="record-attendance-employee"
            className="form-label"
          >
            Employee
          </label>

          <input
            id="record-attendance-employee"
            className="form-control"
            value={`${employee.full_name} (${employee.employee_id})`}
            readOnly
          />

          <div className="form-text">
            Your employee identity comes from the signed-in account.
          </div>
        </div>

        <div className="mb-3">
          <label
            htmlFor="record-attendance-action"
            className="form-label"
          >
            Attendance action
          </label>

          <select
            id="record-attendance-action"
            className="form-select"
            value={action}
            disabled={submitting}
            onChange={(event) => {
              setAction(event.target.value);
              setError('');
            }}
          >
            <option value="check-in">Check in</option>
            <option value="check-out">Check out</option>
          </select>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        <div className="d-flex flex-wrap gap-2">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting
              ? 'Saving...'
              : action === 'check-in'
                ? 'Check in'
                : 'Check out'}
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

export default AttendanceRecordingForm;