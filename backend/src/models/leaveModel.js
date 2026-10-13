
const pool = require('../config/db');

const LEAVE_SELECT = `
  SELECT
    lr.leave_request_id,
    lr.employee_id,
    e.full_name,
    lr.leave_type,
    DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS start_date,
    DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS end_date,
    lr.reason,
    lr.status
  FROM leave_request AS lr
  JOIN employee AS e ON e.employee_id = lr.employee_id
`;

// READ - Retrieve leave requests from MySQL.
async function listLeaveRequests(employeeId = null) {
  let sql = LEAVE_SELECT;
  const params = [];

  if (employeeId !== null) {
    sql += ' WHERE lr.employee_id = ?';
    params.push(employeeId);
  }

  sql +=
    ' ORDER BY lr.start_date DESC, lr.leave_request_id DESC LIMIT 200';

  const [requests] = await pool.execute(sql, params);

  return requests;
}

// CREATE - Submit a new Pending leave request.
async function createLeaveRequest(employeeId, data) {
  const [result] = await pool.execute(
    `INSERT INTO leave_request
      (employee_id, leave_type, start_date, end_date, reason, status)
     VALUES (?, ?, ?, ?, ?, 'Pending')`,
    [
      employeeId,
      data.leave_type,
      data.start_date,
      data.end_date,
      data.reason,
    ]
  );

  const [rows] = await pool.execute(
    `${LEAVE_SELECT}
     WHERE lr.leave_request_id = ?
     LIMIT 1`,
    [result.insertId]
  );

  return rows[0];
}

// UPDATE - Edit an employee's own Pending leave request.
async function updatePendingLeaveRequest(
  leaveRequestId,
  employeeId,
  data
) {
  const [result] = await pool.execute(
    `UPDATE leave_request
     SET leave_type = ?,
         start_date = ?,
         end_date = ?,
         reason = ?
     WHERE leave_request_id = ?
       AND employee_id = ?
       AND status = 'Pending'`,
    [
      data.leave_type,
      data.start_date,
      data.end_date,
      data.reason,
      leaveRequestId,
      employeeId,
    ]
  );

  const [existing] = await pool.execute(
    `SELECT status
     FROM leave_request
     WHERE leave_request_id = ?
       AND employee_id = ?
     LIMIT 1`,
    [leaveRequestId, employeeId]
  );

  if (existing.length === 0) {
    return { outcome: 'not_found' };
  }

  if (
    result.affectedRows === 0 &&
    existing[0].status !== 'Pending'
  ) {
    return { outcome: 'not_pending' };
  }

  const [rows] = await pool.execute(
    `${LEAVE_SELECT}
     WHERE lr.leave_request_id = ?
     LIMIT 1`,
    [leaveRequestId]
  );

  return {
    outcome: 'updated',
    request: rows[0],
  };
}

// DELETE - Permanently delete an employee's own Pending request.
async function deletePendingLeaveRequest(
  leaveRequestId,
  employeeId
) {
  // Check ownership and Pending status in the DELETE query.
  const [result] = await pool.execute(
    `DELETE FROM leave_request
     WHERE leave_request_id = ?
       AND employee_id = ?
       AND status = 'Pending'`,
    [leaveRequestId, employeeId]
  );

  if (result.affectedRows === 1) {
    return {
      outcome: 'deleted',
    };
  }

  // Determine whether the request is missing or not Pending.
  const [existing] = await pool.execute(
    `SELECT status
     FROM leave_request
     WHERE leave_request_id = ?
       AND employee_id = ?
     LIMIT 1`,
    [leaveRequestId, employeeId]
  );

  if (existing.length === 0) {
    return {
      outcome: 'not_found',
    };
  }

  return {
    outcome: 'not_pending',
  };
}

// REVIEW - Manager approves or rejects a Pending request.
async function reviewPendingLeaveRequest(
  leaveRequestId,
  managerEmployeeId,
  decision,
  reviewNote
) {
  // Only Pending requests belonging to other employees
  // can be approved or rejected.
  const [result] = await pool.execute(
    `UPDATE leave_request
     SET status = ?,
         reviewed_by_employee_id = ?,
         reviewed_at = NOW(),
         review_note = ?
     WHERE leave_request_id = ?
       AND status = 'Pending'
       AND employee_id <> ?`,
    [
      decision,
      managerEmployeeId,
      reviewNote,
      leaveRequestId,
      managerEmployeeId,
    ]
  );

  if (result.affectedRows === 1) {
    const [rows] = await pool.execute(
      `${LEAVE_SELECT}
       WHERE lr.leave_request_id = ?
       LIMIT 1`,
      [leaveRequestId]
    );

    return {
      outcome: 'reviewed',
      request: rows[0],
    };
  }

  const [existing] = await pool.execute(
    `SELECT employee_id, status
     FROM leave_request
     WHERE leave_request_id = ?
     LIMIT 1`,
    [leaveRequestId]
  );

  if (existing.length === 0) {
    return {
      outcome: 'not_found',
    };
  }

  if (existing[0].employee_id === managerEmployeeId) {
    return {
      outcome: 'self_review',
    };
  }

  return {
    outcome: 'not_pending',
  };
}

module.exports = {
  listLeaveRequests,
  createLeaveRequest,
  updatePendingLeaveRequest,
  deletePendingLeaveRequest,
  reviewPendingLeaveRequest,
};
