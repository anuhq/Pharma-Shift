
const pool = require('../config/db');

// Retrieve overtime records with employee information.
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

// READ: Retrieve overtime records.
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

// Retrieve active employees who are eligible for overtime.
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
       AND r.role_name IN ('Pharmacist', 'Pharmacy Assistant')
     ORDER BY e.full_name ASC`
  );

  return rows;
}

// CREATE: Save a new overtime record in MySQL.
async function createOvertimeRecord(data) {
  // Only active Pharmacists and Pharmacy Assistants
  // can have overtime recorded.
  const [result] = await pool.execute(
    `INSERT INTO overtime
       (employee_id, overtime_date, hours_worked, status)
     SELECT
       e.employee_id, ?, ?, ?
     FROM employee AS e
     INNER JOIN \`role\` AS r
       ON r.role_id = e.role_id
     WHERE e.employee_id = ?
       AND LOWER(e.status) = 'active'
       AND r.role_name IN ('Pharmacist', 'Pharmacy Assistant')`,
    [
      data.overtime_date,
      data.hours_worked,
      data.status,
      data.employee_id,
    ]
  );

  // No record is inserted for an ineligible employee.
  if (result.affectedRows !== 1) {
    return null;
  }

  // Retrieve the saved record with employee details.
  const [rows] = await pool.execute(
    `${OVERTIME_SELECT}
     WHERE o.overtime_id = ?
     LIMIT 1`,
    [result.insertId]
  );

  if (!rows[0]) {
    throw new Error('Unable to retrieve the saved overtime record.');
  }

  return {
    ...rows[0],
    hours_worked: Number(rows[0].hours_worked),
  };
}

module.exports = {
  listOvertimeRecords,
  listEligibleOvertimeEmployees,
  createOvertimeRecord,
};
