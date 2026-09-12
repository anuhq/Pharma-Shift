const pool = require('../config/db');

function validateEmployeeId(employeeId) {
  // Stop invalid IDs before querying the database.
  if (
    !Number.isInteger(employeeId) ||
    employeeId < 1 ||
    employeeId > 2147483647
  ) {
    throw new RangeError('A valid employee ID is required.');
  }
}

async function getAttendanceForEmployee(employeeId) {
  validateEmployeeId(employeeId);

  // Keep dates as text so timezone conversion cannot change the day.
  const [records] = await pool.execute(
    `SELECT
       a.attendance_id,
       a.employee_id,
       e.full_name,
       DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendance_date,
       a.check_in_time,
       a.check_out_time,
       a.status,
       a.correction_note
     FROM attendance AS a
     JOIN employee AS e ON e.employee_id = a.employee_id
     WHERE a.employee_id = ?
     ORDER BY a.attendance_date DESC, a.attendance_id DESC
     LIMIT 100`,
    [employeeId]
  );

  return records;
}

async function getAllAttendance() {
  const [records] = await pool.execute(
    `SELECT
       a.attendance_id,
       a.employee_id,
       e.full_name,
       DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendance_date,
       a.check_in_time,
       a.check_out_time,
       a.status,
       a.correction_note
     FROM attendance AS a
     JOIN employee AS e ON e.employee_id = a.employee_id
     ORDER BY a.attendance_date DESC, a.attendance_id DESC
     LIMIT 100`
  );

  return records;
}

async function getAttendanceById(attendanceId) {
  const [records] = await pool.execute(
    `SELECT
       attendance_id,
       employee_id,
       DATE_FORMAT(attendance_date, '%Y-%m-%d') AS attendance_date,
       check_in_time,
       check_out_time,
       status,
       correction_note
     FROM attendance
     WHERE attendance_id = ?`,
    [attendanceId]
  );

  return records[0] || null;
}

async function createCheckIn(employeeId) {
  validateEmployeeId(employeeId);

  // The database records the current local date and time.
  const [result] = await pool.execute(
    `INSERT INTO attendance (
       employee_id,
       attendance_date,
       check_in_time,
       check_out_time,
       status,
       correction_note
     )
     VALUES (?, CURDATE(), CURTIME(), NULL, 'Checked In', NULL)`,
    [employeeId]
  );

  return getAttendanceById(result.insertId);
}

async function createCheckOut(employeeId) {
  validateEmployeeId(employeeId);

  // Find today's attendance before recording the check-out.
  const [records] = await pool.execute(
    `SELECT attendance_id, check_out_time
     FROM attendance
     WHERE employee_id = ?
       AND attendance_date = CURDATE()
     LIMIT 1`,
    [employeeId]
  );

  if (records.length === 0) {
    const error = new Error('Check-in is required before check-out.');
    error.code = 'ATTENDANCE_NOT_FOUND';
    throw error;
  }

  if (records[0].check_out_time !== null) {
    const error = new Error('Check-out has already been recorded.');
    error.code = 'ATTENDANCE_ALREADY_COMPLETED';
    throw error;
  }

  const [result] = await pool.execute(
    `UPDATE attendance
     SET check_out_time = CURTIME(),
         status = 'Present'
     WHERE attendance_id = ?
       AND check_out_time IS NULL`,
    [records[0].attendance_id]
  );

  if (result.affectedRows !== 1) {
    const error = new Error('Check-out has already been recorded.');
    error.code = 'ATTENDANCE_ALREADY_COMPLETED';
    throw error;
  }

  return getAttendanceById(records[0].attendance_id);
}

async function correctAttendance(
  attendanceId,
  checkInTime,
  checkOutTime,
  correctionNote
) {
  const status = checkOutTime ? 'Present' : 'Checked In';

  // Save the manager's corrected times and reason.
  const [result] = await pool.execute(
    `UPDATE attendance
     SET check_in_time = ?,
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

module.exports = {
  getAttendanceForEmployee,
  getAllAttendance,
  createCheckIn,
  createCheckOut,
  correctAttendance,
};