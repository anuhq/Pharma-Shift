
import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { generateReport } from '../../api/reportsApi';

const reportTypes = [
  {
    id: 'attendance',
    label: 'Attendance summary',
    description: 'Employee attendance and assigned shifts by date.',
  },
  {
    id: 'leave',
    label: 'Leave summary',
    description: 'Employee leave requests, leave types and approval decisions.',
  },
  {
    id: 'overtime',
    label: 'Overtime summary',
    description: 'Employee overtime records and approved overtime hours.',
  },
];

const statusClasses = {
  Present: 'text-bg-success',
  'Checked In': 'text-bg-primary',
  Late: 'text-bg-warning',
  Pending: 'text-bg-warning',
  Approved: 'text-bg-success',
  Rejected: 'text-bg-danger',
};

const reportColumns = {
  attendance: [
    { key: 'full_name', label: 'Employee' },
    { key: 'employee_id', label: 'Employee ID' },
    { key: 'attendance_date', label: 'Date' },
    { key: 'check_in_time', label: 'Check-in' },
    { key: 'check_out_time', label: 'Check-out' },
    { key: 'status', label: 'Status' },
    { key: 'shift_display', label: 'Assigned shift' },
    { key: 'scheduled_hours', label: 'Scheduled hours' },
    { key: 'arrival_review', label: 'Arrival review' },
    { key: 'departure_review', label: 'Departure review' },
    { key: 'correction_note', label: 'Correction note' },
  ],
  leave: [
    { key: 'full_name', label: 'Employee' },
    { key: 'employee_id', label: 'Employee ID' },
    { key: 'leave_type', label: 'Leave type' },
    { key: 'start_date', label: 'Start date' },
    { key: 'end_date', label: 'End date' },
    { key: 'reason', label: 'Reason' },
    { key: 'status', label: 'Status' },
    { key: 'reviewed_by_name', label: 'Reviewed by' },
    { key: 'reviewed_at', label: 'Reviewed at' },
    { key: 'review_note', label: 'Review note' },
  ],
  overtime: [
    { key: 'full_name', label: 'Employee' },
    { key: 'employee_id', label: 'Employee ID' },
    { key: 'overtime_date', label: 'Overtime date' },
    { key: 'hours_worked', label: 'Hours worked' },
    { key: 'status', label: 'Status' },
  ],
};

function getSummaryCards(type, summary) {
  if (type === 'attendance') {
    return [
      {
        label: 'Records in range',
        value: summary.totalRecords ?? 0,
        style: 'bg-primary-subtle',
      },
      {
        label: 'Completed check-outs',
        value: summary.completedRecords ?? 0,
        style: 'bg-success-subtle',
      },
      {
        label: 'Not checked out',
        value: summary.notCheckedOutRecords ?? 0,
        style: 'bg-warning-subtle',
      },
      {
        label: 'After shift start',
        value: summary.afterShiftStartRecords ?? 0,
        style: 'bg-light',
      },
    ];
  }

  if (type === 'leave') {
    return [
      {
        label: 'Total requests',
        value: summary.totalRequests ?? 0,
        style: 'bg-primary-subtle',
      },
      {
        label: 'Approved',
        value: summary.approvedRequests ?? 0,
        style: 'bg-success-subtle',
      },
      {
        label: 'Pending review',
        value: summary.pendingRequests ?? 0,
        style: 'bg-warning-subtle',
      },
      {
        label: 'Rejected',
        value: summary.rejectedRequests ?? 0,
        style: 'bg-danger-subtle',
      },
    ];
  }

  if (type === 'overtime') {
    return [
      {
        label: 'Overtime records',
        value: summary.totalRecords ?? 0,
        style: 'bg-primary-subtle',
      },
      {
        label: 'Approved records',
        value: summary.approvedRecords ?? 0,
        style: 'bg-success-subtle',
      },
      {
        label: 'Approved hours',
        value: Number(
          summary.totalApprovedHours ?? 0
        ).toFixed(2),
        style: 'bg-light',
      },
    ];
  }

  return [];
}

function isValidScheduledShift(record) {
  return Boolean(
    record.roster_id &&
    record.shift_status === 'Active' &&
    record.scheduled_start_time &&
    record.scheduled_end_time &&
    record.scheduled_start_time < record.scheduled_end_time
  );
}

function formatMinutes(value) {
  const minutes = Number(value);
  return Number.isFinite(minutes)
    ? minutes.toFixed(1)
    : null;
}

function formatCellValue(record, key, forCsv = false) {
  if (key === 'shift_display') {
    if (!record.roster_id) return 'No matching roster';

    return `${record.shift_name || 'Unknown shift'} (${
      record.roster_status || 'Unknown'
    })`;
  }

  if (key === 'scheduled_hours') {
    if (!record.roster_id) return 'No matching roster';
    if (!isValidScheduledShift(record)) {
      return 'Shift needs review';
    }

    return `${String(
      record.scheduled_start_time
    ).slice(0, 5)} - ${String(
      record.scheduled_end_time
    ).slice(0, 5)}`;
  }

  if (key === 'arrival_review') {
    if (!record.roster_id) return 'No roster to compare';
    if (!isValidScheduledShift(record)) {
      return 'Shift needs review';
    }
    if (record.minutes_after_start == null) {
      return 'Not available';
    }

    const minutes = formatMinutes(
      record.minutes_after_start
    );

    if (minutes === null) return 'Not available';

    return Number(minutes) > 0
      ? `${minutes} min after start`
      : 'On time or early';
  }

  if (key === 'departure_review') {
    if (record.checkout_review === 'Missing check-out') {
      return 'Missing check-out';
    }

    if (record.checkout_review === 'Still checked in') {
      return 'Still checked in';
    }

    if (!record.roster_id) return 'No roster to compare';
    if (!isValidScheduledShift(record)) {
      return 'Shift needs review';
    }
    if (record.minutes_before_end == null) {
      return 'Not available';
    }

    const minutes = formatMinutes(
      record.minutes_before_end
    );

    if (minutes === null) return 'Not available';

    return Number(minutes) > 0
      ? `${minutes} min before shift end`
      : 'At or after shift end';
  }

  const value = record[key];

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    if (forCsv) return '';
    if (key === 'check_out_time') {
      return 'Not checked out';
    }

    if (
      key === 'reviewed_by_name' ||
      key === 'reviewed_at'
    ) {
      return 'Not reviewed';
    }

    return '-';
  }

  if (key === 'hours_worked') {
    return Number(value).toFixed(2);
  }

  if (
    key === 'check_in_time' ||
    key === 'check_out_time'
  ) {
    return String(value).slice(0, 5);
  }

  return String(value);
}

function reportRecordLabel(type, record) {
  if (type === 'attendance') {
    return `AT-${record.attendance_id}`;
  }

  if (type === 'leave') {
    return `LR-${String(
      record.leave_request_id
    ).padStart(4, '0')}`;
  }

  return `OT-${String(
    record.overtime_id
  ).padStart(4, '0')}`;
}

function escapeCsvCell(value) {
  let text = String(value ?? '');

  if (/^\s*[=+@-]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function buildReportCsv(data) {
  const columns = reportColumns[data.reportType] || [];

  const header = [
    'Record ID',
    ...columns.map((column) => column.label),
  ];

  const rows = data.records.map((record) => [
    reportRecordLabel(data.reportType, record),
    ...columns.map((column) =>
      formatCellValue(record, column.key, true)
    ),
  ]);

  return [header, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n');
}

function escapeHtml(value) {
  const replacements = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) => replacements[character]
  );
}

function buildPrintableHtml(data) {
  const type = data.reportType;

  const selectedType = reportTypes.find(
    (item) => item.id === type
  );

  const columns = reportColumns[type] || [];
  const cards = getSummaryCards(type, data.summary);

  const summaryHtml = cards.map((card) => `
    <div class="summary-card">
      <div class="summary-label">${escapeHtml(card.label)}</div>
      <div class="summary-value">${escapeHtml(card.value)}</div>
    </div>
  `).join('');

  const headings = [
    'Record ID',
    ...columns.map((column) => column.label),
  ]
    .map((label) => `<th>${escapeHtml(label)}</th>`)
    .join('');

  const rows = data.records.length
    ? data.records.map((record) => `
        <tr>
          <td>${escapeHtml(reportRecordLabel(type, record))}</td>
          ${columns.map((column) => `
            <td>${escapeHtml(formatCellValue(record, column.key))}</td>
          `).join('')}
        </tr>
      `).join('')
    : `<tr><td colspan="${columns.length + 1}">No records found for the selected date range.</td></tr>`;

  let breakdown = '';

  if (
    type === 'leave' &&
    data.summary.byLeaveType?.length > 0
  ) {
    breakdown = `
      <h2>Leave requests by type</h2>
      <table>
        <thead>
          <tr>
            <th>Leave type</th>
            <th>Requests</th>
          </tr>
        </thead>
        <tbody>
          ${data.summary.byLeaveType.map((item) => `
            <tr>
              <td>${escapeHtml(item.leaveType)}</td>
              <td>${escapeHtml(item.count)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  if (
    type === 'overtime' &&
    data.summary.byEmployee?.length > 0
  ) {
    breakdown = `
      <h2>Approved overtime by employee</h2>
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Employee ID</th>
            <th>Approved hours</th>
          </tr>
        </thead>
        <tbody>
          ${data.summary.byEmployee.map((item) => `
            <tr>
              <td>${escapeHtml(item.fullName)}</td>
              <td>${escapeHtml(item.employeeId)}</td>
              <td>${escapeHtml(
                Number(item.approvedHours).toFixed(2)
              )}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>PharmaShift - ${escapeHtml(selectedType.label)}</title>
<style>
  @page {
    size: A4 landscape;
    margin: 12mm;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    color: #263445;
    line-height: 1.5;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .report-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-bottom: 14px;
    margin-bottom: 18px;
    border-bottom: 3px solid #17365d;
  }

  .report-logo {
    width: 64px;
    height: 64px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .report-brand {
    font-size: 13px;
    font-weight: bold;
    color: #17365d;
    margin: 0 0 3px;
  }

  h1 {
    margin: 0 0 4px;
    font-size: 20px;
    color: #17365d;
  }

  h2 {
    margin: 20px 0 9px;
    font-size: 14px;
    color: #17365d;
  }

  p {
    margin: 4px 0;
  }

  .report-description {
    color: #526477;
  }

  .report-period {
    margin-top: 7px;
    color: #263445;
  }

  .summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin: 18px 0;
  }

  .summary-card {
    background: #eef4fc;
    border: 1px solid #cbdced;
    border-left: 4px solid #2563a6;
    padding: 12px;
    border-radius: 5px;
    break-inside: avoid;
  }

  .summary-label {
    font-size: 11px;
    color: #526477;
  }

  .summary-value {
    font-size: 19px;
    font-weight: bold;
    color: #17365d;
    margin-top: 4px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8px;
  }

  th,
  td {
    border: 1px solid #d3dfec;
    padding: 6px;
    text-align: left;
    vertical-align: top;
    overflow-wrap: anywhere;
  }

  th {
    background: #e4edf8;
    color: #17365d;
    font-weight: bold;
  }

  tbody tr:nth-child(even) {
    background: #f7faff;
  }

  thead {
    display: table-header-group;
  }

  tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }
</style>
</head>
<body>
  <header class="report-header">
    <img
      src="${window.location.origin}/digana-pharmacy-logo.jpeg"
      alt="Digana Pharmacy logo"
      class="report-logo"
      width="64"
      height="64"
    />

    <div>
      <p class="report-brand">Digana Pharmacy</p>

      <h1>
        PharmaShift - ${escapeHtml(selectedType.label)}
      </h1>

      <p class="report-description">
        ${escapeHtml(selectedType.description)}
      </p>

      <p class="report-period">
        <strong>Report period:</strong>
        ${escapeHtml(data.fromDate)} to ${escapeHtml(data.toDate)}
      </p>
    </div>
  </header>

  <div class="summary">
    ${summaryHtml}
  </div>

  <h2>Report records</h2>

  <p>${data.records.length} record(s) found for this date range.</p>

  <table>
    <thead>
      <tr>${headings}</tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  ${breakdown}
</body>
</html>`;
}

function Reports() {
  const { user } = useAuth();
  const isManager = user?.roleName === 'Owner/Manager';

  const [reportType, setReportType] = useState('attendance');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reportData, setReportData] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const selectedReport = reportTypes.find(
    (item) => item.id === reportType
  );

  const invalidRange = Boolean(
    fromDate && toDate && toDate < fromDate
  );

  const missingDates = !fromDate || !toDate;

  function changeOption(setValue, value) {
    setValue(value);
    setReportData(null);
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (
      !isManager ||
      generating ||
      invalidRange ||
      missingDates
    ) {
      return;
    }

    setGenerating(true);
    setError('');
    setReportData(null);

    try {
      const data = await generateReport(
        reportType,
        fromDate,
        toDate
      );

      if (
        !Array.isArray(data.records) ||
        !data.summary ||
        data.reportType !== reportType
      ) {
        throw new Error(
          'The report response is incomplete. Please try again.'
        );
      }

      setReportData(data);
    } catch (requestError) {
      setError(
        requestError.message || 'Unable to generate report.'
      );
    } finally {
      setGenerating(false);
    }
  }

  function handleDownloadCsv() {
    if (
      !isManager ||
      !reportData ||
      generating ||
      reportData.records.length === 0
    ) {
      return;
    }

    try {
      setError('');

      const blob = new Blob(
        ['\uFEFF', buildReportCsv(reportData)],
        { type: 'text/csv;charset=utf-8;' }
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download =
        `pharmashift_${reportData.reportType}_` +
        `${reportData.fromDate}_to_${reportData.toDate}.csv`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      setError(
        downloadError.message ||
        'Unable to download CSV report.'
      );
    }
  }

  function handlePrintReport() {
    if (!isManager || !reportData || generating) {
      return;
    }

    setError('');

    const printWindow = window.open(
      '',
      '_blank',
      'width=1100,height=800'
    );

    if (!printWindow) {
      setError(
        'Your browser blocked the print window. Allow pop-ups for PharmaShift and try again.'
      );
      return;
    }

    try {
      printWindow.document.open();
      printWindow.document.write(
        buildPrintableHtml(reportData)
      );
      printWindow.document.close();
      printWindow.opener = null;

      const logo = printWindow.document.querySelector(
        '.report-logo'
      );

      if (!logo) {
        throw new Error(
          'Pharmacy logo not found in the report.'
        );
      }

      logo.decode()
        .then(() => {
          if (!printWindow.closed) {
            printWindow.focus();
            printWindow.print();
          }
        })
        .catch(() => {
          setError(
            'The pharmacy logo could not load. Please try printing again.'
          );

          if (!printWindow.closed) {
            printWindow.close();
          }
        });
    } catch (printError) {
      setError(
        'Unable to prepare the printable report. Please try again.'
      );

      printWindow.close();
    }
  }

  if (!isManager) {
    return (
      <div className="mt-4">
        <div
          className="alert alert-warning"
          role="alert"
        >
          Reports are available only to the Owner/Manager.
        </div>
      </div>
    );
  }

  const summaryCards = reportData
    ? getSummaryCards(
        reportData.reportType,
        reportData.summary
      )
    : [];

  const columns = reportData
    ? reportColumns[reportData.reportType] || []
    : [];

  return (
    <div className="mt-4">
      <form
        onSubmit={handleSubmit}
        noValidate
        className="border rounded p-3 mb-4 bg-light"
      >
        <h4 className="h5 mb-3">
          Report options
        </h4>

        <div className="row g-3 align-items-end">
          <div className="col-12 col-lg-4">
            <label
              htmlFor="report-type"
              className="form-label"
            >
              Report type
            </label>

            <select
              id="report-type"
              className="form-select"
              value={reportType}
              disabled={generating}
              onChange={(event) =>
                changeOption(
                  setReportType,
                  event.target.value
                )
              }
            >
              {reportTypes.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-6 col-lg-3">
            <label
              htmlFor="report-from"
              className="form-label"
            >
              From date
            </label>

            <input
              id="report-from"
              type="date"
              className="form-control"
              value={fromDate}
              disabled={generating}
              onChange={(event) =>
                changeOption(
                  setFromDate,
                  event.target.value
                )
              }
            />
          </div>

          <div className="col-12 col-md-6 col-lg-3">
            <label
              htmlFor="report-to"
              className="form-label"
            >
              To date
            </label>

            <input
              id="report-to"
              type="date"
              className={`form-control${
                invalidRange ? ' is-invalid' : ''
              }`}
              value={toDate}
              disabled={generating}
              onChange={(event) =>
                changeOption(
                  setToDate,
                  event.target.value
                )
              }
              aria-invalid={invalidRange}
              aria-describedby={
                invalidRange
                  ? 'report-range-error'
                  : undefined
              }
            />
          </div>

          <div className="col-12 col-lg-2">
            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={
                generating ||
                invalidRange ||
                missingDates
              }
            >
              {generating
                ? 'Generating...'
                : 'Generate report'}
            </button>
          </div>
        </div>

        {/* Keep the error outside the input row. */}
        {invalidRange && (
          <div className="row mt-1">
            <div className="col-12 col-lg-3 offset-lg-7">
              <div
                id="report-range-error"
                className="text-danger small"
                role="alert"
              >
                To date cannot be before From date.
              </div>
            </div>
          </div>
        )}
      </form>

      {error && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h4 className="h5 mb-1">
            {selectedReport.label}
          </h4>

          <p className="small text-secondary mb-0">
            {selectedReport.description}
          </p>
        </div>

        <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline-success"
            onClick={handleDownloadCsv}
            disabled={
              !reportData ||
              generating ||
              reportData.records.length === 0
            }
          >
            Download CSV
          </button>

          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={handlePrintReport}
            disabled={!reportData || generating}
          >
            Print Report
          </button>
        </div>
      </div>

      {generating && (
        <p role="status">
          Generating report...
        </p>
      )}

      {!generating && !reportData && !error && (
        <div className="border rounded p-4 text-center text-secondary">
          <h5 className="h6">
            No report generated
          </h5>

          <p className="mb-0">
            Select a report type and date range,
            then click Generate report.
          </p>
        </div>
      )}

      {reportData && (
        <section>
          <p className="small text-secondary mb-3">
            Report period: {reportData.fromDate} to{' '}
            {reportData.toDate}
          </p>

          <div className="row g-3 mb-4">
            {summaryCards.map((card) => (
              <div
                className="col-12 col-sm-6 col-xl-3"
                key={card.label}
              >
                <div
                  className={`card h-100 border-0 ${card.style}`}
                >
                  <div className="card-body">
                    <p className="small mb-1">
                      {card.label}
                    </p>

                    <p className="h3 mb-0">
                      {card.value}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h5 className="h6">
            Report records
          </h5>

          <p className="small text-secondary mb-2">
            {reportData.records.length} record(s)
            found for this date range.
          </p>

          <div className="table-responsive mb-4">
            <table className="table table-hover align-middle small">
              <thead className="table-light">
                <tr>
                  <th scope="col">
                    Record ID
                  </th>

                  {columns.map((column) => (
                    <th
                      scope="col"
                      key={column.key}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {reportData.records.map((record) => (
                  <tr
                    key={reportRecordLabel(
                      reportData.reportType,
                      record
                    )}
                  >
                    <td className="text-nowrap">
                      {reportRecordLabel(
                        reportData.reportType,
                        record
                      )}
                    </td>

                    {columns.map((column) => (
                      <td key={column.key}>
                        {column.key === 'status' ? (
                          <span
                            className={`badge ${
                              statusClasses[record.status] ||
                              'text-bg-secondary'
                            }`}
                          >
                            {record.status}
                          </span>
                        ) : (
                          formatCellValue(
                            record,
                            column.key
                          )
                        )}
                      </td>
                    ))}
                  </tr>
                ))}

                {reportData.records.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length + 1}
                      className="text-center text-secondary py-4"
                    >
                      No records found for the selected date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {reportData.reportType === 'leave' &&
            reportData.summary.byLeaveType?.length > 0 && (
              <div className="mb-4">
                <h5 className="h6 mb-3">
                  Leave requests by type
                </h5>

                <div className="table-responsive">
                  <table className="table table-sm table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th scope="col">
                          Leave type
                        </th>
                        <th scope="col">
                          Requests
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {reportData.summary.byLeaveType.map(
                        (item) => (
                          <tr key={item.leaveType}>
                            <td>
                              {item.leaveType}
                            </td>
                            <td>
                              {item.count}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          {reportData.reportType === 'overtime' &&
            reportData.summary.byEmployee?.length > 0 && (
              <div className="mb-4">
                <h5 className="h6 mb-3">
                  Approved overtime by employee
                </h5>

                <div className="table-responsive">
                  <table className="table table-sm table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th scope="col">
                          Employee
                        </th>
                        <th scope="col">
                          Employee ID
                        </th>
                        <th scope="col">
                          Approved hours
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {reportData.summary.byEmployee.map(
                        (item) => (
                          <tr key={item.employeeId}>
                            <td>
                              {item.fullName}
                            </td>
                            <td>
                              {item.employeeId}
                            </td>
                            <td>
                              {Number(
                                item.approvedHours
                              ).toFixed(2)}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
        </section>
      )}
    </div>
  );
}

export default Reports;
