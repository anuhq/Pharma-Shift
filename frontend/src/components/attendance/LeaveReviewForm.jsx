
import { useState } from 'react';

function LeaveReviewForm({
  request,
  onSubmit,
  onCancel,
  submitting = false,
}) {
  const [decision, setDecision] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();

    if (submitting) return;

    if (!['Approved', 'Rejected'].includes(decision)) {
      setError('Please select a decision.');
      return;
    }

    const note = reviewNote.trim();

    if (note.length > 255) {
      setError('Review note must be 255 characters or fewer.');
      return;
    }

    const action =
      decision === 'Approved' ? 'approve' : 'reject';

    const confirmed = window.confirm(
      `Are you sure you want to ${action} leave request LR-${String(
        request.leave_request_id
      ).padStart(4, '0')}?`
    );

    if (!confirmed) return;

    setError('');

    onSubmit({
      decision,
      review_note: note,
    });
  }

  return (
    <section
      className="border rounded p-3 mt-3 bg-light"
      aria-labelledby="leave-review-title"
    >
      <h4 id="leave-review-title" className="h5 mb-3">
        Review leave request
      </h4>

      <div className="mb-3">
        <p className="mb-1">
          <strong>Employee:</strong> {request.full_name}
        </p>

        <p className="mb-1">
          <strong>Leave type:</strong> {request.leave_type}
        </p>

        <p className="mb-1">
          <strong>Dates:</strong> {request.start_date} to{' '}
          {request.end_date}
        </p>

        <p className="mb-1">
          <strong>Reason:</strong>{' '}
          {request.reason || 'Not provided'}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-3">
          <label
            htmlFor="leave-review-decision"
            className="form-label"
          >
            Decision
          </label>

          <select
            id="leave-review-decision"
            className="form-select"
            value={decision}
            onChange={(event) => {
              setDecision(event.target.value);
              setError('');
            }}
            disabled={submitting}
            required
          >
            <option value="">Select a decision</option>
            <option value="Approved">Approve</option>
            <option value="Rejected">Reject</option>
          </select>
        </div>

        <div className="mb-3">
          <label
            htmlFor="leave-review-note"
            className="form-label"
          >
            Review note (optional)
          </label>

          <textarea
            id="leave-review-note"
            className="form-control"
            rows={3}
            maxLength={255}
            value={reviewNote}
            onChange={(event) => {
              setReviewNote(event.target.value);
              setError('');
            }}
            disabled={submitting}
            placeholder="Add a note about your decision"
          />

          <div className="form-text">
            Maximum 255 characters.
          </div>
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
            {submitting ? 'Saving...' : 'Submit decision'}
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

export default LeaveReviewForm;
