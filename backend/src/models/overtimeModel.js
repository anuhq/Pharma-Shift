
const pool = require('../config/db');

// Shared query for retrieving overtime records.
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

// READ: Retrieve active staff eligible for overtime.
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

// CREATE: Save overtime for an eligible employee.
async function createOvertimeRecord(data) {
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
       AND r.role_name IN (
         'Pharmacist',
         'Pharmacy Assistant'
       )`,
    [
      data.overtime_date,
      data.hours_worked,
      data.status,
      data.employee_id,
    ]
  );

  if (result.affectedRows !== 1) {
    return null;
  }

  const [rows] = await pool.execute(
    `${OVERTIME_SELECT}
     WHERE o.overtime_id = ?
     LIMIT 1`,
    [result.insertId]
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

// UPDATE: Edit an existing Approved overtime record.
async function updateOvertimeRecord(overtimeId, data) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Lock the record while checking its status.
    const [existingRows] = await connection.execute(
      `SELECT overtime_id, status
       FROM overtime
       WHERE overtime_id = ?
       FOR UPDATE`,
      [overtimeId]
    );

    // Do not edit deleted, missing or non-Approved records.
    if (
      existingRows.length === 0 ||
      existingRows[0].status !== 'Approved'
    ) {
      await connection.rollback();
      return null;
    }

    // Confirm the selected employee is eligible.
    const [eligibleRows] = await connection.execute(
      `SELECT e.employee_id
       FROM employee AS e
       INNER JOIN \`role\` AS r
         ON r.role_id = e.role_id
       WHERE e.employee_id = ?
         AND LOWER(e.status) = 'active'
         AND r.role_name IN (
           'Pharmacist',
           'Pharmacy Assistant'
         )
       LIMIT 1
       FOR SHARE`,
      [data.employee_id]
    );

    if (eligibleRows.length === 0) {
      await connection.rollback();
      return null;
    }

    // Update the employee, date and hours.
    // Preserve the existing Approved status.
    await connection.execute(
      `UPDATE overtime
       SET
         employee_id = ?,
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

    // Read the updated record.
    const [rows] = await connection.execute(
      `${OVERTIME_SELECT}
       WHERE o.overtime_id = ?
       LIMIT 1`,
      [overtimeId]
    );

    await connection.commit();

    if (!rows[0]) {
      throw new Error(
        'Unable to retrieve the updated overtime record.'
      );
    }

    return {
      ...rows[0],
      hours_worked: Number(rows[0].hours_worked),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// DELETE: Permanently remove an overtime record.
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
