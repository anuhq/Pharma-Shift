const express = require('express');
const pool = require('../config/db');
const {
  requireAuth,
  requireRole,
} = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth, requireRole('Owner/Manager'));

function validateInvestigation(body) {
  const incidentId = Number(body?.incident_id);

  if (!Number.isSafeInteger(incidentId) || incidentId < 1) {
    return 'Choose an incident.';
  }

  const date = body?.investigation_date;

  if (
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    return 'Enter a valid investigation date.';
  }

  const parsedDate = new Date(`${date}T00:00:00Z`);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    Number(date.slice(0, 4)) < 1000 ||
    parsedDate.toISOString().slice(0, 10) !== date
  ) {
    return 'Enter a valid investigation date.';
  }

  if (
    typeof body?.findings !== 'string' ||
    !body.findings.trim() ||
    body.findings.trim().length > 500
  ) {
    return 'Enter findings between 1 and 500 characters.';
  }

  if (
    body.outcome != null &&
    (typeof body.outcome !== 'string' ||
      body.outcome.trim().length > 255)
  ) {
    return 'Outcome must be 255 characters or fewer.';
  }

  return null;
}

function requestError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Read investigations with related incident details.
router.get('/', async (req, res, next) => {
  try {
    const [investigations] = await pool.execute(
      `SELECT inv.investigation_id, inv.incident_id,
              e.full_name, c.category_name,
              DATE_FORMAT(i.incident_date, '%Y-%m-%d')
                AS incident_date,
              DATE_FORMAT(inv.investigation_date, '%Y-%m-%d')
                AS investigation_date,
              inv.findings, inv.outcome,
              i.status AS incident_status
       FROM investigation inv
       JOIN staff_incident i
         ON i.incident_id = inv.incident_id
       JOIN employee e
         ON e.employee_id = i.employee_id
       JOIN incident_category c
         ON c.category_id = i.category_id
       ORDER BY inv.investigation_date DESC,
                inv.investigation_id DESC`
    );

    res.json({ investigations });
  } catch (error) {
    next(error);
  }
});

// Create or update an investigation.
// A transaction saves the investigation and status together.
async function saveInvestigation(req, res, next, isEditing) {
  const id = isEditing ? Number(req.params.id) : null;

  if (isEditing && (!Number.isSafeInteger(id) || id < 1)) {
    return res.status(400).json({
      message: 'Invalid investigation ID.',
    });
  }

  const validationError = validateInvestigation(req.body);

  if (validationError) {
    return res.status(400).json({
      message: validationError,
    });
  }

  const incidentId = Number(req.body.incident_id);
  const date = req.body.investigation_date;
  const findings = req.body.findings.trim();
  const outcome = req.body.outcome?.trim() || null;

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Lock the incident while checking and saving its investigation.
    const [incidents] = await connection.execute(
      `SELECT incident_id, status,
              DATE_FORMAT(incident_date, '%Y-%m-%d')
                AS incident_date
       FROM staff_incident
       WHERE incident_id = ?
       FOR UPDATE`,
      [incidentId]
    );

    if (!incidents.length) {
      throw requestError(404, 'Incident not found.');
    }

    const incident = incidents[0];

    if (String(incident.status).toLowerCase() === 'closed') {
      throw requestError(
        409,
        'Investigations for closed incidents cannot be changed.'
      );
    }

    if (date < incident.incident_date) {
      throw requestError(
        400,
        'Investigation date cannot be before the incident date.'
      );
    }

    let investigationId = id;

    if (isEditing) {
      const [existing] = await connection.execute(
        `SELECT investigation_id, incident_id
         FROM investigation
         WHERE investigation_id = ?
         FOR UPDATE`,
        [id]
      );

      if (!existing.length) {
        throw requestError(404, 'Investigation not found.');
      }

      if (Number(existing[0].incident_id) !== incidentId) {
        throw requestError(
          400,
          'The incident linked to an investigation cannot be changed.'
        );
      }

      await connection.execute(
        `UPDATE investigation
         SET investigation_date = ?, findings = ?, outcome = ?
         WHERE investigation_id = ?`,
        [date, findings, outcome, id]
      );
    } else {
      const [existing] = await connection.execute(
        `SELECT investigation_id
         FROM investigation
         WHERE incident_id = ?
         FOR UPDATE`,
        [incidentId]
      );

      if (existing.length) {
        throw requestError(
          409,
          'This incident already has an investigation. Edit that record.'
        );
      }

      const [result] = await connection.execute(
        `INSERT INTO investigation
           (incident_id, investigation_date, findings, outcome)
         VALUES (?, ?, ?, ?)`,
        [incidentId, date, findings, outcome]
      );

      investigationId = result.insertId;

      if (String(incident.status).toLowerCase() === 'open') {
        await connection.execute(
          `UPDATE staff_incident
           SET status = 'Under Investigation'
           WHERE incident_id = ?`,
          [incidentId]
        );
      }
    }

    await connection.commit();

    return res.status(isEditing ? 200 : 201).json({
      message: isEditing
        ? 'Investigation updated successfully.'
        : 'Investigation recorded successfully.',
      investigation_id: investigationId,
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        return next(rollbackError);
      }
    }

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message:
          'This incident already has an investigation. Edit that record.',
      });
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
  return saveInvestigation(req, res, next, false);
});

router.put('/:id', (req, res, next) => {
  return saveInvestigation(req, res, next, true);
});

module.exports = router;