const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// Get roster assignments with employee and shift details
router.get('/', async (req, res) => {
  try {
    const [rosters] = await pool.query(`
      SELECT
        r.roster_id,
        r.employee_id,
        e.full_name,
        r.shift_type_id,
        s.shift_name,
        s.start_time,
        s.end_time,
        r.shift_date,
        r.status
      FROM shift_roster r
      INNER JOIN employee e
        ON r.employee_id = e.employee_id
      INNER JOIN shift_type s
        ON r.shift_type_id = s.shift_type_id
      ORDER BY r.shift_date DESC, s.start_time
    `);

    res.status(200).json(rosters);
  } catch (error) {
    console.error('Roster list error:', error.code);

    res.status(500).json({
      message: 'Unable to retrieve roster assignments.',
    });
  }
});

// Create a roster assignment
router.post('/', async (req, res) => {
  const {
    employee_id: employeeId,
    shift_type_id: shiftTypeId,
    shift_date: shiftDate,
    status = 'Scheduled',
  } = req.body || {};

  const employeeNumber = Number(employeeId);
  const shiftTypeNumber = Number(shiftTypeId);

  if (
    !Number.isInteger(employeeNumber) ||
    employeeNumber <= 0 ||
    !Number.isInteger(shiftTypeNumber) ||
    shiftTypeNumber <= 0
  ) {
    return res.status(400).json({
      message: 'A valid employee and shift type are required.',
    });
  }

  if (
    typeof shiftDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(shiftDate)
  ) {
    return res.status(400).json({
      message: 'Shift date must use YYYY-MM-DD format.',
    });
  }

  if (!['Scheduled', 'Cancelled', 'Completed'].includes(status)) {
    return res.status(400).json({
      message: 'Invalid roster status.',
    });
  }

  try {
    const [conflicts] = await pool.query(
      `
        SELECT r.roster_id
        FROM shift_roster r
        INNER JOIN shift_type existing_shift
          ON r.shift_type_id = existing_shift.shift_type_id
        INNER JOIN shift_type new_shift
          ON new_shift.shift_type_id = ?
        WHERE r.employee_id = ?
          AND r.shift_date = ?
          AND r.status <> 'Cancelled'
          AND NOT (
            new_shift.end_time <= existing_shift.start_time
            OR new_shift.start_time >= existing_shift.end_time
          )
      `,
      [shiftTypeNumber, employeeNumber, shiftDate],
    );

    if (conflicts.length > 0) {
      return res.status(409).json({
        message: 'This employee already has an overlapping shift on that date.',
      });
    }

    const [result] = await pool.query(
      `
        INSERT INTO shift_roster
          (employee_id, shift_type_id, shift_date, status)
        VALUES (?, ?, ?, ?)
      `,
      [employeeNumber, shiftTypeNumber, shiftDate, status],
    );

    const [rosters] = await pool.query(
      `
        SELECT
          r.roster_id,
          r.employee_id,
          e.full_name,
          r.shift_type_id,
          s.shift_name,
          s.start_time,
          s.end_time,
          r.shift_date,
          r.status
        FROM shift_roster r
        INNER JOIN employee e
          ON r.employee_id = e.employee_id
        INNER JOIN shift_type s
          ON r.shift_type_id = s.shift_type_id
        WHERE r.roster_id = ?
      `,
      [result.insertId],
    );

    res.status(201).json(rosters[0]);
  } catch (error) {
    console.error('Roster create error:', error.code);

    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        message: 'The selected employee or shift type does not exist.',
      });
    }

    res.status(500).json({
      message: 'Unable to create the roster assignment.',
    });
  }
});

module.exports = router;