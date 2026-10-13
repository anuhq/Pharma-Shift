
const express = require('express');

const {
  requireAuth,
  requireRole,
} = require('../middleware/authMiddleware');

const {
  listLeaveRequests,
  createLeaveRequest,
  updatePendingLeaveRequest,
  deletePendingLeaveRequest,
  reviewPendingLeaveRequest,
} = require('../models/leaveModel');

const router = express.Router();

const leaveTypes = new Set([
  'Annual Leave',
  'Sick Leave',
  'Casual Leave',
  'Maternity Leave',
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

// READ - Retrieve leave requests.
// Manager sees all requests.
// Staff see only their own requests.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const isManager =
      req.currentUser.role_name === 'Owner/Manager';

    const employeeId = isManager
      ? null
      : req.currentUser.employee_id;

    const requests = await listLeaveRequests(employeeId);

    return res.status(200).json({ requests });
  } catch (error) {
    return next(error);
  }
});

// CREATE - Submit a Pending leave request.
// Only Pharmacists and Pharmacy Assistants can submit.
router.post(
  '/',
  requireAuth,
  requireRole('Pharmacist', 'Pharmacy Assistant'),
  async (req, res, next) => {
    try {
      const leaveType = req.body?.leave_type;
      const startDate = req.body?.start_date;
      const endDate = req.body?.end_date;

      const reason =
        typeof req.body?.reason === 'string'
          ? req.body.reason.trim()
          : '';

      if (!leaveTypes.has(leaveType)) {
        return res.status(400).json({
          message: 'Select a valid leave type.',
        });
      }

      if (!isValidDate(startDate) || !isValidDate(endDate)) {
        return res.status(400).json({
          message: 'Enter valid leave dates.',
        });
      }

      if (endDate < startDate) {
        return res.status(400).json({
          message: 'End date cannot be before start date.',
        });
      }

      if (!reason || reason.length > 255) {
        return res.status(400).json({
          message: 'Reason must contain 1 to 255 characters.',
        });
      }

      // Employee ID comes from the authenticated account.
      const request = await createLeaveRequest(
        req.currentUser.employee_id,
        {
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason,
        }
      );

      return res.status(201).json({
        message: 'Leave request submitted successfully.',
        request,
      });
    } catch (error) {
      return next(error);
    }
  }
);

// UPDATE - Edit own Pending leave request.
router.patch(
  '/:leaveId',
  requireAuth,
  requireRole('Pharmacist', 'Pharmacy Assistant'),
  async (req, res, next) => {
    try {
      const leaveId = Number(req.params.leaveId);

      if (!Number.isSafeInteger(leaveId) || leaveId < 1) {
        return res.status(400).json({
          message: 'Invalid leave request ID.',
        });
      }

      const leaveType = req.body?.leave_type;
      const startDate = req.body?.start_date;
      const endDate = req.body?.end_date;

      const reason =
        typeof req.body?.reason === 'string'
          ? req.body.reason.trim()
          : '';

      if (!leaveTypes.has(leaveType)) {
        return res.status(400).json({
          message: 'Select a valid leave type.',
        });
      }

      if (!isValidDate(startDate) || !isValidDate(endDate)) {
        return res.status(400).json({
          message: 'Enter valid leave dates.',
        });
      }

      if (endDate < startDate) {
        return res.status(400).json({
          message: 'End date cannot be before start date.',
        });
      }

      if (!reason || reason.length > 255) {
        return res.status(400).json({
          message: 'Reason must contain 1 to 255 characters.',
        });
      }

      const result = await updatePendingLeaveRequest(
        leaveId,
        req.currentUser.employee_id,
        {
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason,
        }
      );

      if (result.outcome === 'not_found') {
        return res.status(404).json({
          message: 'Leave request not found.',
        });
      }

      if (result.outcome === 'not_pending') {
        return res.status(409).json({
          message: 'Only Pending leave requests can be edited.',
        });
      }

      return res.status(200).json({
        message: 'Leave request updated successfully.',
        request: result.request,
      });
    } catch (error) {
      return next(error);
    }
  }
);

// REVIEW - Manager approves or rejects a Pending request.
router.patch(
  '/:leaveId/review',
  requireAuth,
  requireRole('Owner/Manager'),
  async (req, res, next) => {
    try {
      const leaveId = Number(req.params.leaveId);
      const decision = req.body?.decision;
      const rawNote = req.body?.review_note;

      if (!Number.isSafeInteger(leaveId) || leaveId < 1) {
        return res.status(400).json({
          message: 'Invalid leave request ID.',
        });
      }

      if (!['Approved', 'Rejected'].includes(decision)) {
        return res.status(400).json({
          message: 'Select Approve or Reject.',
        });
      }

      if (
        rawNote != null &&
        typeof rawNote !== 'string'
      ) {
        return res.status(400).json({
          message: 'Review note must be valid text.',
        });
      }

      const reviewNote =
        typeof rawNote === 'string'
          ? rawNote.trim()
          : '';

      if (reviewNote.length > 255) {
        return res.status(400).json({
          message: 'Review note must be 255 characters or fewer.',
        });
      }

      const result = await reviewPendingLeaveRequest(
        leaveId,
        req.currentUser.employee_id,
        decision,
        reviewNote || null
      );

      if (result.outcome === 'not_found') {
        return res.status(404).json({
          message: 'Leave request not found.',
        });
      }

      if (result.outcome === 'self_review') {
        return res.status(403).json({
          message: 'You cannot review your own leave request.',
        });
      }

      if (result.outcome === 'not_pending') {
        return res.status(409).json({
          message: 'Only Pending leave requests can be reviewed.',
        });
      }

      return res.status(200).json({
        message:
          decision === 'Approved'
            ? 'Leave request approved successfully.'
            : 'Leave request rejected successfully.',
        request: result.request,
      });
    } catch (error) {
      return next(error);
    }
  }
);

// DELETE - Permanently delete own Pending leave request.
// The database checks employee ownership and Pending status.
router.delete(
  '/:leaveId',
  requireAuth,
  requireRole('Pharmacist', 'Pharmacy Assistant'),
  async (req, res, next) => {
    try {
      const rawLeaveId = req.params.leaveId;

      if (!/^[1-9]\d*$/.test(rawLeaveId)) {
        return res.status(400).json({
          message: 'Invalid leave request ID.',
        });
      }

      const leaveId = Number(rawLeaveId);

      if (!Number.isSafeInteger(leaveId)) {
        return res.status(400).json({
          message: 'Invalid leave request ID.',
        });
      }

      const result = await deletePendingLeaveRequest(
        leaveId,
        req.currentUser.employee_id
      );

      if (result.outcome === 'not_found') {
        return res.status(404).json({
          message: 'Leave request not found.',
        });
      }

      if (result.outcome === 'not_pending') {
        return res.status(409).json({
          message: 'Only Pending leave requests can be deleted.',
        });
      }

      return res.status(200).json({
        message: 'Leave request deleted successfully.',
      });
    } catch (error) {
      if (
        error.code === 'ER_ROW_IS_REFERENCED' ||
        error.code === 'ER_ROW_IS_REFERENCED_2'
      ) {
        return res.status(409).json({
          message:
            'This leave request cannot be deleted because another record references it.',
        });
      }

      return next(error);
    }
  }
);

module.exports = router;
