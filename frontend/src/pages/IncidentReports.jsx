import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../api/config';

function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function initialFilters() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 90);
  return {
    from_date: localDate(from),
    to_date: localDate(today),
    employee_id: '',
    category_id: '',
    incident_status: '',
    action_status: '',
  };
}

async function fetchReport(filters, signal) {
  const params = new URLSearchParams(filters);
  const response = await fetch(`${API_BASE_URL}/api/incidents/reports?${params}`, {
    credentials: 'include',
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Could not generate the report.');
  return data;
}

// Spreadsheet applications may interpret user-entered text as formulas.
// Escape CSV quotes and prefix formula-like cells to keep exported data as text.
function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const incidentColumns = [
  ['incident_id', 'Incident ID'],
  ['incident_date', 'Incident Date'],
  ['full_name', 'Employee'],
  ['category_name', 'Category'],
  ['severity_level', 'Severity'],
  ['status', 'Status'],
  ['description', 'Description'],
  ['follow_up_date', 'Follow-up Date'],
  ['follow_up_notes', 'Manager Follow-up Notes'],
  ['closure_date', 'Closure Date'],
];

const actionColumns = [
  ['action_id', 'Action ID'],
  ['incident_id', 'Incident ID'],
  ['incident_date', 'Incident Date'],
  ['incident_employee', 'Incident Employee'],
  ['assigned_employee', 'Assigned Employee'],
  ['category_name', 'Category'],
  ['action_description', 'Corrective Action'],
  ['status', 'Action Status'],
  ['due_date', 'Due Date'],
  ['completed_date', 'Completed Date'],
  ['staff_completion_feedback', 'Staff Completion Feedback'],
  ['follow_up_details', 'Manager Verification'],
];

function exportCsv(filename, rows, columns) {
  const lines = [
    columns.map(([, label]) => csvCell(label)).join(','),
    ...rows.map((row) => columns.map(([key]) => csvCell(row[key])).join(',')),
  ];
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}\r\n`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function SummaryNumber({ title, value, note }) {
  return (
    <div className="col-6 col-lg-3">
      <div className="border rounded p-3 h-100">
        <p className="text-muted small mb-1">{title}</p>
        <div className="fs-3 fw-bold">{Number(value || 0)}</div>
        {note && <p className="small text-muted mb-0">{note}</p>}
      </div>
    </div>
  );
}

// The report is intentionally manager-only: this component mounts inside
// ManagerIncidentManagement; the backend independently enforces the same role.
function IncidentReports({ employees, categories }) {
  const [filters, setFilters] = useState(initialFilters);
  const [report, setReport] = useState(null);
  const [generatedAt, setGeneratedAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    fetchReport(initialFilters(), controller.signal)
      .then((data) => {
        setReport(data);
        setGeneratedAt(new Date().toLocaleString());
        setError('');
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, []);

  function change(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  async function generate(event) {
    event.preventDefault();
    if (!filters.from_date || !filters.to_date || filters.from_date > filters.to_date) {
      setError('Choose a valid date range. From date cannot be later than To date.');
      return;
    }
    setBusy(true);
    setError('');
    setReport(null);
    try {
      const data = await fetchReport(filters);
      setReport(data);
      setGeneratedAt(new Date().toLocaleString());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const summary = report?.incident_summary;
  const actionSummary = report?.action_summary;
  const noIncidentExport = !report || report.incidents_truncated || !report.incidents.length;
  const noActionExport = !report || report.actions_truncated || !report.actions.length;

  return (
    <section className="card border-0 shadow-sm my-4" aria-labelledby="incident-reports-title">
      <div className="card-body">
        <h4 id="incident-reports-title" className="mb-2">Incident &amp; Corrective Action Reports</h4>
        <p className="text-muted">
          Generate manager-only reports from saved MySQL records. All date filters use the
          incident date, including for corrective actions. Reports include historical closed incidents.
        </p>

        <form onSubmit={generate} className="row g-3 align-items-end mb-4">
          <div className="col-6 col-lg-2">
            <label className="form-label" htmlFor="report-from">From date</label>
            <input id="report-from" name="from_date" type="date" required className="form-control"
              value={filters.from_date} onChange={change} />
          </div>
          <div className="col-6 col-lg-2">
            <label className="form-label" htmlFor="report-to">To date</label>
            <input id="report-to" name="to_date" type="date" required className="form-control"
              value={filters.to_date} onChange={change} />
          </div>
          <div className="col-12 col-md-6 col-lg-2">
            <label className="form-label" htmlFor="report-employee">Incident employee</label>
            <select id="report-employee" name="employee_id" className="form-select"
              value={filters.employee_id} onChange={change}>
              <option value="">All employees</option>
              {employees.map((employee) => (
                <option key={employee.employee_id} value={employee.employee_id}>
                  {employee.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-6 col-lg-2">
            <label className="form-label" htmlFor="report-category">Incident category</label>
            <select id="report-category" name="category_id" className="form-select"
              value={filters.category_id} onChange={change}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.category_id} value={category.category_id}>
                  {category.category_name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-lg-2">
            <label className="form-label" htmlFor="report-incident-status">Incident status</label>
            <select id="report-incident-status" name="incident_status" className="form-select"
              value={filters.incident_status} onChange={change}>
              <option value="">All statuses</option>
              <option value="Open">Open</option>
              <option value="Under Investigation">Under Investigation</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
          <div className="col-6 col-lg-2">
            <label className="form-label" htmlFor="report-action-status">Action status</label>
            <select id="report-action-status" name="action_status" className="form-select"
              value={filters.action_status} onChange={change}>
              <option value="">All action statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div className="col-12">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Generating...' : 'Generate Report'}
            </button>
            <span className="text-muted small ms-3">
              Action status filters only the corrective-action figures and rows.
            </span>
          </div>
        </form>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {busy && <p className="text-muted" role="status">Loading reports from MySQL...</p>}

        {!busy && report && (
          <>
            <p className="small text-muted">
              Report period: <strong>{report.from_date} to {report.to_date}</strong> (inclusive).
              Generated: {generatedAt}. {report.basis}
            </p>
            <h5 className="mt-4">Incident Summary</h5>
            <div className="row g-3 mb-3">
              <SummaryNumber title="Total incidents" value={summary.total} />
              <SummaryNumber title="Open" value={summary.open_count} />
              <SummaryNumber title="Under Investigation" value={summary.investigating_count} />
              <SummaryNumber title="Closed" value={summary.closed_count} />
            </div>
            <h6>Incidents by category</h6>
            {report.categories.length ? (
              <div className="table-responsive mb-4">
                <table className="table table-sm table-bordered align-middle">
                  <thead><tr><th>Category</th><th>Severity</th><th>Incident count</th></tr></thead>
                  <tbody>{report.categories.map((item) => (
                    <tr key={item.category_id}>
                      <td>{item.category_name}</td>
                      <td>{item.severity_level}</td>
                      <td>{Number(item.incident_count)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="text-muted">No incidents match these filters.</p>}

            <h5 className="mt-4">Corrective Action Summary</h5>
            <div className="row g-3 mb-3">
              <SummaryNumber title="Total actions" value={actionSummary.total} />
              <SummaryNumber title="Pending" value={actionSummary.pending_count} />
              <SummaryNumber title="In Progress" value={actionSummary.in_progress_count} />
              <SummaryNumber title="Completed" value={actionSummary.completed_count} />
              <SummaryNumber title="Cancelled" value={actionSummary.cancelled_count} />
              <SummaryNumber title="Overdue" value={actionSummary.overdue_count}
                note="Past due and still Pending / In Progress" />
            </div>

            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4 mb-2">
              <h5 className="mb-0">Incident Records ({Number(summary.total)})</h5>
              <button type="button" className="btn btn-sm btn-outline-primary"
                disabled={noIncidentExport}
                onClick={() => exportCsv(`incident-report-${report.from_date}-to-${report.to_date}.csv`,
                  report.incidents, incidentColumns)}>
                Export Incident CSV
              </button>
            </div>
            {report.incidents_truncated && (
              <div className="alert alert-warning">
                More than {report.row_limit} incidents match. Narrow the date or filters to view/export
                a complete report. CSV export is disabled while records are truncated.
              </div>
            )}
            {report.incidents.length ? (
              <div className="table-responsive">
                <table className="table table-sm table-bordered align-middle">
                  <thead><tr>
                    <th>ID</th><th>Incident date</th><th>Employee</th><th>Category</th>
                    <th>Status</th><th>Description</th><th>Closure date</th>
                  </tr></thead>
                  <tbody>{report.incidents.map((item) => (
                    <tr key={item.incident_id}>
                      <td>#{item.incident_id}</td>
                      <td>{item.incident_date}</td>
                      <td>{item.full_name}</td>
                      <td>{item.category_name}</td>
                      <td>{item.status}</td>
                      <td>{item.description}</td>
                      <td>{item.closure_date || '—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="text-muted">No matching incident records.</p>}

            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4 mb-2">
              <h5 className="mb-0">Corrective Action Records ({Number(actionSummary.total)})</h5>
              <button type="button" className="btn btn-sm btn-outline-primary"
                disabled={noActionExport}
                onClick={() => exportCsv(`corrective-action-report-${report.from_date}-to-${report.to_date}.csv`,
                  report.actions, actionColumns)}>
                Export Corrective Action CSV
              </button>
            </div>
            {report.actions_truncated && (
              <div className="alert alert-warning">
                More than {report.row_limit} actions match. Narrow the date or filters to view/export
                all records. CSV export is disabled while records are truncated.
              </div>
            )}
            {report.actions.length ? (
              <div className="table-responsive">
                <table className="table table-sm table-bordered align-middle">
                  <thead><tr>
                    <th>Action ID</th><th>Incident ID</th><th>Assigned to</th>
                    <th>Action</th><th>Status</th><th>Due date</th><th>Completed</th>
                  </tr></thead>
                  <tbody>{report.actions.map((action) => (
                    <tr key={action.action_id}>
                      <td>#{action.action_id}</td>
                      <td>#{action.incident_id}</td>
                      <td>{action.assigned_employee}</td>
                      <td>{action.action_description}</td>
                      <td>{action.status}</td>
                      <td>{action.due_date}</td>
                      <td>{action.completed_date || '—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="text-muted">No matching corrective actions.</p>}
            <p className="small text-muted mt-3 mb-0">
              CSV files include follow-up and staff-feedback details where recorded.
              Reports contain employee information; share exports only with authorized managers.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

export default IncidentReports;
