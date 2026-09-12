const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  getAttendanceForEmployee,
  getAllAttendance,
  createCheckIn,
} = require('../models/attendanceModel');

const router = express.Router();
const managementRoles = new Set(['Owner/Manager']);

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

module.exports = router;