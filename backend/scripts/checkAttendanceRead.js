const path = require('node:path');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
  quiet: true,
});

async function checkAttendanceRead() {
  let pool;

  try {
    pool = require('../src/config/db');
    const { getAttendanceForEmployee } = require('../src/models/attendanceModel');

    // Choose an existing employee for this local database check.
    const [employees] = await pool.execute(
      `SELECT employee_id
       FROM employee
       WHERE status = 'Active'
       ORDER BY employee_id
       LIMIT 1`
    );

    if (employees.length === 0) {
      console.error('No active employees were found. Attendance read not checked.');
      process.exitCode = 1;
      return;
    }

    const employeeId = employees[0].employee_id;
    const records = await getAttendanceForEmployee(employeeId);

    if (records.some((record) => record.employee_id !== employeeId)) {
      throw new Error('Unexpected employee in attendance results.');
    }

    // Print counts only, without employee details.
    console.log('Attendance database read passed.');
    console.log(`Records returned (up to 100): ${records.length}`);
    console.log('No records were created or changed.');
  } catch (error) {
    console.error('Attendance database read failed.');
    console.error('Error code:', error.code || 'CHECK_FAILED');
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end();
  }
}

checkAttendanceRead().catch(() => {
  console.error('Unable to finish the attendance database check.');
  process.exitCode = 1;
});
