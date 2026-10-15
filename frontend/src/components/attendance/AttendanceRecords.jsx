
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useAuth } from '../../auth/useAuth';

import {
  checkIn,
  checkOut,
  correctAttendance,
  deleteAttendanceRecord,
  getAttendanceRecords,
} from '../../api/attendanceApi';

import AttendanceRecordingForm from './AttendanceRecordingForm';
import AttendanceCorrectionForm from './AttendanceCorrectionForm';

const statusClasses = {
  Present: 'text-bg-success',
  'Checked In': 'text-bg-primary',
  Late: 'text-bg-warning',
};

function shortTime(value) {
  return value ? String(value).slice(0, 5) : null;
}

function validShiftTimes(record) {
  return Boolean(
    record.roster_id &&
    record.shift_status === 'Active' &&
    record.scheduled_start_time &&
    record.scheduled_end_time &&
    record.scheduled_start_time < record.scheduled_end_time
  );
}

function formatMinutes(value) {
  const minutes = Number(value);

  if (!Number.isFinite(minutes)) {
    return '-';
  }

  const totalMinutes = Math.round(minutes);
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}min`;
  }

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}min`;
}

function ShiftDetails({ record }) {
  if (!record.roster_id) {
    return (
      <span className="text-secondary">
        No matching roster
      </span>
    );
  }

  return (
    <div>
      <div className="fw-semibold">
        {record.shift_name || 'Unknown shift'}
      </div>

      {record.scheduled_start_time &&
        record.scheduled_end_time && (
          <div className="small text-secondary text-nowrap">
            {shortTime(record.scheduled_start_time)}
            {' - '}
            {shortTime(record.scheduled_end_time)}
          </div>
        )}

      <div className="small text-secondary">
        Roster: {record.roster_status || 'Unknown'}
      </div>

      {record.shift_status !== 'Active' && (
        <div className="small text-warning-emphasis">
          Shift not active
        </div>
      )}

      {record.shift_status === 'Active' &&
        !validShiftTimes(record) && (
          <div className="small text-warning-emphasis">
            Review shift times
          </div>
        )}
    </div>
  );
}

function ArrivalReview({ record }) {
  if (!record.roster_id) {
    return (
      <span className="text-secondary">
        No roster to compare
      </span>
    );
  }

  if (!validShiftTimes(record)) {
    return (
      <span className="text-secondary">
        Shift needs review
      </span>
    );
  }

  const minutes = Number(record.minutes_after_start);

  if (
    record.minutes_after_start == null ||
    !Number.isFinite(minutes)
  ) {
    return (
      <span className="text-secondary">
        Not available
      </span>
    );
  }

  if (minutes === 0) {
    return (
      <span className="text-success-emphasis">
        On time or early
      </span>
    );
  }

  return (
    <span className="text-warning-emphasis">
      {formatMinutes(record.minutes_after_start)}
      {' after start'}
    </span>
  );
}

function DepartureReview({ record }) {
  if (record.checkout_review === 'Missing check-out') {
    return (
      <span className="text-danger-emphasis fw-semibold">
        Missing check-out
      </span>
    );
  }

  if (record.checkout_review === 'Still checked in') {
    return (
      <span className="text-primary-emphasis">
        Still checked in
      </span>
    );
  }

  if (!record.roster_id) {
    return (
      <span className="text-secondary">
        No roster to compare
      </span>
    );
  }

  if (!validShiftTimes(record)) {
    return (
      <span className="text-secondary">
        Shift needs review
      </span>
    );
  }

  const minutes = Number(record.minutes_before_end);

  if (
    record.minutes_before_end == null ||
    !Number.isFinite(minutes)
  ) {
    return (
      <span className="text-secondary">
        Not available
      </span>
    );
  }

  if (minutes === 0) {
    return (
      <span className="text-success-emphasis">
        At or after shift end
      </span>
    );
  }

  return (
    <span className="text-warning-emphasis">
      {formatMinutes(record.minutes_before_end)}
      {' before shift end'}
    </span>
  );
}

function AttendanceRecords({ headerActionContainer }) {
  const { user } = useAuth();

  const isManager = user?.roleName === 'Owner/Manager';

  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [activeForm, setActiveForm] = useState(null);

  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');

  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const lastTriggerRef = useRef(null);
  const recordButtonRef = useRef(null);
  const deletingRef = useRef(false);

  // READ - Load attendance and roster information.
  useEffect(() => {
    let cancelled = false;

    getAttendanceRecords()
      .then((data) => {
        if (cancelled) return;

        setRecords(
          Array.isArray(data.records) ? data.records : []
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
  }, []);

  // Restore keyboard focus after closing a form.
  useEffect(() => {
    if (
      activeForm === null &&
      lastTriggerRef.current
    ) {
      const target = lastTriggerRef.current.isConnected
        ? lastTriggerRef.current
        : recordButtonRef.current;

      target?.focus();
      lastTriggerRef.current = null;
    }
  }, [activeForm]);

  async function reloadRecords() {
    const data = await getAttendanceRecords();

    setRecords(
      Array.isArray(data.records) ? data.records : []
    );

    setLoadError('');
  }

  async function retryLoad() {
    setLoading(true);
    setLoadError('');

    try {
      await reloadRecords();
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setSearch('');
    setDateFilter('');
    setStatusFilter('');
  }

  function openForm(form, trigger) {
    if (deletingRef.current) {
      return;
    }

    lastTriggerRef.current = trigger;

    setMessage('');
    setActionError('');
    setActiveForm(form);
  }

  // CREATE / UPDATE - Check-in or check-out.
  async function recordAttendance(action) {
    try {
      const result =
        action === 'check-in'
          ? await checkIn()
          : await checkOut();

      await reloadRecords();

      setMessage(result.message);
      setActionError('');

      resetFilters();
      setActiveForm(null);

      return '';
    } catch (error) {
      return error.message;
    }
  }

  // UPDATE - Manager corrects attendance.
  async function saveCorrection(changes) {
    try {
      const result = await correctAttendance(
        activeForm.record.attendance_id,
        changes
      );

      await reloadRecords();

      setMessage(result.message);
      setActionError('');

      resetFilters();
      setActiveForm(null);

      return '';
    } catch (error) {
      return error.message;
    }
  }

  // DELETE - Manager removes an incorrect record.
  async function handleDeleteAttendance(record) {
    if (
      !isManager ||
      activeForm !== null ||
      deletingRef.current
    ) {
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to permanently delete this attendance record?\n\n' +
      `Employee: ${record.full_name}\n` +
      `Employee ID: ${record.employee_id}\n` +
      `Date: ${record.attendance_date}\n` +
      `Check-in: ${record.check_in_time || 'Not recorded'}\n` +
      `Check-out: ${record.check_out_time || 'Not recorded'}\n\n` +
      'This action cannot be undone.'
    );

    if (!confirmed) {
      return;
    }

    deletingRef.current = true;
    setDeletingId(record.attendance_id);

    setMessage('');
    setActionError('');

    try {
      const result = await deleteAttendanceRecord(
        record.attendance_id
      );

      setRecords((current) =>
        current.filter(
          (item) =>
            item.attendance_id !== record.attendance_id
        )
      );

      setMessage(
        result.message ||
        'Attendance record deleted successfully.'
      );

      try {
        await reloadRecords();
      } catch (refreshError) {
        setLoadError(
          refreshError.message ||
          'Attendance was deleted, but records could not be refreshed.'
        );
      }
    } catch (error) {
      setActionError(
        error.message ||
        'Unable to delete attendance record.'
      );
    } finally {
      deletingRef.current = false;
      setDeletingId(null);
    }
  }

  const query = search.trim().toLowerCase();

  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      String(record.full_name || '')
        .toLowerCase()
        .includes(query) ||
      String(record.employee_id).includes(query);

    const matchesDate =
      !dateFilter ||
      record.attendance_date === dateFilter;

    const matchesStatus =
      !statusFilter ||
      record.status === statusFilter;

    return (
      matchesSearch &&
      matchesDate &&
      matchesStatus
    );
  });

  const currentEmployee = {
    employee_id: user?.employeeId,
    full_name:
      user?.fullName ||
      user?.username ||
      'Signed-in employee',
  };

  return (
    <>
      {/* Record attendance button in the shared card header. */}
      {headerActionContainer &&
        createPortal(
          <button
            type="button"
            className="btn btn-primary"
            ref={recordButtonRef}
            disabled={
              activeForm !== null ||
              deletingId !== null
            }
            onClick={(event) =>
              openForm(
                { type: 'record' },
                event.currentTarget
              )
            }
          >
            Record attendance
          </button>,
          headerActionContainer
        )}

      <div className="mt-4">
        {message && (
          <div
            className="alert alert-success"
            role="status"
          >
            {message}
          </div>
        )}

        {loadError && (
          <div
            className="alert alert-danger"
            role="alert"
          >
            <p className="mb-2">{loadError}</p>

            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={retryLoad}
              disabled={
                loading ||
                deletingId !== null
              }
            >
              Try again
            </button>
          </div>
        )}

        {actionError && (
          <div
            className="alert alert-danger"
            role="alert"
          >
            {actionError}
          </div>
        )}

        {activeForm?.type === 'record' && (
          <AttendanceRecordingForm
            employee={currentEmployee}
            onRecord={recordAttendance}
            onCancel={() => setActiveForm(null)}
          />
        )}

        {activeForm?.type === 'correct' &&
          isManager && (
            <AttendanceCorrectionForm
              record={activeForm.record}
              onSave={saveCorrection}
              onCancel={() => setActiveForm(null)}
            />
          )}

        {/* Search and filters */}
        <div className="row g-3 align-items-end mb-4">
          <div className="col-12 col-md-6 col-lg-4">
            <label
              htmlFor="attendance-search"
              className="form-label"
            >
              Search employee
            </label>

            <input
              id="attendance-search"
              type="search"
              className="form-control"
              placeholder="Employee name or ID"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <div className="col-12 col-md-6 col-lg-3">
            <label
              htmlFor="attendance-date"
              className="form-label"
            >
              Attendance date
            </label>

            <input
              id="attendance-date"
              type="date"
              className="form-control"
              value={dateFilter}
              onChange={(event) =>
                setDateFilter(event.target.value)
              }
            />
          </div>

          <div className="col-12 col-md-6 col-lg-3">
            <label
              htmlFor="attendance-status"
              className="form-label"
            >
              Status
            </label>

            <select
              id="attendance-status"
              className="form-select"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="">All statuses</option>
              <option value="Checked In">Checked In</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
            </select>
          </div>

          <div className="col-12 col-md-6 col-lg-2">
            <button
              type="button"
              className="btn btn-outline-secondary w-100"
              onClick={resetFilters}
            >
              Reset
            </button>
          </div>
        </div>

        <p
          className="small text-secondary mb-3"
          role="status"
        >
          {loading
            ? 'Loading attendance records...'
            : `Showing ${filteredRecords.length} of ${records.length} records.`}
        </p>

        {!loading && (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <caption className="visually-hidden">
                Attendance records and roster comparisons
              </caption>

              <thead className="table-light">
                <tr>
                  <th scope="col">Employee</th>
                  <th scope="col">Employee ID</th>
                  <th scope="col">Date</th>
                  <th scope="col">Check-in</th>
                  <th scope="col">Check-out</th>
                  <th scope="col">Status</th>
                  <th scope="col">Assigned shift</th>
                  <th scope="col">Arrival review</th>
                  <th scope="col">Departure review</th>

                  {isManager && (
                    <th scope="col">Action</th>
                  )}
                </tr>
              </thead>

              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isManager ? 10 : 9}
                      className="text-center text-secondary py-4"
                    >
                      No attendance records match these filters.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => (
                    <tr key={record.attendance_id}>
                      <td>
                        {record.full_name}

                        {record.correction_note && (
                          <div className="small text-secondary mt-1 text-break">
                            Correction: {record.correction_note}
                          </div>
                        )}
                      </td>

                      <td>{record.employee_id}</td>

                      <td className="text-nowrap">
                        {record.attendance_date}
                      </td>

                      <td>
                        {shortTime(record.check_in_time) ||
                          'Not recorded'}
                      </td>

                      <td>
                        {shortTime(record.check_out_time) ||
                          'Not checked out'}
                      </td>

                      <td>
                        <span
                          className={`badge ${
                            statusClasses[record.status] ??
                            'text-bg-secondary'
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>

                      <td>
                        <ShiftDetails record={record} />
                      </td>

                      <td>
                        <ArrivalReview record={record} />
                      </td>

                      <td>
                        <DepartureReview record={record} />
                      </td>

                      {isManager && (
                        <td>
                          <div className="d-flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              disabled={
                                activeForm !== null ||
                                deletingId !== null
                              }
                              aria-label={`Correct attendance for ${record.full_name} on ${record.attendance_date}`}
                              onClick={(event) =>
                                openForm(
                                  {
                                    type: 'correct',
                                    record,
                                  },
                                  event.currentTarget
                                )
                              }
                            >
                              Correct
                            </button>

                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              disabled={
                                activeForm !== null ||
                                deletingId !== null
                              }
                              aria-label={`Delete attendance for ${record.full_name} on ${record.attendance_date}`}
                              onClick={() =>
                                handleDeleteAttendance(record)
                              }
                            >
                              {deletingId === record.attendance_id
                                ? 'Deleting...'
                                : 'Delete'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default AttendanceRecords;
