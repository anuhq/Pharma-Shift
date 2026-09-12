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

  // Return only the selected employee's latest attendance records.
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
  // Managers use this list to review attendance for all employees.
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

module.exports = {
  getAttendanceForEmployee,
  getAllAttendance,
};