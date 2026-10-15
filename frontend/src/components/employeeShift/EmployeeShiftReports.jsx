import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../api/config';

const API_URL = `${API_BASE_URL}/api`;

async function request(path, signal) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    signal,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Unable to load report data.');
  }

  if (!Array.isArray(data)) {
    throw new Error('Unexpected report data received.');
  }

  return data;
}

// Prepare safe CSV values for Excel
function csvCell(value) {
  let text = String(value ?? '').replace(/[\r\n\t]/g, ' ');

  if (/^\s*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, headers, rows) {
  const content = [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');

  const blob = new Blob(['\uFEFF', content], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getStatusClass(status) {
  if (status === 'Active' || status === 'Completed') {
    return 'text-bg-success';
  }

  if (status === 'Scheduled') {
    return 'text-bg-primary';
  }

  return 'text-bg-secondary';
}

export default function EmployeeShiftReports() {
  const [employees, setEmployees] = useState([]);
  const [rosters, setRosters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [reportType, setReportType] = useState('employees');

  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeRole, setEmployeeRole] = useState('All');
  const [employeeStatus, setEmployeeStatus] = useState('All');

  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterStatus, setRosterStatus] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadReports() {
      try {
        const [employeeData, rosterData] = await Promise.all([
          request('/employees', controller.signal),
          request('/roster', controller.signal),
        ]);

        if (!controller.signal.aborted) {
          setEmployees(employeeData);
          setRosters(rosterData);
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadReports();

    return () => controller.abort();
  }, []);

  const roles = [
    ...new Set(employees.map((employee) => employee.role_name)),
  ].filter(Boolean).sort();

  // Filter employees from the database results
  const filteredEmployees = employees.filter((employee) => {
    const search = employeeSearch.trim().toLowerCase();

    const matchesSearch =
      !search ||
      String(employee.full_name ?? '').toLowerCase().includes(search) ||
      String(employee.employee_id).includes(search);

    const matchesRole =
      employeeRole === 'All' ||
      employee.role_name === employeeRole;

    const matchesStatus =
      employeeStatus === 'All' ||
      employee.status === employeeStatus;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const invalidDateRange =
    Boolean(fromDate && toDate && fromDate > toDate);

  // Filter roster assignments from the database results
  const filteredRosters = invalidDateRange
    ? []
    : rosters.filter((roster) => {
        const search = rosterSearch.trim().toLowerCase();
        const date = String(roster.shift_date).slice(0, 10);

        const matchesSearch =
          !search ||
          String(roster.full_name ?? '').toLowerCase().includes(search) ||
          String(roster.shift_name ?? '').toLowerCase().includes(search);

        const matchesStatus =
          rosterStatus === 'All' ||
          roster.status === rosterStatus;

        const matchesDates =
          (!fromDate || date >= fromDate) &&
          (!toDate || date <= toDate);

        return matchesSearch && matchesStatus && matchesDates;
      });

  const employeeHeaders = [
    'Employee ID',
    'Employee Name',
    'Role',
    'Status',
  ];

  const rosterHeaders = [
    'Roster ID',
    'Employee Name',
    'Shift Name',
    'Start Time',
    'End Time',
    'Shift Date',
    'Status',
  ];

  const employeeRows = filteredEmployees.map((employee) => [
    employee.employee_id,
    employee.full_name,
    employee.role_name,
    employee.status,
  ]);

  const rosterRows = filteredRosters.map((roster) => [
    roster.roster_id,
    roster.full_name,
    roster.shift_name,
    String(roster.start_time ?? '').slice(0, 5),
    String(roster.end_time ?? '').slice(0, 5),
    String(roster.shift_date).slice(0, 10),
    roster.status,
  ]);

  const isEmployeeReport = reportType === 'employees';

  const headers = isEmployeeReport
    ? employeeHeaders
    : rosterHeaders;

  const rows = isEmployeeReport
    ? employeeRows
    : rosterRows;

  const totalRecords = isEmployeeReport
    ? employees.length
    : rosters.length;

  function clearFilters() {
    setEmployeeSearch('');
    setEmployeeRole('All');
    setEmployeeStatus('All');
    setRosterSearch('');
    setRosterStatus('All');
    setFromDate('');
    setToDate('');
  }

  function handleExport() {
    const filename = isEmployeeReport
      ? 'pharmashift_employee_report.csv'
      : 'pharmashift_roster_report.csv';

    downloadCsv(filename, headers, rows);
  }

  function handlePrint() {
  if (!isEmployeeReport && invalidDateRange) return;

  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    setError('Please allow pop-ups to print the report.');
    return;
  }

  const escapeHtml = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));

  const reportTitle = isEmployeeReport
    ? 'Employee Report'
    : 'Work Roster Report';

  const headerHtml = headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join('');

  const rowHtml = rows.length
    ? rows.map((row) =>
        `<tr>${row.map((value) =>
          `<td>${escapeHtml(value)}</td>`
        ).join('')}</tr>`
      ).join('')
    : `<tr><td colspan="${headers.length}">
         No records match your filters.
       </td></tr>`;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>PharmaShift - ${reportTitle}</title>
        <style>
          @page { size: A4 landscape; margin: 15mm; }

          body {
            font-family: Arial, sans-serif;
            color: #222;
            padding: 15px;
          }

          h1, h2 { text-align: center; }
          h1 { margin-bottom: 5px; }
          h2 { margin-top: 0; }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 12px;
          }

          th, td {
            border: 1px solid #888;
            padding: 8px;
            text-align: left;
          }

          th { background: #e8eef7; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; }

          @media print {
            #print-report { display: none; }
          }
        </style>
      </head>
      <body>
        <button id="print-report">Print / Save as PDF</button>
        <h1>PharmaShift</h1>
        <h2>${reportTitle}</h2>
        <p>Generated: ${escapeHtml(new Date().toLocaleString())}</p>
        <p>Total Records: ${rows.length}</p>
        <table>
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${rowHtml}</tbody>
        </table>
      </body>
    </html>
  `);

  printWindow.document.close();

  printWindow.document
    .getElementById('print-report')
    .addEventListener('click', () => printWindow.print());
}

  return (
    <section className="card border-0 shadow-sm">
      <div className="card-body">
        <h3 className="h5 mb-2">Employee & Shift Reports</h3>

        <p className="text-muted">
          View employee and shift records and export reports.
        </p>

        {loading && (
          <p role="status">Loading reports...</p>
        )}

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="mb-4">
              <label htmlFor="report-type" className="form-label">
                Report Type
              </label>

              <select
                id="report-type"
                className="form-select"
                value={reportType}
                onChange={(event) => {
                  setReportType(event.target.value);
                  clearFilters();
                }}
              >
                <option value="employees">Employee Report</option>
                <option value="roster">Work Roster Report</option>
              </select>
            </div>

            {isEmployeeReport ? (
              <div className="row g-3 mb-3">
                <div className="col-md-5">
                  <label htmlFor="employee-report-search" className="form-label">
                    Search Employees
                  </label>

                  <input
                    id="employee-report-search"
                    type="search"
                    className="form-control"
                    placeholder="Employee name or ID"
                    value={employeeSearch}
                    onChange={(event) =>
                      setEmployeeSearch(event.target.value)
                    }
                  />
                </div>

                <div className="col-md-4">
                  <label htmlFor="employee-report-role" className="form-label">
                    Role
                  </label>

                  <select
                    id="employee-report-role"
                    className="form-select"
                    value={employeeRole}
                    onChange={(event) =>
                      setEmployeeRole(event.target.value)
                    }
                  >
                    <option value="All">All Roles</option>
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-3">
                  <label htmlFor="employee-report-status" className="form-label">
                    Status
                  </label>

                  <select
                    id="employee-report-status"
                    className="form-select"
                    value={employeeStatus}
                    onChange={(event) =>
                      setEmployeeStatus(event.target.value)
                    }
                  >
                    <option value="All">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <label htmlFor="roster-report-search" className="form-label">
                    Search Employee or Shift
                  </label>

                  <input
                    id="roster-report-search"
                    type="search"
                    className="form-control"
                    value={rosterSearch}
                    onChange={(event) =>
                      setRosterSearch(event.target.value)
                    }
                  />
                </div>

                <div className="col-md-3">
                  <label htmlFor="roster-report-from" className="form-label">
                    From Date
                  </label>

                  <input
                    id="roster-report-from"
                    type="date"
                    className="form-control"
                    value={fromDate}
                    onChange={(event) =>
                      setFromDate(event.target.value)
                    }
                  />
                </div>

                <div className="col-md-3">
                  <label htmlFor="roster-report-to" className="form-label">
                    To Date
                  </label>

                  <input
                    id="roster-report-to"
                    type="date"
                    className="form-control"
                    value={toDate}
                    onChange={(event) =>
                      setToDate(event.target.value)
                    }
                  />
                </div>

                <div className="col-md-2">
                  <label htmlFor="roster-report-status" className="form-label">
                    Status
                  </label>

                  <select
                    id="roster-report-status"
                    className="form-select"
                    value={rosterStatus}
                    onChange={(event) =>
                      setRosterStatus(event.target.value)
                    }
                  >
                    <option value="All">All Statuses</option>
                    <option value="Scheduled">Scheduled</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            )}

            {invalidDateRange && !isEmployeeReport && (
              <div className="alert alert-danger" role="alert">
                To Date cannot be earlier than From Date.
              </div>
            )}

            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
              <p className="text-muted mb-0">
                Showing {rows.length} of {totalRecords} records
              </p>

              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={clearFilters}
                >
                  Clear Filters
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleExport}
                  disabled={rows.length === 0 || invalidDateRange}
                >
                  Download CSV
                </button>
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={handlePrint}
                  disabled={loading || (!isEmployeeReport && invalidDateRange)}
                >
                  Print / Save as PDF
                </button>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead>
                  <tr>
                    {headers.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => (
                    <tr key={row[0]}>
                      {row.map((value, index) => (
                        <td key={index}>
                          {index === row.length - 1 ? (
                            <span
                              className={`badge ${getStatusClass(value)}`}
                            >
                              {value}
                            </span>
                          ) : (
                            value
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={headers.length}
                        className="text-center text-muted py-4"
                      >
                        No records match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}