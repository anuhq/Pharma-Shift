const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  getAllAttendance,
  getAttendanceForEmployee,
} = require('../models/attendanceModel');

const router = express.Router();

// Only signed-in users can view attendance records.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const isManager = req.currentUser.role_name === 'Owner/Manager';

    // Managers see everyone; staff members only see their own records.
    const records = isManager
      ? await getAllAttendance()
      : await getAttendanceForEmployee(req.currentUser.employee_id);

    return res.status(200).json({ records });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;