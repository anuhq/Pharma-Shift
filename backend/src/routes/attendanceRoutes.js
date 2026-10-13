
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
  deleteAttendance,
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

// READ - Manager sees all attendance records.
// Other employees see only their own records.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const records = managementRoles.has(
      req.currentUser.role_name
    )
      ? await getAllAttendance()
      : await getAttendanceForEmployee(
          req.currentUser.employee_id
        );

    return res.status(200).json({ records });
  } catch (error) {
    return next(error);
  }
});

// CREATE - Record the signed-in employee's check-in.
router.post(
  '/check-in',
  requireAuth,
  async (req, res, next) => {
    try {
      // Never accept employee ID from the request body.
      const record = await createCheckIn(
        req.currentUser.employee_id
      );

      return res.status(201).json({
        message: 'Check-in recorded successfully.',
        record,
      });
    } catch (error) {
      // Prevent a second active attendance session.
      if (error.code === 'ATTENDANCE_ALREADY_CHECKED_IN') {
        return res.status(409).json({
          message:
            'You are already checked in. Please check out before checking in again.',
        });
      }

      // Keep protection against two records on the same date.
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          message:
            'Attendance has already been recorded for today.',
        });
      }

      return next(error);
    }
  }
);

// UPDATE - Record the signed-in employee's check-out.
router.post(
  '/check-out',
  requireAuth,
  async (req, res, next) => {
    try {
      const record = await createCheckOut(
        req.currentUser.employee_id
      );

      return res.status(200).json({
        message: 'Check-out recorded successfully.',
        record,
      });
    } catch (error) {
      if (error.code === 'ATTENDANCE_NOT_FOUND') {
        return res.status(404).json({
          message:
            'Check-in is required before check-out.',
        });
      }

      if (
        error.code === 'ATTENDANCE_ALREADY_COMPLETED'
      ) {
        return res.status(409).json({
          message:
            'Check-out has already been recorded.',
        });
      }

      return next(error);
    }
  }
);

// UPDATE - Only Owner/Manager can correct attendance.
router.patch(
  '/:attendanceId',
  requireAuth,
  requireRole('Owner/Manager'),
  async (req, res, next) => {
    try {
      const attendanceId = Number(
        req.params.attendanceId
      );

      const checkInTime = normalizeTime(
        req.body?.checkInTime
      );

      const rawCheckOutTime = req.body?.checkOutTime;

      const checkOutTime =
        rawCheckOutTime === null ||
        rawCheckOutTime === ''
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
          message:
            'Valid times and a correction note are required.',
        });
      }

      // Keep the existing same-day correction validation.
      // Overnight corrections will be handled separately.
      if (
        checkOutTime &&
        checkOutTime <= checkInTime
      ) {
        return res.status(400).json({
          message:
            'Check-out time must be later than check-in time.',
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
          message:
            'Attendance record was not found.',
        });
      }

      return res.status(200).json({
        message:
          'Attendance corrected successfully.',
        record,
      });
    } catch (error) {
      return next(error);
    }
  }
);

// DELETE - Only Owner/Manager can permanently delete
// an incorrectly created attendance record.
router.delete(
  '/:attendanceId',
  requireAuth,
  requireRole('Owner/Manager'),
  async (req, res, next) => {
    try {
      const rawAttendanceId =
        req.params.attendanceId;

      if (!/^[1-9]\d*$/.test(rawAttendanceId)) {
        return res.status(400).json({
          message:
            'Invalid attendance record ID.',
        });
      }

      const attendanceId = Number(
        rawAttendanceId
      );

      if (
        !Number.isSafeInteger(attendanceId) ||
        attendanceId > 2147483647
      ) {
        return res.status(400).json({
          message:
            'Invalid attendance record ID.',
        });
      }

      const deleted = await deleteAttendance(
        attendanceId
      );

      if (!deleted) {
        return res.status(404).json({
          message:
            'Attendance record was not found.',
        });
      }

      return res.status(200).json({
        message:
          'Attendance record deleted successfully.',
      });
    } catch (error) {
      if (
        error.code === 'ER_ROW_IS_REFERENCED' ||
        error.code === 'ER_ROW_IS_REFERENCED_2'
      ) {
        return res.status(409).json({
          message:
            'This attendance record cannot be deleted because another record references it.',
        });
      }

      return next(error);
    }
  }
);

module.exports = router;
