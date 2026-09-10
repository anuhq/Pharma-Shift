import { useEffect, useRef, useState } from 'react';

function AttendanceRecordingForm({ employee, onRecord, onCancel }) {
  const [action, setAction] = useState('check-in');
  const [error, setError] = useState('');
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    setError(onRecord(action));
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
        Record attendance - staff preview
      </h4>
      <p className="small text-secondary">
        The current date and time will be captured when you submit.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="record-attendance-employee" className="form-label">
            Employee
          </label>
          <input
            id="record-attendance-employee"
            className="form-control"
            value={`${employee.full_name} (${employee.employee_id})`}
            readOnly
          />
          <div className="form-text">
            This fictional employee is fixed for the preview.
          </div>
        </div>

        <div className="mb-3">
          <label htmlFor="record-attendance-action" className="form-label">
            Attendance action
          </label>
          <select
            id="record-attendance-action"
            className="form-select"
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setError('');
            }}
          >
            <option value="check-in">Check in</option>
            <option value="check-out">Check out</option>
          </select>
        </div>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        <div className="d-flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary">
            {action === 'check-in' ? 'Preview check-in' : 'Preview check-out'}
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

export default AttendanceRecordingForm;
