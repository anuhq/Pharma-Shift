
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useAuth } from '../../auth/useAuth';

import {
  getLeaveRequests,
  submitLeaveRequest,
  updateLeaveRequest,
  reviewLeaveRequest,
  deleteLeaveRequest,
} from '../../api/leaveApi';

import LeaveRequestForm from './LeaveRequestForm';
import LeaveReviewForm from './LeaveReviewForm';

const leaveTypes = [
  'Annual Leave',
  'Sick Leave',
  'Casual Leave',
  'Maternity Leave',
];

const statusClasses = {
  Pending: 'text-bg-warning',
  Approved: 'text-bg-success',
  Rejected: 'text-bg-danger',
};

const emptyFilters = {
  search: '',
  type: '',
  status: '',
  from: '',
  to: '',
};

function requestLabel(id) {
  return `LR-${String(id).padStart(4, '0')}`;
}

function LeaveRequests({ headerActionContainer }) {
  const { user } = useAuth();

  const canSubmitLeave = [
    'Pharmacist',
    'Pharmacy Assistant',
  ].includes(user?.roleName);

  const [requests, setRequests] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [selectedId, setSelectedId] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [submitError, setSubmitError] = useState('');
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [reviewingRequest, setReviewingRequest] = useState(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const submitButtonRef = useRef(null);
  const submittingRef = useRef(false);
  const deletingRef = useRef(false);
  const reviewingRef = useRef(false);

  // READ - Load leave requests from MySQL.
  useEffect(() => {
    let cancelled = false;

    setLoading(true);

    getLeaveRequests()
      .then((data) => {
        if (cancelled) return;

        setRequests(
          Array.isArray(data.requests) ? data.requests : []
        );

        setLoadError('');
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.employeeId]);

  // Reload leave requests from MySQL after changes.
  async function reloadRequests() {
    setLoading(true);
    setLoadError('');

    try {
      const data = await getLeaveRequests();

      setRequests(
        Array.isArray(data.requests) ? data.requests : []
      );
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }

  const invalidRange =
    filters.from &&
    filters.to &&
    filters.to < filters.from;

  const query = filters.search.trim().toLowerCase();

  // Search and filter saved leave requests.
  const filteredRequests = requests.filter((request) => {
    const label = requestLabel(request.leave_request_id);

    return (
      !invalidRange &&
      `${request.full_name} ${request.employee_id} ${label}`
        .toLowerCase()
        .includes(query) &&
      (!filters.type ||
        request.leave_type === filters.type) &&
      (!filters.status ||
        request.status === filters.status) &&
      (!filters.from ||
        request.end_date >= filters.from) &&
      (!filters.to ||
        request.start_date <= filters.to)
    );
  });

  const selectedRequest = requests.find(
    (request) => request.leave_request_id === selectedId
  );

  const currentEmployee = {
    employee_id: user?.employeeId,
    full_name:
      user?.fullName ||
      user?.username ||
      'Signed-in employee',
  };

  // Staff can manage only their own Pending requests.
  const canManageSelected =
    canSubmitLeave &&
    selectedRequest?.status === 'Pending' &&
    Number(selectedRequest?.employee_id) ===
      Number(user?.employeeId);

  // Manager reviews another employee's Pending request.
  const canReviewSelected =
    user?.roleName === 'Owner/Manager' &&
    selectedRequest?.status === 'Pending' &&
    Number(selectedRequest.employee_id) !==
      Number(user?.employeeId);

  function updateFilter(event) {
    const { name, value } = event.target;

    setFilters((current) => ({
      ...current,
      [name]: value,
    }));

    setSelectedId(null);
    setActionError('');
    setReviewingRequest(null);
    setReviewError('');
  }

  function openCreateForm() {
    if (!canSubmitLeave || deletingRef.current) {
      return;
    }

    setEditingRequest(null);
    setSelectedId(null);
    setMessage('');
    setSubmitError('');
    setActionError('');
    setFormOpen(true);
  }

  function openEditForm(request) {
    if (
      !canSubmitLeave ||
      request.status !== 'Pending' ||
      Number(request.employee_id) !==
        Number(user?.employeeId) ||
      deletingRef.current
    ) {
      setActionError(
        'You can only edit your own Pending leave requests.'
      );

      return;
    }

    setEditingRequest(request);
    setSelectedId(request.leave_request_id);
    setMessage('');
    setSubmitError('');
    setActionError('');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingRequest(null);
    setSubmitError('');

    submitButtonRef.current?.focus();
  }

  // CREATE or UPDATE - Save a leave request.
  async function saveRequest(values) {
    if (
      submittingRef.current ||
      deletingRef.current
    ) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    setMessage('');

    const isEditing = Boolean(editingRequest);

    try {
      const result = isEditing
        ? await updateLeaveRequest(
            editingRequest.leave_request_id,
            values
          )
        : await submitLeaveRequest(values);

      if (!result.request?.leave_request_id) {
        throw new Error(
          'Unable to confirm the saved request. Please refresh.'
        );
      }

      setRequests((current) => {
        const remaining = current.filter(
          (item) =>
            item.leave_request_id !==
            result.request.leave_request_id
        );

        return [result.request, ...remaining];
      });

      setFilters(emptyFilters);

      if (isEditing) {
        setSelectedId(result.request.leave_request_id);
        setMessage(
          'Leave request updated successfully.'
        );
      } else {
        setSelectedId(null);
        setMessage(
          'Leave request submitted successfully.'
        );
      }

      closeForm();
    } catch (error) {
      setSubmitError(
        error.message || 'Unable to save leave request.'
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  // DELETE - Permanently remove an own Pending request.
  async function handleDeleteRequest(request) {
    if (
      deletingRef.current ||
      submittingRef.current ||
      reviewingRef.current ||
      formOpen ||
      reviewingRequest
    ) {
      return;
    }

    if (
      !canSubmitLeave ||
      request.status !== 'Pending' ||
      Number(request.employee_id) !==
        Number(user?.employeeId)
    ) {
      setActionError(
        'You can only delete your own Pending leave requests.'
      );

      return;
    }

    const label = requestLabel(
      request.leave_request_id
    );

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${label}?\n\n` +
      `Leave type: ${request.leave_type}\n` +
      `Dates: ${request.start_date} to ${request.end_date}\n\n` +
      'This action cannot be undone.'
    );

    if (!confirmed) {
      return;
    }

    deletingRef.current = true;
    setDeletingId(request.leave_request_id);
    setActionError('');
    setMessage('');

    try {
      const result = await deleteLeaveRequest(
        Number(request.leave_request_id)
      );

      setRequests((current) =>
        current.filter(
          (item) =>
            item.leave_request_id !==
            request.leave_request_id
        )
      );

      setSelectedId(null);
      setFilters(emptyFilters);

      setMessage(
        result.message ||
        `${label} deleted successfully.`
      );

      await reloadRequests();
    } catch (error) {
      setActionError(
        error.message || 'Unable to delete leave request.'
      );
    } finally {
      deletingRef.current = false;
      setDeletingId(null);
    }
  }

  // REVIEW - Manager approves or rejects Pending leave.
  async function handleReview({ decision, review_note }) {
    if (
      !reviewingRequest ||
      reviewingRef.current ||
      deletingRef.current
    ) {
      return;
    }

    reviewingRef.current = true;
    setReviewSubmitting(true);
    setReviewError('');
    setMessage('');

    try {
      const result = await reviewLeaveRequest(
        reviewingRequest.leave_request_id,
        decision,
        review_note
      );

      if (!result.request?.leave_request_id) {
        throw new Error(
          'Unable to confirm the decision. Please refresh.'
        );
      }

      setRequests((current) =>
        current.map((item) =>
          item.leave_request_id ===
          result.request.leave_request_id
            ? result.request
            : item
        )
      );

      setFilters(emptyFilters);
      setSelectedId(result.request.leave_request_id);
      setReviewingRequest(null);

      setMessage(
        decision === 'Approved'
          ? 'Leave request approved successfully.'
          : 'Leave request rejected successfully.'
      );
    } catch (error) {
      setReviewError(
        error.message || 'Unable to review leave request.'
      );
    } finally {
      reviewingRef.current = false;
      setReviewSubmitting(false);
    }
  }

  return (
    <>
      {/* Submit button in the shared header - staff only. */}
      {headerActionContainer &&
        canSubmitLeave &&
        createPortal(
          <button
            type="button"
            className="btn btn-primary"
            ref={submitButtonRef}
            disabled={
              formOpen ||
              Boolean(reviewingRequest) ||
              deletingId !== null
            }
            onClick={openCreateForm}
          >
            Submit leave request
          </button>,
          headerActionContainer
        )}

      <div className="mt-4">
        {message && (
          <div className="alert alert-success" role="status">
            {message}
          </div>
        )}

        {loadError && (
          <div className="alert alert-danger" role="alert">
            <p className="mb-2">{loadError}</p>

            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={reloadRequests}
              disabled={loading}
            >
              Try again
            </button>
          </div>
        )}

        {submitError && (
          <div className="alert alert-danger" role="alert">
            {submitError}
          </div>
        )}

        {actionError && (
          <div className="alert alert-danger" role="alert">
            {actionError}
          </div>
        )}

        {/* Create or Edit form */}
        {formOpen && (
          <LeaveRequestForm
            key={
              editingRequest
                ? `edit-${editingRequest.leave_request_id}`
                : 'create'
            }
            employee={currentEmployee}
            leaveTypes={leaveTypes}
            initialRequest={editingRequest}
            onSubmit={saveRequest}
            onCancel={closeForm}
            submitting={submitting}
          />
        )}

        {/* Search and filters */}
        <div className="row g-3 align-items-end mb-3">
          <div className="col-12 col-md-6 col-xl-4">
            <label
              htmlFor="leave-search"
              className="form-label"
            >
              Search employee or request
            </label>

            <input
              id="leave-search"
              name="search"
              type="search"
              className="form-control"
              placeholder="Employee name, ID or request ID"
              value={filters.search}
              onChange={updateFilter}
            />
          </div>

          <div className="col-12 col-md-6 col-xl-4">
            <label
              htmlFor="leave-type-filter"
              className="form-label"
            >
              Leave type
            </label>

            <select
              id="leave-type-filter"
              name="type"
              className="form-select"
              value={filters.type}
              onChange={updateFilter}
            >
              <option value="">All leave types</option>

              {leaveTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-6 col-xl-4">
            <label
              htmlFor="leave-status-filter"
              className="form-label"
            >
              Status
            </label>

            <select
              id="leave-status-filter"
              name="status"
              className="form-select"
              value={filters.status}
              onChange={updateFilter}
            >
              <option value="">All statuses</option>

              {Object.keys(statusClasses).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-6 col-xl-4">
            <label
              htmlFor="leave-filter-from"
              className="form-label"
            >
              Date range: from
            </label>

            <input
              id="leave-filter-from"
              name="from"
              type="date"
              className="form-control"
              value={filters.from}
              onChange={updateFilter}
            />
          </div>

          <div className="col-12 col-md-6 col-xl-4">
            <label
              htmlFor="leave-filter-to"
              className="form-label"
            >
              Date range: to
            </label>

            <input
              id="leave-filter-to"
              name="to"
              type="date"
              className={`form-control${
                invalidRange ? ' is-invalid' : ''
              }`}
              value={filters.to}
              onChange={updateFilter}
            />
          </div>

          <div className="col-12 col-md-6 col-xl-4">
            <button
              type="button"
              className="btn btn-outline-secondary w-100"
              onClick={() => {
                setFilters(emptyFilters);
                setSelectedId(null);
                setActionError('');
                setReviewingRequest(null);
                setReviewError('');
              }}
            >
              Reset filters
            </button>
          </div>
        </div>

        {invalidRange && (
          <div className="alert alert-danger" role="alert">
            The end date cannot be before the start date.
          </div>
        )}

        {/* Leave requests table */}
        {loading ? (
          <p role="status">Loading leave requests...</p>
        ) : (
          <>
            <p
              className="small text-secondary"
              role="status"
            >
              Showing {filteredRequests.length} of{' '}
              {requests.length} saved requests.
            </p>

            <div className="table-responsive">
              <table className="table table-hover align-middle small">
                <thead className="table-light">
                  <tr>
                    <th>Request ID</th>
                    <th>Employee</th>
                    <th>Leave type</th>
                    <th>Start date</th>
                    <th>End date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRequests.map((request) => (
                    <tr key={request.leave_request_id}>
                      <td>
                        {requestLabel(
                          request.leave_request_id
                        )}
                      </td>

                      <td>
                        {request.full_name}

                        <span className="d-block text-secondary">
                          ID: {request.employee_id}
                        </span>
                      </td>

                      <td>{request.leave_type}</td>
                      <td>{request.start_date}</td>
                      <td>{request.end_date}</td>

                      <td>
                        <span
                          className={`badge ${
                            statusClasses[request.status] ||
                            'text-bg-secondary'
                          }`}
                        >
                          {request.status}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          disabled={
                            formOpen ||
                            Boolean(reviewingRequest) ||
                            deletingId !== null
                          }
                          onClick={() => {
                            setActionError('');
                            setSelectedId(
                              request.leave_request_id
                            );
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredRequests.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center text-secondary py-4"
                      >
                        {loadError
                          ? 'Unable to load leave requests.'
                          : invalidRange
                            ? 'Correct the date range.'
                            : 'No leave requests found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Selected request details */}
        {selectedRequest && (
          <section className="border rounded p-3 mt-3">
            <div className="d-flex justify-content-between align-items-start">
              <h4 className="h5">
                Leave request details
              </h4>

              <button
                type="button"
                className="btn-close"
                aria-label="Close details"
                disabled={
                  formOpen ||
                  deletingId !== null ||
                  Boolean(reviewingRequest)
                }
                onClick={() => {
                  setSelectedId(null);
                  setActionError('');
                }}
              />
            </div>

            <p>
              <strong>Request:</strong>{' '}
              {requestLabel(
                selectedRequest.leave_request_id
              )}
            </p>

            <p>
              <strong>Employee:</strong>{' '}
              {selectedRequest.full_name}
            </p>

            <p>
              <strong>Leave type:</strong>{' '}
              {selectedRequest.leave_type}
            </p>

            <p>
              <strong>Dates:</strong>{' '}
              {selectedRequest.start_date} to{' '}
              {selectedRequest.end_date}
            </p>

            <p>
              <strong>Reason:</strong>{' '}
              {selectedRequest.reason || 'Not provided'}
            </p>

            <p>
              <strong>Status:</strong>{' '}
              <span
                className={`badge ${
                  statusClasses[selectedRequest.status] ||
                  'text-bg-secondary'
                }`}
              >
                {selectedRequest.status}
              </span>
            </p>

            {/* Manager-only Review button */}
            {canReviewSelected &&
              !formOpen &&
              !reviewingRequest && (
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  disabled={deletingId !== null}
                  onClick={() => {
                    setReviewError('');
                    setActionError('');
                    setReviewingRequest(selectedRequest);
                  }}
                >
                  Review Request
                </button>
              )}

            {/* Manager approval or rejection form */}
            {reviewingRequest?.leave_request_id ===
              selectedRequest.leave_request_id && (
              <>
                {reviewError && (
                  <div
                    className="alert alert-danger mt-3"
                    role="alert"
                  >
                    {reviewError}
                  </div>
                )}

                <LeaveReviewForm
                  request={reviewingRequest}
                  onSubmit={handleReview}
                  onCancel={() => {
                    setReviewingRequest(null);
                    setReviewError('');
                  }}
                  submitting={reviewSubmitting}
                />
              </>
            )}

            {/* Staff-only Pending request actions */}
            {canManageSelected && !formOpen && (
              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  disabled={deletingId !== null}
                  onClick={() =>
                    openEditForm(selectedRequest)
                  }
                >
                  Edit Request
                </button>

                <button
                  type="button"
                  className="btn btn-outline-danger"
                  disabled={deletingId !== null}
                  onClick={() =>
                    handleDeleteRequest(selectedRequest)
                  }
                >
                  {deletingId ===
                  selectedRequest.leave_request_id
                    ? 'Deleting...'
                    : 'Delete Request'}
                </button>
              </div>
            )}

            {selectedRequest.status === 'Pending' &&
              !canManageSelected &&
              !canReviewSelected && (
                <p className="text-secondary small mb-0">
                  Only the employee who submitted this request
                  can edit or delete it.
                </p>
              )}

            {['Approved', 'Rejected'].includes(
              selectedRequest.status
            ) && (
              <p className="text-secondary small mb-0">
                This request has already been reviewed.
              </p>
            )}
          </section>
        )}
      </div>
    </>
  );
}

export default LeaveRequests;
