const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// Validate a real 24-hour clock time (HH:MM)
function isValidClockTime(value) {
  return (
    typeof value === 'string' &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
  );
}

// Get all shift types
router.get('/', async (req, res) => {
  try {
    const [shiftTypes] = await pool.query(`
      SELECT
        shift_type_id,
        shift_name,
        start_time,
        end_time,
        status
      FROM shift_type
      ORDER BY start_time, shift_type_id
    `);

    res.status(200).json(shiftTypes);
  } catch (error) {
    console.error('Shift type list error:', error.code);

    res.status(500).json({
      message: 'Unable to retrieve shift types.',
    });
  }
});

// Create a shift type
router.post('/', async (req, res) => {
  const {
    shift_name: shiftName,
    start_time: startTime,
    end_time: endTime,
    status = 'Active',
  } = req.body || {};

  if (
    typeof shiftName !== 'string' ||
    shiftName.trim().length < 2 ||
    shiftName.trim().length > 50
  ) {
    return res.status(400).json({
      message: 'Shift name must contain 2 to 50 characters.',
    });
  }

  if (!isValidClockTime(startTime) || !isValidClockTime(endTime)) {
    return res.status(400).json({
      message: 'Start time and end time must be valid 24-hour times in HH:MM format.',
    });
  }

  if (startTime === endTime) {
    return res.status(400).json({
      message: 'Start time and end time cannot be the same.',
    });
  }

  if (!['Active', 'Inactive'].includes(status)) {
    return res.status(400).json({
      message: 'Status must be Active or Inactive.',
    });
  }

  try {
    const [result] = await pool.query(
      `
        INSERT INTO shift_type
          (shift_name, start_time, end_time, status)
        VALUES (?, ?, ?, ?)
      `,
      [shiftName.trim(), startTime, endTime, status],
    );

    const [shiftTypes] = await pool.query(
      `
        SELECT
          shift_type_id,
          shift_name,
          start_time,
          end_time,
          status
        FROM shift_type
        WHERE shift_type_id = ?
      `,
      [result.insertId],
    );

    res.status(201).json(shiftTypes[0]);
     } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'A shift type with this name already exists.',
      });
    }

    console.error('Shift type create error:', error.code);

    return res.status(500).json({
      message: 'Unable to create the shift type.',
    });
  }
});

// Update a shift type
router.put('/:id', async (req, res) => {
  const shiftTypeId = Number(req.params.id);
  const {
    shift_name: shiftName,
    start_time: startTime,
    end_time: endTime,
    status,
  } = req.body || {};

  if (!Number.isInteger(shiftTypeId) || shiftTypeId <= 0) {
    return res.status(400).json({
      message: 'Shift type ID must be a positive number.',
    });
  }

  if (
    typeof shiftName !== 'string' ||
    shiftName.trim().length < 2 ||
    shiftName.trim().length > 50
  ) {
    return res.status(400).json({
      message: 'Shift name must contain 2 to 50 characters.',
    });
  }

       if (!isValidClockTime(startTime) || !isValidClockTime(endTime)) {
    return res.status(400).json({
      message: 'Start time and end time must be valid 24-hour times in HH:MM format.',
    });
  }

  if (startTime === endTime) {
    return res.status(400).json({
      message: 'Start time and end time cannot be the same.',
    });
  }

  if (!['Active', 'Inactive'].includes(status)) {
    return res.status(400).json({
      message: 'Status must be Active or Inactive.',
    });
  }

  try {
    const [result] = await pool.query(
      `
        UPDATE shift_type
        SET
          shift_name = ?,
          start_time = ?,
          end_time = ?,
          status = ?
        WHERE shift_type_id = ?
      `,
      [
        shiftName.trim(),
        startTime,
        endTime,
        status,
        shiftTypeId,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'Shift type not found.',
      });
    }

    const [shiftTypes] = await pool.query(
      `
        SELECT
          shift_type_id,
          shift_name,
          start_time,
          end_time,
          status
        FROM shift_type
        WHERE shift_type_id = ?
      `,
      [shiftTypeId],
    );

    res.status(200).json(shiftTypes[0]);
       } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'A shift type with this name already exists.',
      });
    }

    console.error('Shift type update error:', error.code);

    return res.status(500).json({
      message: 'Unable to update the shift type.',
    });
  }
});

  // Safely delete an inactive shift type without linked records
  router.delete('/:id', async (req, res) => {
    const shiftTypeId = Number(req.params.id);

  if (
    !/^\d+$/.test(req.params.id) ||
    !Number.isSafeInteger(shiftTypeId) ||
    shiftTypeId <= 0
  ) {
    return res.status(400).json({
      message: 'Shift type ID must be a valid positive integer.',
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Lock the shift type while checking whether it can be deleted
    const [shiftTypes] = await connection.query(
      `SELECT shift_type_id, status
       FROM shift_type
       WHERE shift_type_id = ?
       FOR UPDATE`,
      [shiftTypeId]
    );

    if (shiftTypes.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        message: 'Shift type not found.',
      });
    }

    // Active shift types cannot be deleted
    if (shiftTypes[0].status !== 'Inactive') {
      await connection.rollback();

      return res.status(409).json({
        message: 'Deactivate the shift type before deleting.',
      });
    }

    // Check all tables linked to the shift type
    const [references] = await connection.query(
      `
      SELECT
        (SELECT COUNT(*)
         FROM shift_roster
         WHERE shift_type_id = ?) AS rosters,

        (SELECT COUNT(*)
         FROM task_assignment
         WHERE shift_type_id = ?) AS assignments,

        (SELECT COUNT(*)
         FROM task_checklist
         WHERE shift_type_id = ?) AS checklists,

        (SELECT COUNT(*)
         FROM shift_handover
         WHERE to_shift_type_id = ?) AS handovers
      `,
      [shiftTypeId, shiftTypeId, shiftTypeId, shiftTypeId]
    );

    const hasLinkedRecords = Object.values(references[0])
      .some((count) => Number(count) > 0);

    if (hasLinkedRecords) {
      await connection.rollback();

      return res.status(409).json({
        message:
          'This shift type has related records and cannot be permanently deleted. Keep it inactive to preserve history.',
      });
    }

    // Delete only after passing all safety checks
    const [result] = await connection.query(
      'DELETE FROM shift_type WHERE shift_type_id = ?',
      [shiftTypeId]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();

      return res.status(404).json({
        message: 'Shift type not found.',
      });
    }

    await connection.commit();

    return res.status(200).json({
      message: 'Shift type deleted successfully.',
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Shift type rollback error:', rollbackError.code);
      }
    }

    // Additional protection from MySQL foreign-key constraints
    if (
      error.code === 'ER_ROW_IS_REFERENCED_2' ||
      error.code === 'ER_ROW_IS_REFERENCED'
    ) {
      return res.status(409).json({
        message:
          'This shift type is being used by another record and cannot be deleted.',
      });
    }

    console.error('Shift type deletion error:', error.code);

    return res.status(500).json({
      message: 'Unable to delete the shift type.',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;