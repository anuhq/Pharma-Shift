
const pool = require('../config/db');

function validateEmployeeId(employeeId) {
  if (
    !Number.isInteger(employeeId) ||
    employeeId < 1 ||
    employeeId > 2147483647
  ) {
    throw new RangeError('A valid employee ID is required.');
  }
}

function validateAttendanceId(attendanceId) {
  if (
    !Number.isSafeInteger(attendanceId) ||
    attendanceId < 1 ||
    attendanceId > 2147483647
  ) {
    throw new RangeError('A valid attendance ID is required.');
  }
}

function attendanceError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

// READ - Attendance with optional roster information.
// Time differences are informational, not official statuses.
const attendanceReadQuery = `
  SELECT
    a.attendance_id,
    a.employee_id,
    e.full_name,
    DATE_FORMAT(
      a.attendance_date,
      '%Y-%m-%d'
    ) AS attendance_date,
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
      ELSE GREATEST(
        0,
        ROUND(
          TIME_TO_SEC(
            TIMEDIFF(
              a.check_in_time,
              st.start_time
            )
          ) / 60,
          1
        )
      )
    END AS minutes_after_start,

    CASE
      WHEN sr.roster_id IS NULL
        OR st.shift_type_id IS NULL
        OR st.status <> 'Active'
        OR st.start_time >= st.end_time
        OR a.check_out_time IS NULL
      THEN NULL
      ELSE GREATEST(
        0,
        ROUND(
          TIME_TO_SEC(
            TIMEDIFF(
              st.end_time,
              a.check_out_time
            )
          ) / 60,
          1
        )
      )
    END AS minutes_before_end,

    CASE
      WHEN a.check_out_time IS NULL
        AND a.attendance_date < CURDATE()
      THEN 'Missing check-out'
      WHEN a.check_out_time IS NULL
      THEN 'Still checked in'
      ELSE NULL
    END AS checkout_review

  FROM attendance AS a

  JOIN employee AS e
    ON e.employee_id = a.employee_id

  LEFT JOIN shift_roster AS sr
    ON sr.roster_id = (
      SELECT sr2.roster_id
      FROM shift_roster AS sr2
      WHERE sr2.employee_id = a.employee_id
        AND sr2.shift_date = a.attendance_date
        AND sr2.status IN ('Assigned', 'Scheduled')
      ORDER BY
        CASE
          WHEN sr2.status = 'Assigned' THEN 0
          ELSE 1
        END,
        sr2.roster_id DESC
      LIMIT 1
    )

  LEFT JOIN shift_type AS st
    ON st.shift_type_id = sr.shift_type_id
`;

// READ - Employee sees only their attendance records.
async function getAttendanceForEmployee(employeeId) {
  validateEmployeeId(employeeId);

  const [records] = await pool.execute(
    `${attendanceReadQuery}
     WHERE a.employee_id = ?
     ORDER BY
       a.attendance_date DESC,
       a.attendance_id DESC
     LIMIT 100`,
    [employeeId]
  );

  return records;
}

// READ - Owner/Manager sees all attendance records.
async function getAllAttendance() {
  const [records] = await pool.execute(
    `${attendanceReadQuery}
     ORDER BY
       a.attendance_date DESC,
       a.attendance_id DESC
     LIMIT 100`
  );

  return records;
}

// READ - Find a single attendance record.
async function getAttendanceById(attendanceId) {
  validateAttendanceId(attendanceId);

  const [records] = await pool.execute(
    `${attendanceReadQuery}
     WHERE a.attendance_id = ?
     LIMIT 1`,
    [attendanceId]
  );

  return records[0] || null;
}

// CREATE - One check-in per employee per calendar day.
// Yesterday's missing check-out does not block today.
async function createCheckIn(employeeId) {
  validateEmployeeId(employeeId);

  const [result] = await pool.execute(
    `INSERT INTO attendance (
       employee_id,
       attendance_date,
       check_in_time,
       check_out_time,
       status,
       correction_note
     )
     VALUES (
       ?,
       CURDATE(),
       CURTIME(),
       NULL,
       'Checked In',
       NULL
     )`,
    [employeeId]
  );

  return getAttendanceById(result.insertId);
}

// UPDATE - Complete only today's attendance.
async function createCheckOut(employeeId) {
  validateEmployeeId(employeeId);

  const connection = await pool.getConnection();
  let attendanceId;

  try {
    await connection.beginTransaction();

    const [records] = await connection.execute(
      `SELECT
         attendance_id,
         check_out_time
       FROM attendance
       WHERE employee_id = ?
         AND attendance_date = CURDATE()
       LIMIT 1
       FOR UPDATE`,
      [employeeId]
    );

    if (records.length === 0) {
      throw attendanceError(
        'ATTENDANCE_NOT_FOUND',
        'Check-in is required before check-out.'
      );
    }

    const record = records[0];

    if (record.check_out_time !== null) {
      throw attendanceError(
        'ATTENDANCE_ALREADY_COMPLETED',
        'Check-out has already been recorded.'
      );
    }

    attendanceId = record.attendance_id;

    const [result] = await connection.execute(
      `UPDATE attendance
       SET
         check_out_time = CURTIME(),
         status = 'Present'
       WHERE attendance_id = ?
         AND check_out_time IS NULL`,
      [attendanceId]
    );

    if (result.affectedRows !== 1) {
      throw attendanceError(
        'ATTENDANCE_ALREADY_COMPLETED',
        'Check-out has already been recorded.'
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getAttendanceById(attendanceId);
}

// UPDATE - Manager corrects recorded attendance.
// A correction reason is enforced by attendanceRoutes.js.
async function correctAttendance(
  attendanceId,
  checkInTime,
  checkOutTime,
  correctionNote
) {
  validateAttendanceId(attendanceId);

  const status = checkOutTime
    ? 'Present'
    : 'Checked In';

  const [result] = await pool.execute(
    `UPDATE attendance
     SET
       check_in_time = ?,
       check_out_time = ?,
       status = ?,
       correction_note = ?
     WHERE attendance_id = ?`,
    [
      checkInTime,
      checkOutTime,
      status,
      correctionNote,
      attendanceId,
    ]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return getAttendanceById(attendanceId);
}

// DELETE - Only the manager-authorized route can delete.
async function deleteAttendance(attendanceId) {
  validateAttendanceId(attendanceId);

  const [result] = await pool.execute(
    `DELETE FROM attendance
     WHERE attendance_id = ?`,
    [attendanceId]
  );

  return result.affectedRows === 1;
}

module.exports = {
  getAttendanceForEmployee,
  getAllAttendance,
  createCheckIn,
  createCheckOut,
  correctAttendance,
  deleteAttendance,
};
