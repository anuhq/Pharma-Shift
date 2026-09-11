const pool = require('../config/db');

async function getAttendanceForEmployee(employeeId) {
  if (
    !Number.isInteger(employeeId) ||
    employeeId < 1 ||
    employeeId > 2147483647
  ) {
    throw new RangeError('A valid employee ID is required.');
  }

  // The API must check access before calling this function.
  // Keep the date as text so timezone conversion does not change the day.
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

module.exports = { getAttendanceForEmployee };
