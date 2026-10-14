const express = require('express');
const pool = require('../config/db');
const {
  requireAuth,
  requireRole,
} = require('../middleware/authMiddleware');
const router = express.Router();

// Check that a roster date is a real calendar date
function isValidRosterDate(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);

  if (year < 1000 || month < 1 || month > 12) {
    return false;
  }

  const daysInMonth = new Date(
    Date.UTC(year, month, 0)
  ).getUTCDate();

  return day >= 1 && day <= daysInMonth;
}

// Lock an employee during roster changes
async function lockEmployee(connection, employeeId) {
  await connection.query(
    'SELECT employee_id FROM employee WHERE employee_id = ? FOR UPDATE',
    [employeeId]
  );
}

// Check Approved leave before assigning a shift
async function hasApprovedLeave(connection, employeeId, shiftTypeId, shiftDate) {
  const [leaveRows] = await connection.query(
    `
      SELECT leave_record.leave_request_id
      FROM leave_request leave_record
      INNER JOIN shift_type target_shift
        ON target_shift.shift_type_id = ?
      WHERE leave_record.employee_id = ?
        AND leave_record.status = 'Approved'
        AND leave_record.start_date <=
          DATE_ADD(
            ?,
            INTERVAL IF(
              target_shift.end_time < target_shift.start_time,
              1,
              0
            ) DAY
          )
        AND leave_record.end_date >= ?
      LIMIT 1
      FOR UPDATE
    `,
    [shiftTypeId, employeeId, shiftDate, shiftDate]
  );

  return leaveRows.length > 0;
}

// Every roster request requires a login
router.use(requireAuth);

// Read only the logged-in employee's assignments
router.get('/me', async (req, res) => {
  const employeeId = Number(req.currentUser.employee_id);

  if (!Number.isSafeInteger(employeeId) || employeeId <= 0) {
    return res.status(403).json({
      message: 'No valid employee account is available.',
    });
  }

  try {
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
          DATE_FORMAT(r.shift_date, '%Y-%m-%d') AS shift_date,
          r.status
        FROM shift_roster r
        INNER JOIN employee e
          ON r.employee_id = e.employee_id
        INNER JOIN shift_type s
          ON r.shift_type_id = s.shift_type_id
        WHERE r.employee_id = ?
        ORDER BY r.shift_date DESC, s.start_time
      `,
      [employeeId],
    );

    return res.status(200).json(rosters);
  } catch (error) {
    console.error('Own roster error:', error.code);

    return res.status(500).json({
      message: 'Unable to retrieve your assigned shifts.',
    });
  }
});

// All routes below this line remain manager-only
router.use(requireRole('Owner/Manager'));

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
        DATE_FORMAT(r.shift_date, '%Y-%m-%d') AS shift_date,
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

// Get assignments for one employee
router.get('/employee/:employeeId', async (req, res) => {
  const employeeId = Number(req.params.employeeId);

  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return res.status(400).json({
      message: 'Employee ID must be a positive number.',
    });
  }

  try {
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
          DATE_FORMAT(r.shift_date, '%Y-%m-%d') AS shift_date,
          r.status
        FROM shift_roster r
        INNER JOIN employee e
          ON r.employee_id = e.employee_id
        INNER JOIN shift_type s
          ON r.shift_type_id = s.shift_type_id
        WHERE r.employee_id = ?
        ORDER BY r.shift_date DESC, s.start_time
      `,
      [employeeId],
    );

    res.status(200).json(rosters);
  } catch (error) {
    console.error('Employee roster error:', error.code);

    res.status(500).json({
      message: 'Unable to retrieve the employee assignments.',
    });
  }
});

// Suggest eligible employees to replace an existing roster assignment
router.get('/:id/replacements', async (req, res) => {
  const rosterId = Number(req.params.id);

  if (
    !/^[1-9]\d*$/.test(req.params.id) ||
    !Number.isSafeInteger(rosterId) ||
    rosterId > 2147483647
  ) {
    return res.status(400).json({
      message: 'Roster ID must be a valid positive integer.',
    });
  }

  try {
    // Find the original assignment and required employee role
    const [rosters] = await pool.query(
      `
        SELECT
          r.roster_id,
          r.employee_id,
          e.role_id,
          r.shift_type_id,
          DATE_FORMAT(r.shift_date, '%Y-%m-%d') AS shift_date,
          r.status,
          s.status AS shift_type_status,
          (r.shift_date < CURDATE()) AS is_past
        FROM shift_roster r
        INNER JOIN employee e
          ON e.employee_id = r.employee_id
        INNER JOIN shift_type s
          ON s.shift_type_id = r.shift_type_id
        WHERE r.roster_id = ?
      `,
      [rosterId]
    );

    if (rosters.length === 0) {
      return res.status(404).json({
        message: 'Roster assignment not found.',
      });
    }

    const original = rosters[0];

    if (
      original.status !== 'Scheduled' ||
      Number(original.is_past) === 1
    ) {
      return res.status(409).json({
        message:
          'Replacement suggestions are available only for current or future Scheduled assignments.',
      });
    }

    if (original.shift_type_status !== 'Active') {
      return res.status(409).json({
        message:
          'The assigned shift type must be Active before selecting a replacement.',
      });
    }

    const shiftDate = original.shift_date;

    // Find active employees with the same role.
    // Exclude overlapping shifts and Approved leave.
    const [candidates] = await pool.query(
      `
        SELECT
          candidate.employee_id,
          candidate.full_name,
          candidate.role_id,
          role_info.role_name
        FROM employee candidate
        INNER JOIN \`role\` role_info
          ON role_info.role_id = candidate.role_id
        INNER JOIN shift_type target_shift
          ON target_shift.shift_type_id = ?
        WHERE candidate.role_id = ?
          AND candidate.employee_id <> ?
          AND candidate.status = 'Active'

          -- Exclude employees with overlapping roster assignments
          AND NOT EXISTS (
            SELECT 1
            FROM shift_roster existing
            INNER JOIN shift_type existing_shift
              ON existing_shift.shift_type_id = existing.shift_type_id
            WHERE existing.employee_id = candidate.employee_id
              AND existing.status <> 'Cancelled'

              AND existing.shift_date BETWEEN
                DATE_SUB(?, INTERVAL 1 DAY)
                AND DATE_ADD(?, INTERVAL 1 DAY)

              AND TIMESTAMP(
                    existing.shift_date,
                    existing_shift.start_time
                  ) <
                  DATE_ADD(
                    TIMESTAMP(?, target_shift.end_time),
                    INTERVAL IF(
                      target_shift.end_time < target_shift.start_time,
                      1,
                      0
                    ) DAY
                  )

              AND DATE_ADD(
                    TIMESTAMP(
                      existing.shift_date,
                      existing_shift.end_time
                    ),
                    INTERVAL IF(
                      existing_shift.end_time < existing_shift.start_time,
                      1,
                      0
                    ) DAY
                  ) >
                  TIMESTAMP(?, target_shift.start_time)
          )

          -- Approved leave must not overlap any day of the shift
          AND NOT EXISTS (
            SELECT 1
            FROM leave_request leave_record
            WHERE leave_record.employee_id = candidate.employee_id
              AND leave_record.status = 'Approved'
              AND leave_record.start_date <=
                DATE_ADD(
                  ?,
                  INTERVAL IF(
                    target_shift.end_time < target_shift.start_time,
                    1,
                    0
                  ) DAY
                )
              AND leave_record.end_date >= ?
          )

        ORDER BY candidate.full_name, candidate.employee_id
      `,
      [
        original.shift_type_id,
        original.role_id,
        original.employee_id,
        shiftDate,
        shiftDate,
        shiftDate,
        shiftDate,
        shiftDate,
        shiftDate,
      ]
    );

    return res.status(200).json({
      roster_id: original.roster_id,
      shift_date: shiftDate,
      candidates,
    });

  } catch (error) {
    console.error('Replacement suggestions error:', error.code);

    return res.status(500).json({
      message: 'Unable to retrieve replacement suggestions.',
    });
  }
});

// Confirm a replacement while preserving the original assignment
router.post('/:id/replace', async (req, res) => {
  const rosterId = Number(req.params.id);
  const candidateValue = req.body?.replacement_employee_id;
  const candidateId = Number(candidateValue);

  if (
    !/^[1-9]\d*$/.test(req.params.id) ||
    !Number.isSafeInteger(rosterId) ||
    rosterId > 2147483647
  ) {
    return res.status(400).json({
      message: 'Roster ID must be a valid positive integer.',
    });
  }

  if (
    !/^[1-9]\d*$/.test(String(candidateValue)) ||
    !Number.isSafeInteger(candidateId) ||
    candidateId > 2147483647
  ) {
    return res.status(400).json({
      message: 'Select a valid replacement employee.',
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    await lockEmployee(connection, candidateId);

    // Lock the original assignment so it cannot be replaced twice.
    const [originalRows] = await connection.query(
      `
        SELECT
          r.roster_id,
          r.employee_id,
          e.role_id,
          r.shift_type_id,
          DATE_FORMAT(r.shift_date, '%Y-%m-%d') AS shift_date,
          r.status,
          (r.shift_date < CURDATE()) AS is_past
        FROM shift_roster r
        INNER JOIN employee e
          ON e.employee_id = r.employee_id
        WHERE r.roster_id = ?
        FOR UPDATE
      `,
      [rosterId]
    );

    if (originalRows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        message: 'Roster assignment not found.',
      });
    }

    const original = originalRows[0];

    if (
      original.status !== 'Scheduled' ||
      Number(original.is_past) === 1
    ) {
      await connection.rollback();

      return res.status(409).json({
        message:
          'Only current or future Scheduled assignments can be replaced.',
      });
    }

    if (candidateId === Number(original.employee_id)) {
      await connection.rollback();

      return res.status(400).json({
        message:
          'Select a different employee as the replacement.',
      });
    }

    // Lock the replacement employee and shift type.
    // Uses the same employee-locking approach as roster creation.
    const [eligible] = await connection.query(
      `
        SELECT candidate.employee_id
        FROM employee candidate
        INNER JOIN shift_type selected_shift
          ON selected_shift.shift_type_id = ?
        WHERE candidate.employee_id = ?
          AND candidate.role_id = ?
          AND candidate.status = 'Active'
          AND selected_shift.status = 'Active'
        LIMIT 1
        FOR UPDATE
      `,
      [
        original.shift_type_id,
        candidateId,
        original.role_id,
      ]
    );

    if (eligible.length === 0) {
      await connection.rollback();

      return res.status(400).json({
        message:
          'Replacement employee must be Active and have the required role.',
      });
    }

    const shiftDate = original.shift_date;

    // Recheck overlapping shifts, including overnight shifts.
    const [conflicts] = await connection.query(
      `
        SELECT existing.roster_id
        FROM shift_roster existing
        INNER JOIN shift_type existing_shift
          ON existing_shift.shift_type_id =
             existing.shift_type_id
        INNER JOIN shift_type target_shift
          ON target_shift.shift_type_id = ?
        WHERE existing.employee_id = ?
          AND existing.status <> 'Cancelled'
          AND existing.shift_date BETWEEN
              DATE_SUB(?, INTERVAL 1 DAY)
              AND DATE_ADD(?, INTERVAL 1 DAY)

          AND TIMESTAMP(
                existing.shift_date,
                existing_shift.start_time
              ) <
              DATE_ADD(
                TIMESTAMP(?, target_shift.end_time),
                INTERVAL IF(
                  target_shift.end_time < target_shift.start_time,
                  1,
                  0
                ) DAY
              )

          AND DATE_ADD(
                TIMESTAMP(
                  existing.shift_date,
                  existing_shift.end_time
                ),
                INTERVAL IF(
                  existing_shift.end_time < existing_shift.start_time,
                  1,
                  0
                ) DAY
              ) >
              TIMESTAMP(?, target_shift.start_time)

        LIMIT 1
      `,
      [
        original.shift_type_id,
        candidateId,
        shiftDate,
        shiftDate,
        shiftDate,
        shiftDate,
      ]
    );

    if (conflicts.length > 0) {
      await connection.rollback();

      return res.status(409).json({
        message:
          'The replacement employee has an overlapping shift.',
      });
    }

    // Check real Approved leave, including an overnight end date.
    const [approvedLeave] = await connection.query(
      `
        SELECT leave_record.leave_request_id
        FROM leave_request leave_record
        INNER JOIN shift_type target_shift
          ON target_shift.shift_type_id = ?
        WHERE leave_record.employee_id = ?
          AND leave_record.status = 'Approved'
          AND leave_record.start_date <=
              DATE_ADD(
                ?,
                INTERVAL IF(
                  target_shift.end_time < target_shift.start_time,
                  1,
                  0
                ) DAY
              )
          AND leave_record.end_date >= ?
          LIMIT 1
          FOR UPDATE
      `,
      [
        original.shift_type_id,
        candidateId,
        shiftDate,
        shiftDate,
      ]
    );

    if (approvedLeave.length > 0) {
      await connection.rollback();

      return res.status(409).json({
        message:
          'The replacement employee has Approved leave during this shift.',
      });
    }

    // Preserve the original assignment as Cancelled.
    const [cancelResult] = await connection.query(
      `
        UPDATE shift_roster
        SET status = 'Cancelled'
        WHERE roster_id = ?
          AND status = 'Scheduled'
      `,
      [rosterId]
    );

    if (cancelResult.affectedRows !== 1) {
      await connection.rollback();

      return res.status(409).json({
        message:
          'The original assignment is no longer available.',
      });
    }

    // Create a new Scheduled assignment for the replacement.
    const [insertResult] = await connection.query(
      `
        INSERT INTO shift_roster
          (employee_id, shift_type_id, shift_date, status)
        VALUES (?, ?, ?, 'Scheduled')
      `,
      [
        candidateId,
        original.shift_type_id,
        shiftDate,
      ]
    );

    const [newAssignments] = await connection.query(
      `
        SELECT
          r.roster_id,
          r.employee_id,
          e.full_name,
          r.shift_type_id,
          s.shift_name,
          s.start_time,
          s.end_time,
          DATE_FORMAT(r.shift_date, '%Y-%m-%d') AS shift_date,
          r.status
        FROM shift_roster r
        INNER JOIN employee e
          ON e.employee_id = r.employee_id
        INNER JOIN shift_type s
          ON s.shift_type_id = r.shift_type_id
        WHERE r.roster_id = ?
      `,
      [insertResult.insertId]
    );

    await connection.commit();

    return res.status(201).json({
      message: 'Replacement assigned successfully.',
      cancelled_roster_id: rosterId,
      replacement_roster: newAssignments[0],
    });

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Replacement rollback error:',
          rollbackError.code
        );
      }
    }

    if (
      error.code === 'ER_LOCK_DEADLOCK' ||
      error.code === 'ER_LOCK_WAIT_TIMEOUT'
    ) {
      return res.status(409).json({
        message:
          'Another roster change is in progress. Please try again.',
      });
    }

    console.error('Replacement confirmation error:', error.code);

    return res.status(500).json({
      message: 'Unable to confirm the replacement.',
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Create a roster assignment safely
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
    !Number.isSafeInteger(employeeNumber) ||
    employeeNumber <= 0 ||
    !Number.isSafeInteger(shiftTypeNumber) ||
    shiftTypeNumber <= 0
  ) {
    return res.status(400).json({
      message: 'A valid employee and shift type are required.',
    });
  }

  if (!isValidRosterDate(shiftDate)) {
    return res.status(400).json({
      message:
        'Shift date must be a valid calendar date in YYYY-MM-DD format.',
    });
  }

    if (status !== 'Scheduled') {
    return res.status(400).json({
      message: 'New roster assignments must have Scheduled status.',
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
      await connection.beginTransaction();

      const [[dateCheck]] = await connection.query(
        'SELECT DATE(?) < CURDATE() AS is_past',
        [shiftDate]
      );

      if (Number(dateCheck.is_past) === 1) {
        await connection.rollback();
        return res.status(400).json({
          message: 'Shift date cannot be earlier than today.',
        });
      }

      await lockEmployee(connection, employeeNumber);

    // Lock the employee and shift type during scheduling.
    // Other roster requests for this employee must wait.
    const [available] = await connection.query(
      `
        SELECT e.employee_id
        FROM employee e
        INNER JOIN shift_type s
          ON s.shift_type_id = ?
        WHERE e.employee_id = ?
          AND e.status = 'Active'
          AND s.status = 'Active'
        LIMIT 1
        FOR UPDATE
      `,
      [shiftTypeNumber, employeeNumber]
    );

    if (available.length === 0) {
      await connection.rollback();

      return res.status(400).json({
        message:
          'Only active employees can be assigned to active shift types.',
      });
    }

    // Check overlaps, including shifts crossing midnight.
    const [conflicts] = await connection.query(
      `
        SELECT r.roster_id
        FROM shift_roster r
        INNER JOIN shift_type existing_shift
          ON r.shift_type_id = existing_shift.shift_type_id
        INNER JOIN shift_type new_shift
          ON new_shift.shift_type_id = ?
        WHERE r.employee_id = ?
          AND r.status <> 'Cancelled'
          AND r.shift_date BETWEEN
              DATE_SUB(?, INTERVAL 1 DAY)
              AND DATE_ADD(?, INTERVAL 1 DAY)

          AND TIMESTAMP(
                r.shift_date,
                existing_shift.start_time
              ) <
              DATE_ADD(
                TIMESTAMP(?, new_shift.end_time),
                INTERVAL IF(
                  new_shift.end_time < new_shift.start_time,
                  1,
                  0
                ) DAY
              )

          AND DATE_ADD(
                TIMESTAMP(
                  r.shift_date,
                  existing_shift.end_time
                ),
                INTERVAL IF(
                  existing_shift.end_time < existing_shift.start_time,
                  1,
                  0
                ) DAY
              ) >
              TIMESTAMP(?, new_shift.start_time)
      `,
      [
        shiftTypeNumber,
        employeeNumber,
        shiftDate,
        shiftDate,
        shiftDate,
        shiftDate,
      ]
    );

    if (conflicts.length > 0) {
      await connection.rollback();

      return res.status(409).json({
        message:
          'This employee already has an overlapping shift on that date.',
      });
    }

    // Prevent assignment during Approved leave
      const leaveConflict = await hasApprovedLeave(
        connection,
        employeeNumber,
        shiftTypeNumber,
        shiftDate
      );

      if (leaveConflict) {
        await connection.rollback();

        return res.status(409).json({
          message: 'This employee has Approved leave during this shift.',
        });
      }


    // Insert using the same locked database transaction.
    const [result] = await connection.query(
      `
        INSERT INTO shift_roster
          (employee_id, shift_type_id, shift_date, status)
        VALUES (?, ?, ?, ?)
      `,
      [employeeNumber, shiftTypeNumber, shiftDate, status]
    );

    const [rosters] = await connection.query(
      `
        SELECT
          r.roster_id,
          r.employee_id,
          e.full_name,
          r.shift_type_id,
          s.shift_name,
          s.start_time,
          s.end_time,
          DATE_FORMAT(r.shift_date, '%Y-%m-%d') AS shift_date,
          r.status
        FROM shift_roster r
        INNER JOIN employee e
          ON r.employee_id = e.employee_id
        INNER JOIN shift_type s
          ON r.shift_type_id = s.shift_type_id
        WHERE r.roster_id = ?
      `,
      [result.insertId]
    );

    await connection.commit();

    return res.status(201).json(rosters[0]);

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Roster create rollback error:',
          rollbackError.code
        );
      }
    }

    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        message:
          'The selected employee or shift type does not exist.',
      });
    }

    if (
        error.code === 'ER_LOCK_DEADLOCK' ||
        error.code === 'ER_LOCK_WAIT_TIMEOUT'
      ) {
        return res.status(409).json({
          message: 'Another roster change is in progress. Please try again.',
        });
      }

    console.error('Roster create error:', error.code);

    return res.status(500).json({
      message: 'Unable to create the roster assignment.',
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Edit an existing scheduled roster assignment
router.put('/:id', async (req, res) => {
  const rosterId = Number(req.params.id);

  const {
    employee_id: employeeId,
    shift_type_id: shiftTypeId,
    shift_date: shiftDate,
  } = req.body || {};

  const employeeNumber = Number(employeeId);
  const shiftTypeNumber = Number(shiftTypeId);

  if (
    !/^\d+$/.test(req.params.id) ||
    !Number.isSafeInteger(rosterId) ||
    rosterId <= 0
  ) {
    return res.status(400).json({
      message: 'Roster ID must be a valid positive integer.',
    });
  }

  if (
    !Number.isSafeInteger(employeeNumber) ||
    employeeNumber <= 0 ||
    !Number.isSafeInteger(shiftTypeNumber) ||
    shiftTypeNumber <= 0
  ) {
    return res.status(400).json({
      message: 'A valid employee and shift type are required.',
    });
  }

  if (!isValidRosterDate(shiftDate)) {
    return res.status(400).json({
      message:
        'Shift date must be a valid calendar date in YYYY-MM-DD format.',
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [[dateCheck]] = await connection.query(
      'SELECT DATE(?) < CURDATE() AS is_past',
      [shiftDate]
    );

    if (Number(dateCheck.is_past) === 1) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Shift date cannot be earlier than today.',
      });
    }

    await lockEmployee(connection, employeeNumber);

    // Lock the assignment being edited
       const [existing] = await connection.query(
      `
        SELECT
          roster_id,
          status,
          (shift_date < CURDATE()) AS is_past
        FROM shift_roster
        WHERE roster_id = ?
        FOR UPDATE
      `,
      [rosterId]
    );

    if (existing.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        message: 'Roster assignment not found.',
      });
    }

    // Preserve cancelled and completed roster history
       if (
      existing[0].status !== 'Scheduled' ||
      Number(existing[0].is_past) === 1
    ) {
      await connection.rollback();

      return res.status(409).json({
        message:
          'Only current or future Scheduled roster assignments can be edited.',
      });
    }

    // Check employee and shift availability
    // Lock the selected employee during roster editing.
    // This uses the same locking rule as Create Roster.
    const [available] = await connection.query(
      `
        SELECT e.employee_id
        FROM employee e
        INNER JOIN shift_type s
          ON s.shift_type_id = ?
        WHERE e.employee_id = ?
          AND e.status = 'Active'
          AND s.status = 'Active'
        LIMIT 1
        FOR UPDATE
      `,
      [shiftTypeNumber, employeeNumber]
    );

    if (available.length === 0) {
      await connection.rollback();

      return res.status(400).json({
        message:
          'Only active employees can be assigned to active shift types.',
      });
    }

    // Check overlapping shifts, excluding the roster being edited
    const [conflicts] = await connection.query(
      `
        SELECT r.roster_id
        FROM shift_roster r
        INNER JOIN shift_type existing_shift
          ON r.shift_type_id = existing_shift.shift_type_id
        INNER JOIN shift_type new_shift
          ON new_shift.shift_type_id = ?
        WHERE r.employee_id = ?
          AND r.roster_id <> ?
          AND r.status <> 'Cancelled'
          AND r.shift_date BETWEEN
              DATE_SUB(?, INTERVAL 1 DAY)
              AND DATE_ADD(?, INTERVAL 1 DAY)
          AND TIMESTAMP(
                r.shift_date,
                existing_shift.start_time
              ) <
              DATE_ADD(
                TIMESTAMP(?, new_shift.end_time),
                INTERVAL IF(
                  new_shift.end_time < new_shift.start_time,
                  1,
                  0
                ) DAY
              )
          AND DATE_ADD(
                TIMESTAMP(
                  r.shift_date,
                  existing_shift.end_time
                ),
                INTERVAL IF(
                  existing_shift.end_time < existing_shift.start_time,
                  1,
                  0
                ) DAY
              ) >
              TIMESTAMP(?, new_shift.start_time)
      `,
      [
        shiftTypeNumber,
        employeeNumber,
        rosterId,
        shiftDate,
        shiftDate,
        shiftDate,
        shiftDate,
      ]
    );

    if (conflicts.length > 0) {
      await connection.rollback();

      return res.status(409).json({
        message:
          'This employee already has an overlapping shift on that date.',
      });
    }

    // Prevent assignment during Approved leave
      const leaveConflict = await hasApprovedLeave(
        connection,
        employeeNumber,
        shiftTypeNumber,
        shiftDate
      );

      if (leaveConflict) {
        await connection.rollback();

        return res.status(409).json({
          message: 'This employee has Approved leave during this shift.',
        });
      }

    // Update the scheduled assignment
    await connection.query(
      `
        UPDATE shift_roster
        SET employee_id = ?,
            shift_type_id = ?,
            shift_date = ?
        WHERE roster_id = ?
      `,
      [
        employeeNumber,
        shiftTypeNumber,
        shiftDate,
        rosterId,
      ]
    );

    const [updated] = await connection.query(
      `
        SELECT
          r.roster_id,
          r.employee_id,
          e.full_name,
          r.shift_type_id,
          s.shift_name,
          s.start_time,
          s.end_time,
          DATE_FORMAT(r.shift_date, '%Y-%m-%d') AS shift_date,
          r.status
        FROM shift_roster r
        INNER JOIN employee e
          ON r.employee_id = e.employee_id
        INNER JOIN shift_type s
          ON r.shift_type_id = s.shift_type_id
        WHERE r.roster_id = ?
      `,
      [rosterId]
    );

    await connection.commit();

    return res.status(200).json(updated[0]);

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Roster rollback error:', rollbackError.code);
      }
    }

    if (
        error.code === 'ER_LOCK_DEADLOCK' ||
        error.code === 'ER_LOCK_WAIT_TIMEOUT'
      ) {
        return res.status(409).json({
          message: 'Another roster change is in progress. Please try again.',
        });
      }

    console.error('Roster update error:', error.code);

    return res.status(500).json({
      message: 'Unable to update the roster assignment.',
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Cancel a scheduled roster assignment while preserving history
router.patch('/:id/cancel', async (req, res) => {
  const rosterId = Number(req.params.id);

  if (
    !/^[1-9]\d*$/.test(req.params.id) ||
    !Number.isSafeInteger(rosterId)
  ) {
    return res.status(400).json({
      message: 'Roster ID must be a valid positive integer.',
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

      const [existing] = await connection.query(
      `
        SELECT
          roster_id,
          status,
          (shift_date < CURDATE()) AS is_past
        FROM shift_roster
        WHERE roster_id = ?
        FOR UPDATE
      `,
      [rosterId]
    );

    if (existing.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        message: 'Roster assignment not found.',
      });
    }

        if (
      existing[0].status !== 'Scheduled' ||
      Number(existing[0].is_past) === 1
    ) {
      await connection.rollback();

      return res.status(409).json({
        message:
          'Only current or future Scheduled assignments can be cancelled.',
      });
    }

    await connection.query(
      `
        UPDATE shift_roster
        SET status = 'Cancelled'
        WHERE roster_id = ?
      `,
      [rosterId]
    );

    const [updated] = await connection.query(
      `
        SELECT
          r.roster_id,
          r.employee_id,
          e.full_name,
          r.shift_type_id,
          s.shift_name,
          s.start_time,
          s.end_time,
          DATE_FORMAT(r.shift_date, '%Y-%m-%d') AS shift_date,
          r.status
        FROM shift_roster r
        INNER JOIN employee e
          ON r.employee_id = e.employee_id
        INNER JOIN shift_type s
          ON r.shift_type_id = s.shift_type_id
        WHERE r.roster_id = ?
      `,
      [rosterId]
    );

    await connection.commit();

    return res.status(200).json(updated[0]);

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Roster cancel rollback error:', rollbackError.code);
      }
    }

    console.error('Roster cancel error:', error.code);

    return res.status(500).json({
      message: 'Unable to cancel the roster assignment.',
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Permanently delete an eligible future roster assignment
router.delete('/:id', async (req, res) => {
  const rosterId = Number(req.params.id);

  if (
    !/^[1-9]\d*$/.test(req.params.id) ||
    !Number.isSafeInteger(rosterId)
  ) {
    return res.status(400).json({
      message: 'Roster ID must be a valid positive integer.',
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Lock the roster record before checking deletion rules
    const [records] = await connection.query(
      `
        SELECT
          roster_id,
          status,
          (shift_date > CURDATE()) AS is_future
        FROM shift_roster
        WHERE roster_id = ?
        FOR UPDATE
      `,
      [rosterId]
    );

    if (records.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        message: 'Roster assignment not found.',
      });
    }

    const roster = records[0];

    // Preserve historical and completed assignments
    if (
      !['Scheduled', 'Cancelled'].includes(roster.status) ||
      Number(roster.is_future) !== 1
    ) {
      await connection.rollback();

      return res.status(409).json({
        message:
          'Only future Scheduled or Cancelled roster assignments can be permanently deleted.',
      });
    }

    const [result] = await connection.query(
      'DELETE FROM shift_roster WHERE roster_id = ?',
      [rosterId]
    );

    if (result.affectedRows !== 1) {
      await connection.rollback();

      return res.status(409).json({
        message: 'Roster deletion could not be completed.',
      });
    }

    await connection.commit();

    return res.status(200).json({
      message: 'Roster assignment deleted successfully.',
    });

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Roster delete rollback error:', rollbackError.code);
      }
    }

    if (
      error.code === 'ER_ROW_IS_REFERENCED_2' ||
      error.code === 'ER_ROW_IS_REFERENCED'
    ) {
      return res.status(409).json({
        message:
          'This roster assignment is linked to another record and cannot be deleted.',
      });
    }

    console.error('Roster delete error:', error.code);

    return res.status(500).json({
      message: 'Unable to delete the roster assignment.',
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;