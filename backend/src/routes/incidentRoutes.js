const express = require('express');
const pool = require('../config/db');
const {
  requireAuth,
  requireRole,
} = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth, requireRole('Owner/Manager'));

function validateIncident(body) {
  const employeeId = Number(body?.employee_id);
  const categoryId = Number(body?.category_id);

  if (!Number.isSafeInteger(employeeId) || employeeId < 1) {
    return 'Choose an employee.';
  }

  if (!Number.isSafeInteger(categoryId) || categoryId < 1) {
    return 'Choose an incident category.';
  }

  const date = body?.incident_date;

  if (
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    return 'Enter a valid incident date.';
  }

  const parsedDate = new Date(date + 'T00:00:00Z');

  if (
    Number.isNaN(parsedDate.getTime()) ||
    Number(date.slice(0, 4)) < 1000 ||
    parsedDate.toISOString().slice(0, 10) !== date
  ) {
    return 'Enter a valid incident date.';
  }

  if (
    typeof body.description !== 'string' ||
    !body.description.trim() ||
    body.description.trim().length > 500
  ) {
    return 'Enter an incident description between 1 and 500 characters.';
  }

  return null;
}

async function validateReferences(body, previousEmployeeId = null) {
  const employeeId = Number(body.employee_id);

  const [employees] = await pool.execute(
    'SELECT employee_id, status FROM employee WHERE employee_id = ?',
    [employeeId]
  );

  if (!employees.length) {
    return 'The selected employee does not exist.';
  }

  if (
    employees[0].status.toLowerCase() !== 'active' &&
    employeeId !== previousEmployeeId
  ) {
    return 'Choose an active employee.';
  }

  const [categories] = await pool.execute(
    'SELECT category_id FROM incident_category WHERE category_id = ?',
    [Number(body.category_id)]
  );

  return categories.length
    ? null
    : 'The selected category does not exist.';
}

// Employee options for the incident form.
router.get('/employees', async (req, res) => {
  const [employees] = await pool.execute(
    `SELECT employee_id, full_name, status
     FROM employee
     ORDER BY full_name, employee_id`
  );

  res.json({ employees });
});

// Read incidents with employee and category names.
router.get('/', async (req, res) => {
  const [incidents] = await pool.execute(
    `SELECT i.incident_id, i.employee_id, e.full_name,
            i.category_id, c.category_name, c.severity_level,
            DATE_FORMAT(i.incident_date, '%Y-%m-%d') AS incident_date,
            i.description, i.status
     FROM staff_incident i
     JOIN employee e ON e.employee_id = i.employee_id
     JOIN incident_category c ON c.category_id = i.category_id
     ORDER BY i.incident_date DESC, i.incident_id DESC`
  );

  res.json({ incidents });
});

// Create an incident. New incidents always start as Open.
router.post('/', async (req, res) => {
  const error = validateIncident(req.body);

  if (error) {
    return res.status(400).json({ message: error });
  }

  const referenceError = await validateReferences(req.body);

  if (referenceError) {
    return res.status(400).json({ message: referenceError });
  }

  const [result] = await pool.execute(
    `INSERT INTO staff_incident
       (employee_id, category_id, incident_date, description, status)
     VALUES (?, ?, ?, ?, 'Open')`,
    [
      Number(req.body.employee_id),
      Number(req.body.category_id),
      req.body.incident_date,
      req.body.description.trim(),
    ]
  );

  res.status(201).json({
    message: 'Incident recorded successfully.',
    incident_id: result.insertId,
  });
});

// Edit incident details while preserving its workflow status.
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ message: 'Invalid incident ID.' });
  }

  const error = validateIncident(req.body);

  if (error) {
    return res.status(400).json({ message: error });
  }

  const [existing] = await pool.execute(
    'SELECT employee_id, status FROM staff_incident WHERE incident_id = ?',
    [id]
  );

  if (!existing.length) {
    return res.status(404).json({ message: 'Incident not found.' });
  }

  if (existing[0].status.toLowerCase() === 'closed') {
    return res.status(409).json({
      message: 'Closed incidents cannot be edited.',
    });
  }

  const referenceError = await validateReferences(
    req.body,
    existing[0].employee_id,
  );

  if (referenceError) {
    return res.status(400).json({ message: referenceError });
  }

  await pool.execute(
    `UPDATE staff_incident
     SET employee_id = ?, category_id = ?, incident_date = ?, description = ?
     WHERE incident_id = ? AND status = ?`,
    [
      Number(req.body.employee_id),
      Number(req.body.category_id),
      req.body.incident_date,
      req.body.description.trim(),
      id,
      existing[0].status,
    ]
  );

  const [current] = await pool.execute(
    'SELECT status FROM staff_incident WHERE incident_id = ?',
    [id]
  );

  if (!current.length) {
    return res.status(404).json({ message: 'Incident not found.' });
  }

  if (current[0].status !== existing[0].status) {
    return res.status(409).json({
      message: 'The incident status changed. Refresh the list before editing.',
    });
  }

  res.json({ message: 'Incident updated successfully.' });
});

module.exports = router;