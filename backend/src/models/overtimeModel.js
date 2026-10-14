
const pool = require('../config/db');

const OVERTIME_SELECT = `
  SELECT
    o.overtime_id,
    o.employee_id,
    e.full_name,
    r.role_name,
    DATE_FORMAT(o.overtime_date, '%Y-%m-%d') AS overtime_date,
    o.hours_worked,
    o.status
  FROM overtime AS o
  INNER JOIN employee AS e
    ON e.employee_id = o.employee_id
  INNER JOIN \`role\` AS r
    ON r.role_id = e.role_id
`;

// Retrieve overtime records.
async function listOvertimeRecords(employeeId = null) {
  const params = [];
  let sql = OVERTIME_SELECT;

  if (employeeId !== null) {
    sql += ' WHERE o.employee_id = ?';
    params.push(employeeId);
  }

  sql += ' ORDER BY o.overtime_date DESC, o.overtime_id DESC';

  const [rows] = await pool.execute(sql, params);

  return rows.map((row) => ({
    ...row,
    hours_worked: Number(row.hours_worked),
  }));
}

// Retrieve employees eligible for overtime.
async function listEligibleOvertimeEmployees() {
  const [rows] = await pool.execute(
    `SELECT
       e.employee_id,
       e.full_name,
       r.role_name
     FROM employee AS e
     INNER JOIN \`role\` AS r
       ON r.role_id = e.role_id
     WHERE LOWER(e.status) = 'active'
       AND r.role_name IN (
         'Pharmacist',
         'Pharmacy Assistant'
       )
     ORDER BY e.full_name ASC`
  );

  return rows;
}

// Lock employee rows before updating overtime records.
async function lockEmployees(connection, employeeIds) {
  const ids = [...new Set(employeeIds)].sort((a, b) => a - b);
  const employees = new Map();

  for (const employeeId of ids) {
    const [rows] = await connection.execute(
      `SELECT employee_id, role_id, status
       FROM employee
       WHERE employee_id = ?
       FOR UPDATE`,
      [employeeId]
    );

    if (rows.length > 0) {
      employees.set(employeeId, rows[0]);
    }
  }

  return employees;
}

// Check whether an employee is eligible for overtime.
async function isEligibleEmployee(connection, employee) {
  if (
    !employee ||
    String(employee.status).toLowerCase() !== 'active'
  ) {
    return false;
  }

  const [roles] = await connection.execute(
    `SELECT role_name
     FROM \`role\`
     WHERE role_id = ?`,
    [employee.role_id]
  );

  return ['Pharmacist', 'Pharmacy Assistant'].includes(
    roles[0]?.role_name
  );
}

// Check the combined overtime hours for one employee on one date.
async function exceedsDailyLimit(
  connection,
  employeeId,
  overtimeDate,
  hoursWorked,
  excludeId = 0
) {
  const [rows] = await connection.execute(
    `SELECT COALESCE(SUM(hours_worked), 0) AS total_hours
     FROM overtime
     WHERE employee_id = ?
       AND overtime_date = ?
       AND status = 'Approved'
       AND overtime_id <> ?`,
    [
      employeeId,
      overtimeDate,
      excludeId,
    ]
  );

  // Calculate using hundredths to avoid decimal rounding errors.
  const existingHours = Math.round(
    Number(rows[0].total_hours) * 100
  );

  const newHours = Math.round(
    Number(hoursWorked) * 100
  );

  return existingHours + newHours > 800;
}

// Retrieve one saved overtime record.
async function getOvertimeById(connection, overtimeId) {
  const [rows] = await connection.execute(
    `${OVERTIME_SELECT}
     WHERE o.overtime_id = ?
     LIMIT 1`,
    [overtimeId]
  );

  if (!rows[0]) {
    throw new Error(
      'Unable to retrieve the saved overtime record.'
    );
  }

  return {
    ...rows[0],
    hours_worked: Number(rows[0].hours_worked),
  };
}

// CREATE - Save Approved overtime within the daily limit.
async function createOvertimeRecord(data) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Lock the selected employee.
    const employees = await lockEmployees(
      connection,
      [data.employee_id]
    );

    const eligible = await isEligibleEmployee(
      connection,
      employees.get(data.employee_id)
    );

    if (!eligible) {
      await connection.rollback();
      return null;
    }

    // Check all existing Approved overtime for the same day.
    const limitExceeded = await exceedsDailyLimit(
      connection,
      data.employee_id,
      data.overtime_date,
      data.hours_worked
    );

    if (limitExceeded) {
      await connection.rollback();

      return {
        outcome: 'daily_limit_exceeded',
      };
    }

    const [result] = await connection.execute(
      `INSERT INTO overtime
         (employee_id, overtime_date, hours_worked, status)
       VALUES (?, ?, ?, 'Approved')`,
      [
        data.employee_id,
        data.overtime_date,
        data.hours_worked,
      ]
    );

    const record = await getOvertimeById(
      connection,
      result.insertId
    );

    await connection.commit();

    return record;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// UPDATE - Edit an Approved overtime record.
async function updateOvertimeRecord(overtimeId, data) {
  // Identify the current employee before acquiring locks.
  const [previous] = await pool.execute(
    `SELECT employee_id
     FROM overtime
     WHERE overtime_id = ?
     LIMIT 1`,
    [overtimeId]
  );

  if (previous.length === 0) {
    return null;
  }

  const previousEmployeeId = previous[0].employee_id;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Lock both employees in a consistent order.
    const employees = await lockEmployees(
      connection,
      [
        previousEmployeeId,
        data.employee_id,
      ]
    );

    // Lock and recheck the overtime record.
    const [existing] = await connection.execute(
      `SELECT employee_id, status
       FROM overtime
       WHERE overtime_id = ?
       FOR UPDATE`,
      [overtimeId]
    );

    if (
      existing.length === 0 ||
      existing[0].status !== 'Approved' ||
      existing[0].employee_id !== previousEmployeeId
    ) {
      await connection.rollback();
      return null;
    }

    // Confirm the selected employee is eligible.
    const eligible = await isEligibleEmployee(
      connection,
      employees.get(data.employee_id)
    );

    if (!eligible) {
      await connection.rollback();
      return null;
    }

    // Exclude the current record when checking the updated total.
    const limitExceeded = await exceedsDailyLimit(
      connection,
      data.employee_id,
      data.overtime_date,
      data.hours_worked,
      overtimeId
    );

    if (limitExceeded) {
      await connection.rollback();

      return {
        outcome: 'daily_limit_exceeded',
      };
    }

    // Preserve the existing Approved status.
    await connection.execute(
      `UPDATE overtime
       SET employee_id = ?,
           overtime_date = ?,
           hours_worked = ?
       WHERE overtime_id = ?
         AND status = 'Approved'`,
      [
        data.employee_id,
        data.overtime_date,
        data.hours_worked,
        overtimeId,
      ]
    );

    const record = await getOvertimeById(
      connection,
      overtimeId
    );

    await connection.commit();

    return record;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// DELETE - Permanently remove an overtime record.
async function deleteOvertimeRecord(overtimeId) {
  const [result] = await pool.execute(
    `DELETE FROM overtime
     WHERE overtime_id = ?`,
    [overtimeId]
  );

  return result.affectedRows === 1;
}

module.exports = {
  listOvertimeRecords,
  listEligibleOvertimeEmployees,
  createOvertimeRecord,
  updateOvertimeRecord,
  deleteOvertimeRecord,
};
