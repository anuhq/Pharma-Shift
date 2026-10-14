
const express = require('express');

const {
  requireAuth,
  requireRole,
} = require('../middleware/authMiddleware');

const {
  getReportData,
} = require('../models/reportsModel');

const router = express.Router();

const allowedReportTypes = new Set([
  'attendance',
  'leave',
  'overtime',
]);

// Validate a real date in YYYY-MM-DD format.
function isValidDate(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const year = Number(value.slice(0, 4));

  if (year < 1000) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

// GET /api/reports
// Only Owner/Manager can generate reports.
router.get(
  '/',
  requireAuth,
  requireRole('Owner/Manager'),
  async (req, res, next) => {
    try {
      const reportType = req.query.type;
      const fromDate = req.query.from;
      const toDate = req.query.to;

      // Validate the report type.
      if (
        typeof reportType !== 'string' ||
        !allowedReportTypes.has(reportType)
      ) {
        return res.status(400).json({
          message:
            'Select a valid report type: Attendance, Leave or Overtime.',
        });
      }

      // Require valid From and To dates.
      if (
        !isValidDate(fromDate) ||
        !isValidDate(toDate)
      ) {
        return res.status(400).json({
          message:
            'Valid From and To dates are required.',
        });
      }

      // Prevent incorrect date ranges.
      if (toDate < fromDate) {
        return res.status(400).json({
          message:
            'To date cannot be before From date.',
        });
      }

      // Generate the report from MySQL.
      const report = await getReportData(
        reportType,
        fromDate,
        toDate
      );

      return res.status(200).json(report);
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
