const express = require('express');
const pool = require('../config/db');
const {
  requireAuth,
  requireRole,
} = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth, requireRole('Owner/Manager'));

const ACTION_STATUSES = [
  'Pending',
  'In Progress',
  'Completed',
  'Cancelled',
];

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsedDate = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === value
  );
}

function validateAction(body) {
  const incidentId = Number(body?.incident_id);
  const employeeId = Number(body?.assigned_employee_id);

  if (!Number.isSafeInteger(incidentId) || incidentId < 1) {
    return 'Choose an incident.';
  }

  if (!Number.isSafeInteger(employeeId) || employeeId < 1) {
    return 'Choose an employee to assign.';
  }

  if (
    typeof body?.action_description !== 'string' ||
    !body.action_description.trim() ||
    body.action_description.trim().length > 500
  ) {
    return 'Enter an action between 1 and 500 characters.';
  }

  if (!isValidDate(body?.due_date)) {
    return 'Enter a valid due date.';
  }

  if (!ACTION_STATUSES.includes(body?.status)) {
    return 'Choose Pending, In Progress, Completed or Cancelled.';
  }

  if (
    body.follow_up_details != null &&
    (typeof body.follow_up_details !== 'string' ||
      body.follow_up_details.trim().length > 500)
  ) {
    return 'Follow-up details must be 500 characters or fewer.';
  }

  if (body.completed_date != null && body.completed_date !== '') {
    if (!isValidDate(body.completed_date)) {
      return 'Enter a valid completed date.';
    }
  }

  if (body.status === 'Completed' && !body.completed_date) {
    return 'Enter the completed date when the action is completed.';
  }

  if (body.status !== 'Completed' && body.completed_date) {
    return 'Completed date is only used for completed actions.';
  }

  return null;
}

function requestError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cleanOptionalText(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

router.get('/', async (req, res, next) => {
  try {
    const [actions] = await pool.execute(
      `SELECT ca.action_id, ca.incident_id,
              ca.assigned_employee_id,
              assigned.full_name AS assigned_employee_name,
              c.category_name,
              DATE_FORMAT(i.incident_date, '%Y-%m-%d')
                AS incident_date,
              ca.action_description,
              DATE_FORMAT(ca.due_date, '%Y-%m-%d') AS due_date,
              ca.status,
              ca.follow_up_details,
              DATE_FORMAT(ca.completed_date, '%Y-%m-%d')
                AS completed_date,
              i.status AS incident_status
       FROM corrective_action ca
       JOIN staff_incident i
         ON i.incident_id = ca.incident_id
       JOIN employee assigned
         ON assigned.employee_id = ca.assigned_employee_id
       JOIN incident_category c
         ON c.category_id = i.category_id
       ORDER BY ca.due_date ASC, ca.action_id DESC`,
    );

    return res.json({ actions });
  } catch (error) {
    return next(error);
  }
});

async function saveAction(req, res, next, isEditing) {
  const actionId = isEditing ? Number(req.params.id) : null;

  if (
    isEditing &&
    (!Number.isSafeInteger(actionId) || actionId < 1)
  ) {
    return res.status(400).json({ message: 'Invalid action ID.' });
  }

  const validationError = validateAction(req.body);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const incidentId = Number(req.body.incident_id);
  const employeeId = Number(req.body.assigned_employee_id);
  const dueDate = req.body.due_date;
  const completedDate = req.body.completed_date || null;

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [incidents] = await connection.execute(
      `SELECT incident_id, status,
              DATE_FORMAT(incident_date, '%Y-%m-%d')
                AS incident_date
       FROM staff_incident
       WHERE incident_id = ?
       FOR UPDATE`,
      [incidentId],
    );

    if (!incidents.length) {
      throw requestError(404, 'Incident not found.');
    }

    const incident = incidents[0];

    if (String(incident.status).toLowerCase() === 'closed') {
      throw requestError(
        409,
        'Corrective actions for closed incidents cannot be changed.',
      );
    }

    if (dueDate < incident.incident_date) {
      throw requestError(
        400,
        'Due date cannot be before the incident date.',
      );
    }

    if (completedDate && completedDate < incident.incident_date) {
      throw requestError(
        400,
        'Completed date cannot be before the incident date.',
      );
    }

    const [employees] = await connection.execute(
      `SELECT employee_id, status
       FROM employee
       WHERE employee_id = ?
       FOR UPDATE`,
      [employeeId],
    );

    if (!employees.length) {
      throw requestError(404, 'Assigned employee not found.');
    }

    if (String(employees[0].status).toLowerCase() !== 'active') {
      throw requestError(400, 'Choose an active employee.');
    }

    let savedActionId = actionId;

    if (isEditing) {
      const [existing] = await connection.execute(
        `SELECT action_id, incident_id
         FROM corrective_action
         WHERE action_id = ?
         FOR UPDATE`,
        [actionId],
      );

      if (!existing.length) {
        throw requestError(404, 'Corrective action not found.');
      }

      if (Number(existing[0].incident_id) !== incidentId) {
        throw requestError(
          400,
          'The incident linked to an action cannot be changed.',
        );
      }

      await connection.execute(
        `UPDATE corrective_action
         SET assigned_employee_id = ?,
             action_description = ?,
             due_date = ?,
             status = ?,
             follow_up_details = ?,
             completed_date = ?
         WHERE action_id = ?`,
        [
          employeeId,
          req.body.action_description.trim(),
          dueDate,
          req.body.status,
          cleanOptionalText(req.body.follow_up_details),
          completedDate,
          actionId,
        ],
      );
    } else {
      const [result] = await connection.execute(
        `INSERT INTO corrective_action
           (incident_id, assigned_employee_id, action_description,
            due_date, status, follow_up_details, completed_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          incidentId,
          employeeId,
          req.body.action_description.trim(),
          dueDate,
          req.body.status,
          cleanOptionalText(req.body.follow_up_details),
          completedDate,
        ],
      );

      savedActionId = result.insertId;
    }

    await connection.commit();

    return res.status(isEditing ? 200 : 201).json({
      message: isEditing
        ? 'Corrective action updated successfully.'
        : 'Corrective action created successfully.',
      action_id: savedActionId,
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        return next(rollbackError);
      }
    }

    if ([400, 404, 409].includes(error.status)) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    return next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

router.post('/', (req, res, next) => {
  return saveAction(req, res, next, false);
});

router.put('/:id', (req, res, next) => {
  return saveAction(req, res, next, true);
});

module.exports = router;