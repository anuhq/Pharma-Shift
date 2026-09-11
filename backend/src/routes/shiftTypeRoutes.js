const express = require('express');
const pool = require('../config/db');

const router = express.Router();

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

  if (
    typeof startTime !== 'string' ||
    !/^\d{2}:\d{2}$/.test(startTime) ||
    typeof endTime !== 'string' ||
    !/^\d{2}:\d{2}$/.test(endTime)
  ) {
    return res.status(400).json({
      message: 'Start time and end time must use HH:MM format.',
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
    console.error('Shift type create error:', error.code);

    res.status(500).json({
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

  if (
    typeof startTime !== 'string' ||
    !/^\d{2}:\d{2}$/.test(startTime) ||
    typeof endTime !== 'string' ||
    !/^\d{2}:\d{2}$/.test(endTime)
  ) {
    return res.status(400).json({
      message: 'Start time and end time must use HH:MM format.',
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
    console.error('Shift type update error:', error.code);

    res.status(500).json({
      message: 'Unable to update the shift type.',
    });
  }
});

module.exports = router;