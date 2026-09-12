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

module.exports = {
  getAttendanceForEmployee,
  getAllAttendance,
  createCheckIn,
};