
const express = require('express');

const {
  requireAuth,
  requireRole,
} = require('../middleware/authMiddleware');

const {
  listOvertimeRecords,
  listEligibleOvertimeEmployees,
  createOvertimeRecord,
  updateOvertimeRecord,
  deleteOvertimeRecord,
} = require('../models/overtimeModel');

const { getSriLankaToday } = require('../utils/sriLankaDate');

const router = express.Router();

const staffRoles = new Set([
  'Pharmacist',
  'Pharmacy Assistant',
]);

// Validate dates in YYYY-MM-DD format.
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

// Validate overtime hours.
function isValidHours(value) {
  if (
    typeof value !== 'number' &&
    typeof value !== 'string'
  ) {
    return false;
  }

  const text = String(value).trim();

  if (!/^(0|[1-8])(\.\d{1,2})?$/.test(text)) {
    return false;
  }

  const hours = Number(text);

  return (
    Number.isFinite(hours) &&
    hours > 0 &&
    hours <= 8
  );
}

// Validate a positive integer record ID.
function isValidRecordId(value) {
  if (
    typeof value !== 'string' ||
    !/^[1-9]\d*$/.test(value)
  ) {
    return false;
  }

  return Number.isSafeInteger(Number(value));
}

// GET - Retrieve overtime records.
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

// GET - Retrieve eligible employees.
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

// POST - Create Approved overtime.
router.post(
  '/',
  requireAuth,
  requireRole('Owner/Manager'),
  async (req, res, next) => {
    try {
      const employeeId = Number(req.body?.employee_id);
      const overtimeDate = req.body?.overtime_date;
      const hoursWorked = req.body?.hours_worked;

      if (
        !Number.isSafeInteger(employeeId) ||
        employeeId < 1
      ) {
        return res.status(400).json({
          message: 'Select a valid employee.',
        });
      }

      if (!isValidDate(overtimeDate)) {
        return res.status(400).json({
          message: 'Enter a valid overtime date.',
        });
      }

      // Future overtime dates are not allowed.
      if (overtimeDate > getSriLankaToday()) {
        return res.status(400).json({
          message: 'Overtime date cannot be in the future.',
        });
      }

      if (!isValidHours(hoursWorked)) {
        return res.status(400).json({
          message:
            'Enter overtime hours greater than zero and up to 8, with no more than two decimal places.',
        });
      }

      // The manager verifies overtime before saving.
      const record = await createOvertimeRecord({
        employee_id: employeeId,
        overtime_date: overtimeDate,
        hours_worked: Number(hoursWorked),
        status: 'Approved',
      });

      // Check the combined daily overtime limit.
      if (record?.outcome === 'daily_limit_exceeded') {
        return res.status(409).json({
          message:
            'Total overtime cannot exceed 8 hours per employee per day.',
        });
      }

      if (!record) {
        return res.status(400).json({
          message:
            'The selected employee is not eligible for overtime.',
        });
      }

      return res.status(201).json({
        message:
          'Overtime record approved and saved successfully.',
        record,
      });
    } catch (error) {
      return next(error);
    }
  }
);

// PATCH - Edit an Approved overtime record.
router.patch(
  '/:overtimeId',
  requireAuth,
  requireRole('Owner/Manager'),
  async (req, res, next) => {
    try {
      const { overtimeId } = req.params;

      if (!isValidRecordId(overtimeId)) {
        return res.status(400).json({
          message: 'Invalid overtime record ID.',
        });
      }

      const employeeId = Number(req.body?.employee_id);
      const overtimeDate = req.body?.overtime_date;
      const hoursWorked = req.body?.hours_worked;

      if (
        !Number.isSafeInteger(employeeId) ||
        employeeId < 1
      ) {
        return res.status(400).json({
          message: 'Select a valid employee.',
        });
      }

      if (!isValidDate(overtimeDate)) {
        return res.status(400).json({
          message: 'Enter a valid overtime date.',
        });
      }

      // Future overtime dates are not allowed.
      if (overtimeDate > getSriLankaToday()) {
        return res.status(400).json({
          message: 'Overtime date cannot be in the future.',
        });
      }

      if (!isValidHours(hoursWorked)) {
        return res.status(400).json({
          message:
            'Enter overtime hours greater than zero and up to 8, with no more than two decimal places.',
        });
      }

      const record = await updateOvertimeRecord(
        Number(overtimeId),
        {
          employee_id: employeeId,
          overtime_date: overtimeDate,
          hours_worked: Number(hoursWorked),
        }
      );

      // Check the combined daily overtime limit.
      if (record?.outcome === 'daily_limit_exceeded') {
        return res.status(409).json({
          message:
            'Total overtime cannot exceed 8 hours per employee per day.',
        });
      }

      if (!record) {
        return res.status(409).json({
          message:
            'Overtime cannot be updated. Confirm that the record is Approved and the selected employee is active and eligible.',
        });
      }

      return res.status(200).json({
        message: 'Overtime record updated successfully.',
        record,
      });
    } catch (error) {
      return next(error);
    }
  }
);

// DELETE - Remove an overtime record.
router.delete(
  '/:overtimeId',
  requireAuth,
  requireRole('Owner/Manager'),
  async (req, res, next) => {
    try {
      const { overtimeId } = req.params;

      if (!isValidRecordId(overtimeId)) {
        return res.status(400).json({
          message: 'Invalid overtime record ID.',
        });
      }

      const deleted = await deleteOvertimeRecord(
        Number(overtimeId)
      );

      if (!deleted) {
        return res.status(404).json({
          message: 'Overtime record not found.',
        });
      }

      return res.status(200).json({
        message: 'Overtime record deleted successfully.',
      });
    } catch (error) {
      if (
        error.code === 'ER_ROW_IS_REFERENCED' ||
        error.code === 'ER_ROW_IS_REFERENCED_2'
      ) {
        return res.status(409).json({
          message:
            'This overtime record cannot be deleted because it is referenced by another record.',
        });
      }

      return next(error);
    }
  }
);

module.exports = router;
