
const express = require('express');

const {
  requireAuth,
  requireRole,
} = require('../middleware/authMiddleware');

const {
  listOvertimeRecords,
  listEligibleOvertimeEmployees,
  createOvertimeRecord,
} = require('../models/overtimeModel');

const router = express.Router();

const staffRoles = new Set([
  'Pharmacist',
  'Pharmacy Assistant',
]);

// Validate a date in YYYY-MM-DD format.
function isValidDate(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  if (Number(value.slice(0, 4)) < 1000) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

// Validate overtime hours for DECIMAL(5,2).
function isValidHours(value) {
  if (
    typeof value !== 'number' &&
    typeof value !== 'string'
  ) {
    return false;
  }

  const text = String(value).trim();

  if (!/^(0|[1-9]\d{0,2})(\.\d{1,2})?$/.test(text)) {
    return false;
  }

  const hours = Number(text);

  return (
    Number.isFinite(hours) &&
    hours > 0 &&
    hours <= 999.99
  );
}

// GET /api/overtime
// Managers see all records.
// Staff see only their own records.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const roleName = req.currentUser.role_name;

    const isManager = roleName === 'Owner/Manager';
    const isStaff = staffRoles.has(roleName);

    if (!isManager && !isStaff) {
      return res.status(403).json({
        message: 'Access denied.',
      });
    }

    const employeeId = isManager
      ? null
      : req.currentUser.employee_id;

    const records = await listOvertimeRecords(employeeId);

    return res.status(200).json({
      records,
    });
  } catch (error) {
    return next(error);
  }
});

// GET /api/overtime/eligible-employees
// Only managers can retrieve employees eligible for overtime.
router.get(
  '/eligible-employees',
  requireAuth,
  requireRole('Owner/Manager'),
  async (req, res, next) => {
    try {
      const employees = await listEligibleOvertimeEmployees();

      return res.status(200).json({
        employees,
      });
    } catch (error) {
      return next(error);
    }
  }
);

// POST /api/overtime
// Only managers can create overtime records for eligible staff.
router.post(
  '/',
  requireAuth,
  requireRole('Owner/Manager'),
  async (req, res, next) => {
    try {
      const employeeId = Number(req.body?.employee_id);
      const overtimeDate = req.body?.overtime_date;
      const hoursWorked = req.body?.hours_worked;
      const status = req.body?.status;

      // Validate employee ID.
      if (
        !Number.isSafeInteger(employeeId) ||
        employeeId < 1
      ) {
        return res.status(400).json({
          message: 'Select a valid employee.',
        });
      }

      // Validate overtime date.
      if (!isValidDate(overtimeDate)) {
        return res.status(400).json({
          message: 'Enter a valid overtime date.',
        });
      }

      // Validate hours worked.
      if (!isValidHours(hoursWorked)) {
        return res.status(400).json({
          message:
            'Enter valid overtime hours greater than zero, with no more than two decimal places.',
        });
      }

      // Validate status.
      if (!['Pending', 'Approved'].includes(status)) {
        return res.status(400).json({
          message: 'Select a valid overtime status.',
        });
      }

      // Save through the model.
      // The model checks employee eligibility in MySQL.
      const record = await createOvertimeRecord({
        employee_id: employeeId,
        overtime_date: overtimeDate,
        hours_worked: Number(hoursWorked),
        status,
      });

      if (!record) {
        return res.status(400).json({
          message:
            'The selected employee is not eligible for overtime.',
        });
      }

      return res.status(201).json({
        message: 'Overtime record created successfully.',
        record,
      });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
