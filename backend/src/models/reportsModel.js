
const pool = require('../config/db');

// ATTENDANCE REPORT - Include the matching roster for each attendance day.
// Roster comparisons do not change recorded attendance statuses.
async function getAttendanceReport(fromDate, toDate) {
  const [records] = await pool.execute(
    `SELECT
       a.attendance_id,
       a.employee_id,
       e.full_name,
       DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendance_date,
       a.check_in_time,
       a.check_out_time,
       a.status,
       a.correction_note,
       sr.roster_id,
       sr.status AS roster_status,
       st.shift_name,
       st.status AS shift_status,
       st.start_time AS scheduled_start_time,
       st.end_time AS scheduled_end_time,
       CASE
         WHEN sr.roster_id IS NULL
           OR st.shift_type_id IS NULL
           OR st.status <> 'Active'
           OR st.start_time >= st.end_time
         THEN NULL
         ELSE GREATEST(0, ROUND(
           TIME_TO_SEC(TIMEDIFF(a.check_in_time, st.start_time)) / 60, 1
         ))
       END AS minutes_after_start,
       CASE
         WHEN sr.roster_id IS NULL
           OR st.shift_type_id IS NULL
           OR st.status <> 'Active'
           OR st.start_time >= st.end_time
           OR a.check_out_time IS NULL
         THEN NULL
         ELSE GREATEST(0, ROUND(
           TIME_TO_SEC(TIMEDIFF(st.end_time, a.check_out_time)) / 60, 1
         ))
       END AS minutes_before_end,
       CASE
         WHEN a.check_out_time IS NULL AND a.attendance_date < CURDATE()
         THEN 'Missing check-out'
         WHEN a.check_out_time IS NULL
         THEN 'Still checked in'
         ELSE NULL
       END AS checkout_review
     FROM attendance AS a
     JOIN employee AS e ON e.employee_id = a.employee_id
     LEFT JOIN shift_roster AS sr ON sr.roster_id = (
       SELECT sr2.roster_id
       FROM shift_roster AS sr2
       WHERE sr2.employee_id = a.employee_id
         AND sr2.shift_date = a.attendance_date
         AND sr2.status IN ('Assigned', 'Scheduled')
       ORDER BY
         CASE WHEN sr2.status = 'Assigned' THEN 0 ELSE 1 END,
         sr2.roster_id DESC
       LIMIT 1
     )
     LEFT JOIN shift_type AS st ON st.shift_type_id = sr.shift_type_id
     WHERE a.attendance_date BETWEEN ? AND ?
     ORDER BY a.attendance_date DESC,
              e.full_name ASC,
              a.attendance_id DESC`,
    [fromDate, toDate]
  );

  const summary = {
    totalRecords: records.length,
    completedRecords: records.filter(
      (record) => record.check_out_time !== null
    ).length,
    notCheckedOutRecords: records.filter(
      (record) => record.check_out_time === null
    ).length,
    lateRecords: records.filter(
      (record) => record.status === 'Late'
    ).length,
    afterShiftStartRecords: records.filter(
      (record) =>
        record.minutes_after_start !== null &&
        Number(record.minutes_after_start) > 0
    ).length,
  };

  return { records, summary };
}

// LEAVE REPORT - Include requests overlapping the selected date range.
async function getLeaveReport(fromDate, toDate) {
  const [records] = await pool.execute(
    `SELECT
       lr.leave_request_id,
       lr.employee_id,
       e.full_name,
       lr.leave_type,
       DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS start_date,
       DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS end_date,
       lr.reason,
       lr.status,
       DATE_FORMAT(lr.reviewed_at, '%Y-%m-%d %H:%i:%s') AS reviewed_at,
       lr.review_note,
       reviewer.full_name AS reviewed_by_name
     FROM leave_request AS lr
     JOIN employee AS e ON e.employee_id = lr.employee_id
     LEFT JOIN employee AS reviewer
       ON reviewer.employee_id = lr.reviewed_by_employee_id
     WHERE lr.start_date <= ? AND lr.end_date >= ?
     ORDER BY lr.start_date DESC, lr.leave_request_id DESC`,
    [toDate, fromDate]
  );

  const leaveTypeCounts = {};

  for (const record of records) {
    leaveTypeCounts[record.leave_type] =
      (leaveTypeCounts[record.leave_type] || 0) + 1;
  }

  const summary = {
    totalRequests: records.length,
    pendingRequests: records.filter(
      (record) => record.status === 'Pending'
    ).length,
    approvedRequests: records.filter(
      (record) => record.status === 'Approved'
    ).length,
    rejectedRequests: records.filter(
      (record) => record.status === 'Rejected'
    ).length,
    byLeaveType: Object.entries(leaveTypeCounts).map(
      ([leaveType, count]) => ({
        leaveType,
        count,
      })
    ),
  };

  return { records, summary };
}

// OVERTIME REPORT - Total approved hours by employee.
async function getOvertimeReport(fromDate, toDate) {
  const [records] = await pool.execute(
    `SELECT
       ot.overtime_id,
       ot.employee_id,
       e.full_name,
       DATE_FORMAT(ot.overtime_date, '%Y-%m-%d') AS overtime_date,
       ot.hours_worked,
       ot.status
     FROM overtime AS ot
     JOIN employee AS e ON e.employee_id = ot.employee_id
     WHERE ot.overtime_date BETWEEN ? AND ?
     ORDER BY ot.overtime_date DESC,
              e.full_name ASC,
              ot.overtime_id DESC`,
    [fromDate, toDate]
  );

  const employeeTotals = new Map();
  let totalApprovedHours = 0;
  let approvedRecords = 0;

  for (const record of records) {
    if (record.status !== 'Approved') {
      continue;
    }

    const hours = Number(record.hours_worked);

    approvedRecords += 1;
    totalApprovedHours += hours;

    const existing = employeeTotals.get(
      record.employee_id
    );

    if (existing) {
      existing.approvedHours += hours;
    } else {
      employeeTotals.set(record.employee_id, {
        employeeId: record.employee_id,
        fullName: record.full_name,
        approvedHours: hours,
      });
    }
  }

  const byEmployee = Array.from(employeeTotals.values())
    .map((employee) => ({
      ...employee,
      approvedHours: Number(
        employee.approvedHours.toFixed(2)
      ),
    }))
    .sort((a, b) =>
      a.fullName.localeCompare(b.fullName)
    );

  const summary = {
    totalRecords: records.length,
    approvedRecords,
    totalApprovedHours: Number(
      totalApprovedHours.toFixed(2)
    ),
    byEmployee,
  };

  return { records, summary };
}

async function getReportData(reportType, fromDate, toDate) {
  let result;

  switch (reportType) {
    case 'attendance':
      result = await getAttendanceReport(
        fromDate,
        toDate
      );
      break;

    case 'leave':
      result = await getLeaveReport(
        fromDate,
        toDate
      );
      break;

    case 'overtime':
      result = await getOvertimeReport(
        fromDate,
        toDate
      );
      break;

    default:
      throw new Error('Invalid report type.');
  }

  return {
    reportType,
    fromDate,
    toDate,
    records: result.records,
    summary: result.summary,
  };
}

module.exports = { getReportData };
