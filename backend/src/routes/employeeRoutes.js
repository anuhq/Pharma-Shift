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

module.exports = router;