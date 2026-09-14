import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import {
  checkIn,
  checkOut,
  correctAttendance,
  getAttendanceRecords,
} from '../../api/attendanceApi';
import AttendanceRecordingForm from './AttendanceRecordingForm';
import AttendanceCorrectionForm from './AttendanceCorrectionForm';

const statusClasses = {
  Present: 'text-bg-success',
  'Checked In': 'text-bg-primary',
  Late: 'text-bg-warning',
};

function AttendanceRecords() {
  const { user } = useAuth();
  const isManager = user?.roleName === 'Owner/Manager';

  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeForm, setActiveForm] = useState(null);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  const lastTriggerRef = useRef(null);
  const recordButtonRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    getAttendanceRecords()
      .then((data) => {
        if (cancelled) return;

        setRecords(Array.isArray(data.records) ? data.records : []);
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

  useEffect(() => {
    if (activeForm === null && lastTriggerRef.current) {
      const target = lastTriggerRef.current.isConnected
        ? lastTriggerRef.current
        : recordButtonRef.current;

      target?.focus();
      lastTriggerRef.current = null;
    }
  }, [activeForm]);

  async function reloadRecords() {
    const data = await getAttendanceRecords();
    setRecords(Array.isArray(data.records) ? data.records : []);
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

  const query = search.trim().toLowerCase();

  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      String(record.full_name || '').toLowerCase().includes(query) ||
      String(record.employee_id).includes(query);

    const matchesDate =
      dateFilter === '' || record.attendance_date === dateFilter;

    const matchesStatus =
      statusFilter === '' || record.status === statusFilter;

    return matchesSearch && matchesDate && matchesStatus;
  });

  function resetFilters() {
    setSearch('');
    setDateFilter('');
    setStatusFilter('');
  }

  function openForm(form, trigger) {
    lastTriggerRef.current = trigger;
    setMessage('');
    setActiveForm(form);
  }

  async function recordAttendance(action) {
    try {
      const result = action === 'check-in'
        ? await checkIn()
        : await checkOut();

      await reloadRecords();
      setMessage(result.message);
      resetFilters();
      setActiveForm(null);

      return '';
    } catch (error) {
      return error.message;
    }
  }

  async function saveCorrection(changes) {
    try {
      const result = await correctAttendance(
        activeForm.record.attendance_id,
        changes
      );

      await reloadRecords();
      setMessage(result.message);
      resetFilters();
      setActiveForm(null);

      return '';
    } catch (error) {
      return error.message;
    }
  }

  const currentEmployee = {
    employee_id: user?.employeeId,
    full_name: user?.fullName || user?.username || 'Signed-in employee',
  };

  return (
    <div className="mt-4">

      <div className="d-flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          className="btn btn-primary"
          ref={recordButtonRef}
          disabled={activeForm !== null}
          onClick={(event) =>
            openForm({ type: 'record' }, event.currentTarget)
          }
        >
          Record attendance
        </button>
      </div>

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
            onClick={retryLoad}
          >
            Try again
          </button>
        </div>
      )}

      {activeForm?.type === 'record' && (
        <AttendanceRecordingForm
          employee={currentEmployee}
          onRecord={recordAttendance}
          onCancel={() => setActiveForm(null)}
        />
      )}

      {activeForm?.type === 'correct' && isManager && (
        <AttendanceCorrectionForm
          record={activeForm.record}
          onSave={saveCorrection}
          onCancel={() => setActiveForm(null)}
        />
      )}

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
            onChange={(event) => setSearch(event.target.value)}
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
            onChange={(event) => setDateFilter(event.target.value)}
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
            onChange={(event) => setStatusFilter(event.target.value)}
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

      <p className="small text-secondary mb-3" role="status">
        {loading
          ? 'Loading attendance records...'
          : `Showing ${filteredRecords.length} of ${records.length} records.`}
      </p>

      {!loading && (
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <caption className="visually-hidden">
              Attendance records stored in the PharmaShift database
            </caption>

            <thead className="table-light">
              <tr>
                <th scope="col">Employee</th>
                <th scope="col">Employee ID</th>
                <th scope="col">Date</th>
                <th scope="col">Check-in</th>
                <th scope="col">Check-out</th>
                <th scope="col">Status</th>
                {isManager && <th scope="col">Action</th>}
              </tr>
            </thead>

            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={isManager ? 7 : 6}
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
                      {record.check_in_time?.slice(0, 5) || 'Not recorded'}
                    </td>

                    <td>
                      {record.check_out_time
                        ? record.check_out_time.slice(0, 5)
                        : 'Not checked out'}
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

                    {isManager && (
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          disabled={activeForm !== null}
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
  );
}

export default AttendanceRecords;