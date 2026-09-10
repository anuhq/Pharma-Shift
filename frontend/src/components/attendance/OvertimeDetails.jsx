import { useEffect, useRef } from 'react';

const statusClasses = {
  Pending: 'text-bg-warning', Approved: 'text-bg-success', Rejected: 'text-bg-danger',
};

function OvertimeDetails({ record, onEdit, onClose }) {
  const headingRef = useRef(null);

  // Focus the details panel when it opens.
  useEffect(() => { headingRef.current?.focus(); }, []);

  return (
    <section className="border rounded p-3" aria-labelledby="overtime-details-title">
      <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
        <h4 id="overtime-details-title" className="h5 mb-0" tabIndex={-1} ref={headingRef}>Overtime details</h4>
        <button type="button" className="btn-close" aria-label="Close overtime details" onClick={onClose} />
      </div>
      <dl>
        <dt>Record ID</dt><dd>OT-{String(record.overtime_id).padStart(4, '0')}</dd>
        <dt>Employee</dt><dd>{record.full_name} ({record.employee_id})</dd>
        <dt>Overtime date</dt><dd>{record.overtime_date}</dd>
        <dt>Hours worked</dt><dd>{Number(record.hours_worked).toFixed(2)}</dd>
        <dt>Status</dt><dd><span className={`badge ${statusClasses[record.status]}`}>{record.status}</span></dd>
      </dl>
      <button type="button" className="btn btn-outline-primary"
        onClick={(event) => onEdit(record, event.currentTarget)}>Edit record</button>
    </section>
  );
}

export default OvertimeDetails;
