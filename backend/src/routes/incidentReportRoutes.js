const express = require('express');
const pool = require('../config/db');

// Mounted *after* requireAuth and requireRole('Owner/Manager') in incidentRoutes.
// Reports are generated from MySQL, never from frontend demonstration arrays.
const router = express.Router();
const ROW_LIMIT = 500;
const INCIDENT_STATUSES = ['Open', 'Under Investigation', 'Closed'];
const ACTION_STATUSES = ['Pending', 'In Progress', 'Completed', 'Cancelled'];

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
    Number(value.slice(0, 4)) >= 1000 &&
    parsed.toISOString().slice(0, 10) === value;
}

function optionalId(value) {
  if (value === undefined || value === '') return null;
  // Require strictly numeric IDs, rather than accepting booleans or decimals.
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return NaN;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : NaN;
}

function optionalStatus(value, allowed) {
  if (value === undefined || value === '') return '';
  return typeof value === 'string' && allowed.includes(value) ? value : null;
}

router.get('/', async (req, res, next) => {
  const fromDate = req.query.from_date;
  const toDate = req.query.to_date;
  if (!validDate(fromDate) || !validDate(toDate)) {
    return res.status(400).json({ message: 'Choose valid From and To dates.' });
  }
  if (fromDate > toDate) {
    return res.status(400).json({ message: 'From date cannot be after To date.' });
  }

  const employeeId = optionalId(req.query.employee_id);
  const categoryId = optionalId(req.query.category_id);
  const incidentStatus = optionalStatus(req.query.incident_status, INCIDENT_STATUSES);
  const actionStatus = optionalStatus(req.query.action_status, ACTION_STATUSES);
  if (Number.isNaN(employeeId) || Number.isNaN(categoryId) ||
      incidentStatus === null || actionStatus === null) {
    return res.status(400).json({ message: 'Choose valid report filters.' });
  }

  // All dynamic values are SQL parameters. The optional SQL clauses themselves
  // are fixed trusted strings. Date filters refer to INCIDENT DATE for both tables.
  const incidentConditions = ['i.incident_date BETWEEN ? AND ?'];
  const incidentParams = [fromDate, toDate];
  if (employeeId !== null) {
    incidentConditions.push('i.employee_id = ?');
    incidentParams.push(employeeId);
  }
  if (categoryId !== null) {
    incidentConditions.push('i.category_id = ?');
    incidentParams.push(categoryId);
  }
  if (incidentStatus) {
    incidentConditions.push('i.status = ?');
    incidentParams.push(incidentStatus);
  }
  const incidentWhere = incidentConditions.join(' AND ');
  const actionConditions = [...incidentConditions];
  const actionParams = [...incidentParams];
  if (actionStatus) {
    actionConditions.push('ca.status = ?');
    actionParams.push(actionStatus);
  }
  const actionWhere = actionConditions.join(' AND ');

  try {
    const [[incidentCounts], [categoryCounts], [actionCounts],
      [incidentRows], [actionRows]] = await Promise.all([
      pool.execute(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(i.status = 'Open'), 0) AS open_count,
                COALESCE(SUM(i.status = 'Under Investigation'), 0) AS investigating_count,
                COALESCE(SUM(i.status = 'Closed'), 0) AS closed_count
         FROM staff_incident i WHERE ${incidentWhere}`,
        incidentParams,
      ),
      pool.execute(
        `SELECT c.category_id, c.category_name, c.severity_level, COUNT(*) AS incident_count
         FROM staff_incident i
         JOIN incident_category c ON c.category_id = i.category_id
         WHERE ${incidentWhere}
         GROUP BY c.category_id, c.category_name, c.severity_level
         ORDER BY incident_count DESC, c.category_name`,
        incidentParams,
      ),
      pool.execute(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(ca.status = 'Pending'), 0) AS pending_count,
                COALESCE(SUM(ca.status = 'In Progress'), 0) AS in_progress_count,
                COALESCE(SUM(ca.status = 'Completed'), 0) AS completed_count,
                COALESCE(SUM(ca.status = 'Cancelled'), 0) AS cancelled_count,
                COALESCE(SUM(ca.due_date < CURDATE() AND
                  ca.status IN ('Pending', 'In Progress')), 0) AS overdue_count
         FROM corrective_action ca
         JOIN staff_incident i ON i.incident_id = ca.incident_id
         WHERE ${actionWhere}`,
        actionParams,
      ),
      pool.execute(
        `SELECT i.incident_id, i.employee_id, e.full_name,
                c.category_name, c.severity_level,
                DATE_FORMAT(i.incident_date, '%Y-%m-%d') AS incident_date,
                i.description, i.status,
                DATE_FORMAT(i.follow_up_date, '%Y-%m-%d') AS follow_up_date,
                i.follow_up_notes,
                DATE_FORMAT(i.closure_date, '%Y-%m-%d') AS closure_date
         FROM staff_incident i
         JOIN employee e ON e.employee_id = i.employee_id
         JOIN incident_category c ON c.category_id = i.category_id
         WHERE ${incidentWhere}
         ORDER BY i.incident_date DESC, i.incident_id DESC
         LIMIT ${ROW_LIMIT}`,
        incidentParams,
      ),
      pool.execute(
        `SELECT ca.action_id, ca.incident_id,
                DATE_FORMAT(i.incident_date, '%Y-%m-%d') AS incident_date,
                owner.full_name AS incident_employee,
                assignee.full_name AS assigned_employee,
                c.category_name,
                ca.action_description,
                DATE_FORMAT(ca.due_date, '%Y-%m-%d') AS due_date,
                ca.status,
                DATE_FORMAT(ca.completed_date, '%Y-%m-%d') AS completed_date,
                ca.staff_completion_feedback, ca.follow_up_details
         FROM corrective_action ca
         JOIN staff_incident i ON i.incident_id = ca.incident_id
         JOIN employee owner ON owner.employee_id = i.employee_id
         JOIN employee assignee ON assignee.employee_id = ca.assigned_employee_id
         JOIN incident_category c ON c.category_id = i.category_id
         WHERE ${actionWhere}
         ORDER BY ca.due_date DESC, ca.action_id DESC
         LIMIT ${ROW_LIMIT}`,
        actionParams,
      ),
    ]);

    return res.json({
      from_date: fromDate,
      to_date: toDate,
      basis: 'Incident date (inclusive); corrective actions are linked to the filtered incidents.',
      row_limit: ROW_LIMIT,
      incident_summary: incidentCounts[0],
      action_summary: actionCounts[0],
      categories: categoryCounts,
      incidents: incidentRows,
      actions: actionRows,
      incidents_truncated: Number(incidentCounts[0].total) > incidentRows.length,
      actions_truncated: Number(actionCounts[0].total) > actionRows.length,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
