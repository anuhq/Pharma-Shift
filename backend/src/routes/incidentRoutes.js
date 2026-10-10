const express = require('express');
const pool = require('../config/db');
const {
  requireAuth,
  requireRole,
} = require('../middleware/authMiddleware');

const router = express.Router();

// Authentication is required for every incident route.
// Staff can only use the two explicitly allowed reporting endpoints below.
router.use(requireAuth);

const staffPermission = requireRole('Pharmacist', 'Pharmacy Assistant');

// Staff receive category names only, not manager incident records or category notes.
router.get('/report-categories', staffPermission, async (req, res) => {
  const [categories] = await pool.execute(
    `SELECT category_id, category_name
     FROM incident_category
     ORDER BY category_name, category_id`
  );

  return res.json({ categories });
});

// Staff reports are associated with their own authenticated employee ID.
// Never trust employee_id or status supplied by the browser.
router.post('/report', staffPermission, async (req, res) => {
  const incident = {
    employee_id: req.currentUser.employee_id,
    category_id: req.body?.category_id,
    incident_date: req.body?.incident_date,
    description: req.body?.description,
  };

  const validationError = validateIncident(incident);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const referenceError = await validateReferences(incident);
  if (referenceError) {
    return res.status(400).json({ message: referenceError });
  }

  const [result] = await pool.execute(
    `INSERT INTO staff_incident
       (employee_id, category_id, incident_date, description, status)
     VALUES (?, ?, ?, ?, 'Open')`,
    [
      Number(req.currentUser.employee_id),
      Number(incident.category_id),
      incident.incident_date,
      incident.description.trim(),
    ]
  );

  return res.status(201).json({
    message: 'Incident report submitted successfully.',
    incident_id: result.insertId,
  });
});

// All remaining incident operations are manager-only, including employee
// selection, incident lists, editing, and deletion.
router.use(requireRole('Owner/Manager'));

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
            i.description, i.status,
            DATE_FORMAT(i.follow_up_date, '%Y-%m-%d') AS follow_up_date,
            i.follow_up_notes,
            DATE_FORMAT(i.closure_date, '%Y-%m-%d') AS closure_date,
            (SELECT COUNT(*) FROM investigation inv
             WHERE inv.incident_id = i.incident_id) AS investigation_count,
            (SELECT COUNT(*) FROM investigation inv
             WHERE inv.incident_id = i.incident_id
               AND TRIM(COALESCE(inv.outcome, '')) <> '')
              AS investigation_with_outcome_count,
            (SELECT COUNT(*) FROM corrective_action ca
             WHERE ca.incident_id = i.incident_id) AS corrective_action_count,
            (SELECT COUNT(*) FROM corrective_action ca
             WHERE ca.incident_id = i.incident_id
               AND (ca.status <> 'Completed' OR ca.completed_date IS NULL
                 OR TRIM(COALESCE(ca.follow_up_details, '')) = ''))
              AS unready_action_count
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

// Incident-level follow-up is recorded by a manager after investigation.
// The date and notes stay editable until the incident is closed.
function isValidWorkflowDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    Number(value.slice(0, 4)) >= 1000 &&
    date.toISOString().slice(0, 10) === value;
}

function workflowError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function runIncidentTransaction(res, next, task) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const result = await task(connection);
    await connection.commit();
    return res.status(result.status || 200).json(result.body);
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        return next(rollbackError);
      }
    }
    if ([400, 404, 409].includes(error.status)) {
      return res.status(error.status).json({ message: error.message });
    }
    return next(error);
  } finally {
    if (connection) connection.release();
  }
}

router.put('/:id/follow-up', async (req, res, next) => {
  const incidentId = Number(req.params.id);
  const followUpDate = req.body?.follow_up_date;
  const followUpNotes = req.body?.follow_up_notes;

  if (!Number.isSafeInteger(incidentId) || incidentId < 1) {
    return res.status(400).json({ message: 'Invalid incident ID.' });
  }
  if (!isValidWorkflowDate(followUpDate)) {
    return res.status(400).json({ message: 'Enter a valid follow-up date.' });
  }
  if (typeof followUpNotes !== 'string' || !followUpNotes.trim() ||
      followUpNotes.trim().length > 500) {
    return res.status(400).json({
      message: 'Enter follow-up notes between 1 and 500 characters.',
    });
  }

  return runIncidentTransaction(res, next, async (connection) => {
    // Lock the parent incident so follow-up cannot race with closure.
    const [incidents] = await connection.execute(
      `SELECT status, DATE_FORMAT(incident_date, '%Y-%m-%d') AS incident_date
       FROM staff_incident WHERE incident_id = ? FOR UPDATE`,
      [incidentId],
    );
    if (!incidents.length) throw workflowError(404, 'Incident not found.');
    if (incidents[0].status === 'Closed') {
      throw workflowError(409, 'Closed incidents cannot be changed.');
    }

    const [investigations] = await connection.execute(
      `SELECT DATE_FORMAT(investigation_date, '%Y-%m-%d') AS investigation_date
       FROM investigation WHERE incident_id = ? FOR UPDATE`,
      [incidentId],
    );
    if (!investigations.length) {
      throw workflowError(409, 'Record an investigation before incident follow-up.');
    }

    const [[clock]] = await connection.execute(
      `SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today`,
    );
    if (followUpDate > clock.today) {
      throw workflowError(400, 'Follow-up date cannot be in the future.');
    }
    if (followUpDate < incidents[0].incident_date ||
        followUpDate < investigations[0].investigation_date) {
      throw workflowError(400,
        'Follow-up date cannot be before the incident or investigation date.');
    }

    await connection.execute(
      `UPDATE staff_incident
       SET follow_up_date = ?, follow_up_notes = ?
       WHERE incident_id = ?`,
      [followUpDate, followUpNotes.trim(), incidentId],
    );
    return { body: { message: 'Incident follow-up saved successfully.' } };
  });
});

// Closure is a separate, atomic manager decision. The client cannot choose
// the final status or closure date. Every required check runs under row locks.
router.post('/:id/close', async (req, res, next) => {
  const incidentId = Number(req.params.id);
  if (!Number.isSafeInteger(incidentId) || incidentId < 1) {
    return res.status(400).json({ message: 'Invalid incident ID.' });
  }

  return runIncidentTransaction(res, next, async (connection) => {
    const [incidents] = await connection.execute(
      `SELECT status,
              DATE_FORMAT(incident_date, '%Y-%m-%d') AS incident_date,
              DATE_FORMAT(follow_up_date, '%Y-%m-%d') AS follow_up_date,
              follow_up_notes
       FROM staff_incident WHERE incident_id = ? FOR UPDATE`,
      [incidentId],
    );
    if (!incidents.length) throw workflowError(404, 'Incident not found.');
    const incident = incidents[0];
    if (incident.status === 'Closed') {
      throw workflowError(409, 'This incident is already closed.');
    }

    const [investigations] = await connection.execute(
      `SELECT DATE_FORMAT(investigation_date, '%Y-%m-%d') AS investigation_date,
              outcome
       FROM investigation WHERE incident_id = ? FOR UPDATE`,
      [incidentId],
    );
    if (!investigations.length || !String(investigations[0].outcome || '').trim()) {
      throw workflowError(409,
        'Record an investigation with an outcome before closing the incident.');
    }
    if (!incident.follow_up_date || !String(incident.follow_up_notes || '').trim()) {
      throw workflowError(409,
        'Save the incident follow-up date and notes before closure.');
    }

    const [actions] = await connection.execute(
      `SELECT action_id, status, follow_up_details,
              DATE_FORMAT(completed_date, '%Y-%m-%d') AS completed_date
       FROM corrective_action WHERE incident_id = ? FOR UPDATE`,
      [incidentId],
    );
    const unfinished = actions.find((action) =>
      action.status !== 'Completed' || !action.completed_date ||
      !String(action.follow_up_details || '').trim());
    if (unfinished) {
      throw workflowError(409,
        `Corrective action #${unfinished.action_id} requires manager-verified completion, a completed date and follow-up details.`);
    }

    const [[clock]] = await connection.execute(
      `SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today`,
    );
    if (incident.follow_up_date > clock.today ||
        incident.follow_up_date < incident.incident_date ||
        incident.follow_up_date < investigations[0].investigation_date) {
      throw workflowError(409, 'Check the incident follow-up date before closure.');
    }
    if (actions.some((action) =>
      action.completed_date > incident.follow_up_date ||
      action.completed_date > clock.today)) {
      throw workflowError(409,
        'Follow-up must be dated on or after all corrective actions were completed.');
    }

    await connection.execute(
      `UPDATE staff_incident
       SET status = 'Closed', closure_date = CURDATE()
       WHERE incident_id = ?`,
      [incidentId],
    );
    return {
      body: {
        message: 'Incident closed successfully. The record is now read-only.',
        closure_date: clock.today,
      },
    };
  });
});

// Delete only a new, unlinked incident. Never erase investigation or action history.
router.delete('/:id', async (req, res, next) => {
  const incidentId = Number(req.params.id);

  if (!Number.isSafeInteger(incidentId) || incidentId < 1) {
    return res.status(400).json({ message: 'Invalid incident ID.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Lock the parent row so concurrent linked records cannot bypass the check.
    const [existing] = await connection.execute(
      'SELECT status FROM staff_incident WHERE incident_id = ? FOR UPDATE',
      [incidentId],
    );

    if (!existing.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Incident not found.' });
    }

    if (existing[0].status !== 'Open') {
      await connection.rollback();
      return res.status(409).json({
        message: 'Only Open incidents without follow-up work can be deleted.',
      });
    }

    const [linked] = await connection.execute(
      `SELECT
         (SELECT COUNT(*) FROM investigation WHERE incident_id = ?) AS investigations,
         (SELECT COUNT(*) FROM corrective_action WHERE incident_id = ?) AS actions`,
      [incidentId, incidentId],
    );

    if (linked[0].investigations > 0 || linked[0].actions > 0) {
      await connection.rollback();
      return res.status(409).json({
        message: 'This incident has an investigation or corrective action. Keep it for the audit history.',
      });
    }

    const [result] = await connection.execute(
      'DELETE FROM staff_incident WHERE incident_id = ?',
      [incidentId],
    );

    if (result.affectedRows !== 1) {
      await connection.rollback();
      return res.status(404).json({ message: 'Incident not found.' });
    }

    await connection.commit();
    return res.json({ message: 'Incident deleted successfully.' });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Incident deletion rollback failed:', rollbackError.code || rollbackError.name);
      }
    }
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
      return res.status(409).json({
        message: 'Related investigation or corrective-action records prevent deletion.',
      });
    }
    return next(error);
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;