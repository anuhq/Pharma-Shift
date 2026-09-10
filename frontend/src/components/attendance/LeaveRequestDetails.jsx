import { useEffect, useRef, useState } from 'react';

const statusClasses = {
  Pending: 'text-bg-warning', Approved: 'text-bg-success', Rejected: 'text-bg-danger',
};

function LeaveRequestDetails({ request, manager, onDecision, onClose }) {
  // Wait for confirmation before changing the request.
  const [decision, setDecision] = useState(null);
  const [error, setError] = useState('');
  const headingRef = useRef(null);
  const confirmationRef = useRef(null);
  const approveRef = useRef(null);
  const rejectRef = useRef(null);
  const restoreDecisionFocusRef = useRef(null);
  // A manager cannot approve or reject their own request.
  const isOwnRequest = request.employee_id === manager.employee_id;
  const canDecide = request.status === 'Pending' && !isOwnRequest;
  const requestLabel = `LR-${String(request.leave_request_id).padStart(4, '0')}`;
  // Count both dates. UTC avoids daylight-saving differences.
  const calendarDays = Math.round((
    Date.parse(`${request.end_date}T00:00:00Z`) - Date.parse(`${request.start_date}T00:00:00Z`)
  ) / 86400000) + 1;

  useEffect(() => { headingRef.current?.focus(); }, []);
  // Return focus after Cancel re-enables the buttons.
  useEffect(() => {
    if (decision) confirmationRef.current?.focus();
    else if (restoreDecisionFocusRef.current) {
      restoreDecisionFocusRef.current.focus();
      restoreDecisionFocusRef.current = null;
    }
  }, [decision]);

  function cancelDecision() {
    const trigger = decision === 'Approved' ? approveRef : rejectRef;
    restoreDecisionFocusRef.current = trigger.current;
    setDecision(null);
    setError('');
  }

  // An empty message means the update succeeded.
  function confirmDecision() {
    const problem = onDecision(request.leave_request_id, decision);
    setError(problem);
    if (!problem) {
      setDecision(null);
      headingRef.current?.focus();
    }
  }

  return (
    <section className="border rounded p-3" aria-labelledby="leave-details-title">
      <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
        <h4 id="leave-details-title" className="h5 mb-0" tabIndex={-1} ref={headingRef}>Request details</h4>
        <button type="button" className="btn-close" aria-label="Close request details" onClick={onClose} />
      </div>
      <dl className="mb-3">
        <dt>Request ID</dt><dd>{requestLabel}</dd>
        <dt>Employee</dt><dd>{request.full_name} ({request.employee_id})</dd>
        <dt>Leave type</dt><dd>{request.leave_type}</dd>
        <dt>Start date</dt><dd>{request.start_date}</dd>
        <dt>End date</dt><dd>{request.end_date}</dd>
        <dt>Calendar days</dt><dd>{calendarDays}</dd>
        <dt>Reason</dt><dd className="text-break" style={{ whiteSpace: 'pre-wrap' }}>{request.reason}</dd>
        <dt>Status</dt>
        <dd><span className={`badge ${statusClasses[request.status]}`}>{request.status}</span></dd>
      </dl>
      <p className="small">Manager preview: {manager.full_name} ({manager.employee_id}).</p>
      {isOwnRequest && <p className="small">Your own request must be reviewed by another manager.</p>}
      {request.status !== 'Pending' && <p className="small">This request has already been decided.</p>}
      <div className="d-flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" ref={approveRef}
          disabled={!canDecide || decision !== null} onClick={() => setDecision('Approved')}>Approve</button>
        <button type="button" className="btn btn-outline-danger" ref={rejectRef}
          disabled={!canDecide || decision !== null} onClick={() => setDecision('Rejected')}>Reject</button>
      </div>
      {decision && (
        <div className="alert alert-warning mt-3 mb-0">
          <p className="fw-semibold" tabIndex={-1} ref={confirmationRef}>
            {decision === 'Approved' ? 'Approve' : 'Reject'} {requestLabel}?
          </p>
          <p className="small">This changes the demo request only.</p>
          {error && <p className="text-danger" role="alert">{error}</p>}
          <div className="d-flex flex-wrap gap-2">
            <button type="button" className={`btn ${decision === 'Approved' ? 'btn-primary' : 'btn-danger'}`}
              onClick={confirmDecision}>
              {decision === 'Approved' ? 'Confirm approval' : 'Confirm rejection'}
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={cancelDecision}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}

export default LeaveRequestDetails;
