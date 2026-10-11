
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

async function listLeaveRequests(employeeId = null) {
  let sql = LEAVE_SELECT;
  const params = [];

  if (employeeId !== null) {
    sql += ' WHERE lr.employee_id = ?';
    params.push(employeeId);
  }

  sql += ' ORDER BY lr.start_date DESC, lr.leave_request_id DESC LIMIT 200';

  const [requests] = await pool.execute(sql, params);
  return requests;
}

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
    `${LEAVE_SELECT} WHERE lr.leave_request_id = ? LIMIT 1`,
    [result.insertId]
  );

  return rows[0];
}


async function cancelPendingLeaveRequest(leaveRequestId, employeeId) {
  // Only the owner can cancel an existing Pending request.
  const [result] = await pool.execute(
    `UPDATE leave_request
     SET status = 'Cancelled'
     WHERE leave_request_id = ?
       AND employee_id = ?
       AND status = 'Pending'`,
    [leaveRequestId, employeeId]
  );

  if (result.affectedRows === 1) {
    const [rows] = await pool.execute(
      `${LEAVE_SELECT}
       WHERE lr.leave_request_id = ?
       LIMIT 1`,
      [leaveRequestId]
    );

    return {
      outcome: 'cancelled',
      request: rows[0],
    };
  }

  // Find out whether the request is missing or not Pending.
  const [existing] = await pool.execute(
    `SELECT status
     FROM leave_request
     WHERE leave_request_id = ?
       AND employee_id = ?
     LIMIT 1`,
    [leaveRequestId, employeeId]
  );

  return {
    outcome: existing.length === 0 ? 'not_found' : 'not_pending',
  };
}


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

  if (result.affectedRows === 0 && existing[0].status !== 'Pending') {
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


async function reviewPendingLeaveRequest(
  leaveRequestId,
  managerEmployeeId,
  decision,
  reviewNote
) {
  // Update only a Pending request belonging to another employee.
  // This condition also protects against simultaneous decisions.
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

  // Find out why the request could not be reviewed.
  const [existing] = await pool.execute(
    `SELECT employee_id, status
     FROM leave_request
     WHERE leave_request_id = ?
     LIMIT 1`,
    [leaveRequestId]
  );

  if (existing.length === 0) {
    return { outcome: 'not_found' };
  }

  if (existing[0].employee_id === managerEmployeeId) {
    return { outcome: 'self_review' };
  }

  return { outcome: 'not_pending' };
}

module.exports = {
  listLeaveRequests,
  createLeaveRequest,
  cancelPendingLeaveRequest,
  updatePendingLeaveRequest,
  reviewPendingLeaveRequest,
};