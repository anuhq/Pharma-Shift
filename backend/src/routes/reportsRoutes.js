
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

// Check that a date is a real calendar date
// written in YYYY-MM-DD format.
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
//
// Example:
// /api/reports?type=attendance&from=2026-09-01&to=2026-10-12
router.get(
  '/',
  requireAuth,
  requireRole('Owner/Manager'),
  async (req, res, next) => {
    try {
      const reportType = req.query.type;
      const fromDate = req.query.from;
      const toDate = req.query.to;

      // Validate the selected report type.
      if (
        typeof reportType !== 'string' ||
        !allowedReportTypes.has(reportType)
      ) {
        return res.status(400).json({
          message:
            'Select a valid report type: Attendance, Leave or Overtime.',
        });
      }

      // Require valid start and end dates.
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

      // Generate the report directly from MySQL.
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
