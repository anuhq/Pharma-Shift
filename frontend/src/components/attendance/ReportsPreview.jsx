import { useState } from 'react';

const reportTypes = [
  {
    id: 'attendance',
    label: 'Attendance summary',
    description: 'Check-ins, check-outs and attendance status by date.',
  },
  {
    id: 'leave',
    label: 'Leave summary',
    description: 'Leave requests grouped by type and approval status.',
  },
  {
    id: 'overtime',
    label: 'Overtime summary',
    description: 'Overtime hours grouped by employee and date.',
  },
];

function ReportsPreview() {
  const [reportType, setReportType] = useState('attendance');
  const [fromDate, setFromDate] = useState('2026-09-01');
  const [toDate, setToDate] = useState('2026-09-09');
  const selectedReport = reportTypes.find((report) => report.id === reportType);
  const invalidRange = fromDate && toDate && toDate < fromDate;

  // Report generation will be connected later.
  function handleSubmit(event) {
    event.preventDefault();
  }

  return (
    <div className="mt-4">

      <div className="alert alert-secondary" role="status">
        No report generation currently.
      </div>

      <form onSubmit={handleSubmit} noValidate className="border rounded p-3 mb-4 bg-light">
        <h4 className="h5">Report options</h4>
        <div className="row g-3 align-items-end">
          <div className="col-12 col-lg-4">
            <label htmlFor="report-type" className="form-label">Report type</label>
            <select id="report-type" className="form-select" value={reportType}
              onChange={(event) => setReportType(event.target.value)}>
              {reportTypes.map((report) => <option key={report.id} value={report.id}>{report.label}</option>)}
            </select>
          </div>
          <div className="col-12 col-md-6 col-lg-3">
            <label htmlFor="report-from" className="form-label">From date</label>
            <input id="report-from" type="date" className="form-control" value={fromDate}
              onChange={(event) => setFromDate(event.target.value)} />
          </div>
          <div className="col-12 col-md-6 col-lg-3">
            <label htmlFor="report-to" className="form-label">To date</label>
            <input id="report-to" type="date" className={`form-control${invalidRange ? ' is-invalid' : ''}`}
              value={toDate} onChange={(event) => setToDate(event.target.value)}
              aria-invalid={Boolean(invalidRange)} aria-describedby={invalidRange ? 'report-range-error' : undefined} />
            {invalidRange && <div id="report-range-error" className="invalid-feedback">To date cannot be before From date.</div>}
          </div>
          <div className="col-12 col-lg-2">
            <button type="submit" className="btn btn-primary w-100" disabled>Generate report</button>
          </div>
        </div>
      </form>

      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h4 className="h5 mb-1">{selectedReport.label}</h4>
          <p className="small mb-0">{selectedReport.description}</p>
        </div>
        <button type="button" className="btn btn-outline-secondary" disabled>Download CSV</button>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <div className="card h-100 border-0 bg-primary-subtle">
            <div className="card-body"><p className="small mb-1">Records in range</p><p className="h3 mb-0">—</p></div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card h-100 border-0 bg-success-subtle">
            <div className="card-body"><p className="small mb-1">Completed</p><p className="h3 mb-0">—</p></div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card h-100 border-0 bg-warning-subtle">
            <div className="card-body"><p className="small mb-1">Pending review</p><p className="h3 mb-0">—</p></div>
          </div>
        </div>
      </div>

      <div className="border rounded p-4 text-center text-secondary">
        <h5 className="h6">No report generated</h5>
      </div>
    </div>
  );
}

export default ReportsPreview;
