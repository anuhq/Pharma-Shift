const express = require('express');
const {
  requireAuth,
  requireRole,
} = require('../middleware/authMiddleware');

const {
  getAttendanceForEmployee,
  getAllAttendance,
  createCheckIn,
  createCheckOut,
  correctAttendance,
} = require('../models/attendanceModel');

const router = express.Router();
const managementRoles = new Set(['Owner/Manager']);
function normalizeTime(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const time = value.trim();

  // Accept either HH:MM or HH:MM:SS.
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) {
    return null;
  }

  return time.length === 5 ? `${time}:00` : time;
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    // Managers see all records. Staff only see their own records.
    const records = managementRoles.has(req.currentUser.role_name)
      ? await getAllAttendance()
      : await getAttendanceForEmployee(req.currentUser.employee_id);

    return res.status(200).json({ records });
  } catch (error) {
    return next(error);
  }
});

router.post('/check-in', requireAuth, async (req, res, next) => {
  try {
    // The employee ID comes from the signed-in session.
    const record = await createCheckIn(req.currentUser.employee_id);

    return res.status(201).json({
      message: 'Check-in recorded successfully.',
      record,
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'Attendance has already been recorded for today.',
      });
    }

    return next(error);
  }
});

router.post('/check-out', requireAuth, async (req, res, next) => {
  try {
    // Check out only the employee stored in the signed-in session.
    const record = await createCheckOut(req.currentUser.employee_id);

    return res.status(200).json({
      message: 'Check-out recorded successfully.',
      record,
    });
  } catch (error) {
    if (error.code === 'ATTENDANCE_NOT_FOUND') {
      return res.status(404).json({
        message: 'Check-in is required before check-out.',
      });
    }

    if (error.code === 'ATTENDANCE_ALREADY_COMPLETED') {
      return res.status(409).json({
        message: 'Check-out has already been recorded.',
      });
    }

    return next(error);
  }
});

router.patch(
  '/:attendanceId',
  requireAuth,
  requireRole('Owner/Manager'),
  async (req, res, next) => {
    try {
      const attendanceId = Number(req.params.attendanceId);
      const checkInTime = normalizeTime(req.body?.checkInTime);

      const rawCheckOutTime = req.body?.checkOutTime;
      const checkOutTime =
        rawCheckOutTime === null || rawCheckOutTime === ''
          ? null
          : normalizeTime(rawCheckOutTime);

      const correctionNote =
        typeof req.body?.correctionNote === 'string'
          ? req.body.correctionNote.trim()
          : '';

      if (
        !Number.isInteger(attendanceId) ||
        attendanceId < 1 ||
        !checkInTime ||
        (rawCheckOutTime !== null &&
          rawCheckOutTime !== '' &&
          !checkOutTime) ||
        correctionNote.length < 3 ||
        correctionNote.length > 255
      ) {
        return res.status(400).json({
          message: 'Valid times and a correction note are required.',
        });
      }

      if (checkOutTime && checkOutTime <= checkInTime) {
        return res.status(400).json({
          message: 'Check-out time must be later than check-in time.',
        });
      }

      const record = await correctAttendance(
        attendanceId,
        checkInTime,
        checkOutTime,
        correctionNote
      );

      if (!record) {
        return res.status(404).json({
          message: 'Attendance record was not found.',
        });
      }

      return res.status(200).json({
        message: 'Attendance corrected successfully.',
        record,
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;