const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// Reuse the same employee fields in our read queries
const employeeSelect = `
  SELECT
    e.employee_id,
    e.full_name,
    e.contact_no,
    e.status,
    e.role_id,
    r.role_name
  FROM employee e
  INNER JOIN \`role\` r ON e.role_id = r.role_id
`;

// Accept positive IDs within the database's INT range
function parseId(value) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  if (!/^[1-9]\d*$/.test(String(value))) {
    return null;
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id) || id > 2147483647) {
    return null;
  }

  return id;
}

// Check and clean employee details before writing to MySQL
function validateEmployee(body, isCreate = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Send employee details as a JSON object.' };
  }

  if (typeof body.full_name !== 'string') {
    return { error: 'Full name is required.' };
  }

  const fullName = body.full_name.trim();

  if (fullName.length < 2 || fullName.length > 100) {
    return { error: 'Full name must contain 2 to 100 characters.' };
  }

  const roleId = parseId(body.role_id);

  if (roleId === null) {
    return { error: 'Select a valid employee role.' };
  }

  let contactNo = null;

  if (body.contact_no !== undefined && body.contact_no !== null) {
    if (typeof body.contact_no !== 'string') {
      return { error: 'Contact number must be text.' };
    }

    contactNo = body.contact_no.trim() || null;

    if (contactNo !== null && contactNo.length > 20) {
      return { error: 'Contact number must not exceed 20 characters.' };
    }
  }

  const status =
    isCreate && body.status === undefined ? 'Active' : body.status;

  if (!['Active', 'Inactive'].includes(status)) {
    return { error: 'Status must be Active or Inactive.' };
  }

  return {
    data: { fullName, contactNo, roleId, status },
  };
}

// Keep database details out of API error responses
function sendDatabaseError(res, error, message) {
  console.error(message, error.code);

  if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      message: 'The selected role does not exist.',
    });
  }

  return res.status(500).json({ message });
}

// Get all employees with their role names
router.get('/', async (req, res) => {
  try {
    const [employees] = await pool.query(
      `${employeeSelect} ORDER BY e.employee_id DESC`,
    );

    return res.status(200).json(employees);
  } catch (error) {
    return sendDatabaseError(
      res,
      error,
      'Unable to retrieve employees.',
    );
  }
});

// Get one employee by ID
router.get('/:id', async (req, res) => {
  const employeeId = parseId(req.params.id);

  if (employeeId === null) {
    return res.status(400).json({
      message: 'Employee ID must be a valid positive integer.',
    });
  }

  try {
    const [employees] = await pool.query(
      `${employeeSelect} WHERE e.employee_id = ?`,
      [employeeId],
    );

    if (employees.length === 0) {
      return res.status(404).json({
        message: 'Employee not found.',
      });
    }

    return res.status(200).json(employees[0]);
  } catch (error) {
    return sendDatabaseError(
      res,
      error,
      'Unable to retrieve the employee.',
    );
  }
});

// Create an employee using validated values
router.post('/', async (req, res) => {
  const validation = validateEmployee(req.body, true);

  if (validation.error) {
    return res.status(400).json({
      message: validation.error,
    });
  }

  const { fullName, contactNo, roleId, status } = validation.data;

  try {
    const [result] = await pool.query(
      `
        INSERT INTO employee
          (role_id, full_name, contact_no, status)
        VALUES (?, ?, ?, ?)
      `,
      [roleId, fullName, contactNo, status],
    );

    // Read back the newly created record
    const [employees] = await pool.query(
      `${employeeSelect} WHERE e.employee_id = ?`,
      [result.insertId],
    );

    return res.status(201).json(employees[0]);
  } catch (error) {
    return sendDatabaseError(
      res,
      error,
      'Unable to create the employee.',
    );
  }
});

// Update an employee using validated values
router.put('/:id', async (req, res) => {
  const employeeId = parseId(req.params.id);

  if (employeeId === null) {
    return res.status(400).json({
      message: 'Employee ID must be a valid positive integer.',
    });
  }

  const validation = validateEmployee(req.body);

  if (validation.error) {
    return res.status(400).json({
      message: validation.error,
    });
  }

  const { fullName, contactNo, roleId, status } = validation.data;

  try {
    await pool.query(
      `
        UPDATE employee
        SET role_id = ?, full_name = ?, contact_no = ?, status = ?
        WHERE employee_id = ?
      `,
      [roleId, fullName, contactNo, status, employeeId],
    );

    // Read back the record, even if the submitted values were unchanged
    const [employees] = await pool.query(
      `${employeeSelect} WHERE e.employee_id = ?`,
      [employeeId],
    );

    if (employees.length === 0) {
      return res.status(404).json({
        message: 'Employee not found.',
      });
    }

    return res.status(200).json(employees[0]);
  } catch (error) {
    return sendDatabaseError(
      res,
      error,
      'Unable to update the employee.',
    );
  }
});

// Safely delete an inactive employee without linked records
router.delete('/:id', async (req, res) => {
  const employeeId = parseId(req.params.id);

  if (employeeId === null) {
    return res.status(400).json({
      message: 'Employee ID must be a valid positive integer.',
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Lock employee record while checking deletion eligibility
    const [employees] = await connection.query(
      `SELECT employee_id, status
       FROM employee
       WHERE employee_id = ?
       FOR UPDATE`,
      [employeeId]
    );

    if (employees.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        message: 'Employee not found.',
      });
    }

    // Active employees must be deactivated first
    if (employees[0].status !== 'Inactive') {
      await connection.rollback();

      return res.status(409).json({
        message: 'Deactivate the employee before deleting.',
      });
    }

    // Check all tables referencing employee records
    const [references] = await connection.query(
      `
      SELECT
        (SELECT COUNT(*) FROM \`user\`
         WHERE employee_id = ?) AS login_accounts,

        (SELECT COUNT(*) FROM shift_roster
         WHERE employee_id = ?) AS rosters,

        (SELECT COUNT(*) FROM attendance
         WHERE employee_id = ?) AS attendance_records,

        (SELECT COUNT(*) FROM leave_request
         WHERE employee_id = ?) AS leave_requests,

        (SELECT COUNT(*) FROM task_assignment
         WHERE employee_id = ?) AS tasks,

        (SELECT COUNT(*) FROM overtime
         WHERE employee_id = ?) AS overtime_records,

        (SELECT COUNT(*) FROM shift_handover
         WHERE employee_id = ?) AS handovers,

        (SELECT COUNT(*) FROM staff_incident
         WHERE employee_id = ?) AS incidents,

        (SELECT COUNT(*) FROM corrective_action
         WHERE assigned_employee_id = ?) AS corrective_actions
      `,
      Array(9).fill(employeeId)
    );

    const hasLinkedRecords = Object.values(references[0])
      .some((count) => Number(count) > 0);

    if (hasLinkedRecords) {
      await connection.rollback();

      return res.status(409).json({
        message:
          'This employee has related records and cannot be permanently deleted. Keep the employee inactive to preserve history.',
      });
    }

    // Delete only after all safety checks pass
    const [result] = await connection.query(
      'DELETE FROM employee WHERE employee_id = ?',
      [employeeId]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();

      return res.status(404).json({
        message: 'Employee not found.',
      });
    }

    await connection.commit();

    return res.status(200).json({
      message: 'Employee deleted successfully.',
    });

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Employee rollback error:', rollbackError.code);
      }
    }

    // MySQL also protects foreign-key references
    if (
      error.code === 'ER_ROW_IS_REFERENCED_2' ||
      error.code === 'ER_ROW_IS_REFERENCED'
    ) {
      return res.status(409).json({
        message:
          'This employee is being used by another record and cannot be deleted.',
      });
    }

    console.error('Employee deletion error:', error.code);

    return res.status(500).json({
      message: 'Unable to delete the employee.',
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
});
module.exports = router;