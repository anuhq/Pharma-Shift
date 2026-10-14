
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
  // Identify the employee before acquiring the shared lock.
  const [requests] = await pool.execute(
    `SELECT employee_id
     FROM leave_request
     WHERE leave_request_id = ?
     LIMIT 1`,
    [leaveRequestId]
  );

  if (requests.length === 0) {
    return {
      outcome: 'not_found',
    };
  }

  const employeeId = requests[0].employee_id;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Lock the employee before checking leave and roster records.
    const [employees] = await connection.execute(
      `SELECT employee_id
       FROM employee
       WHERE employee_id = ?
       FOR UPDATE`,
      [employeeId]
    );

    if (employees.length === 0) {
      await connection.rollback();

      return {
        outcome: 'not_found',
      };
    }

    // Lock and recheck the leave request.
    const [existing] = await connection.execute(
      `SELECT
         employee_id,
         status,
         DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
         DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date
       FROM leave_request
       WHERE leave_request_id = ?
       FOR UPDATE`,
      [leaveRequestId]
    );

    if (
      existing.length === 0 ||
      existing[0].employee_id !== employeeId
    ) {
      await connection.rollback();

      return {
        outcome: 'not_found',
      };
    }

    // Managers cannot review their own leave requests.
    if (employeeId === Number(managerEmployeeId)) {
      await connection.rollback();

      return {
        outcome: 'self_review',
      };
    }

    // Only Pending requests can be reviewed.
    if (existing[0].status !== 'Pending') {
      await connection.rollback();

      return {
        outcome: 'not_pending',
      };
    }

    // Approved leave cannot overlap a Scheduled shift.
    if (decision === 'Approved') {
      const [conflicts] = await connection.execute(
        `SELECT roster_id
         FROM shift_roster
         WHERE employee_id = ?
           AND status = 'Scheduled'
           AND shift_date BETWEEN ? AND ?
            LIMIT 1
            FOR UPDATE`,
        [
          employeeId,
          existing[0].start_date,
          existing[0].end_date,
        ]
      );

      if (conflicts.length > 0) {
        await connection.rollback();

        return {
          outcome: 'roster_conflict',
        };
      }
    }

    // Save the Manager's decision.
    const [result] = await connection.execute(
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

    if (result.affectedRows !== 1) {
      await connection.rollback();

      return {
        outcome: 'not_pending',
      };
    }

    // Retrieve the updated leave request.
    const [rows] = await connection.execute(
      `${LEAVE_SELECT}
       WHERE lr.leave_request_id = ?
       LIMIT 1`,
      [leaveRequestId]
    );

    await connection.commit();

    return {
      outcome: 'reviewed',
      request: rows[0],
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listLeaveRequests,
  createLeaveRequest,
  updatePendingLeaveRequest,
  deletePendingLeaveRequest,
  reviewPendingLeaveRequest,
};
