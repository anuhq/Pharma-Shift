import { useEffect, useRef, useState } from 'react';
import AttendanceRecordingForm from './AttendanceRecordingForm';
import AttendanceCorrectionForm from './AttendanceCorrectionForm';

// Fictional records for the interface preview. These are not database records.
const sampleAttendance = [
  {
    attendance_id: 1,
    employee_id: 101,
    full_name: 'Demo Employee A',
    attendance_date: '2026-09-09',
    check_in_time: '08:55:00',
    check_out_time: '17:00:00',
    status: 'Present',
  },
  {
    attendance_id: 2,
    employee_id: 102,
    full_name: 'Demo Employee B',
    attendance_date: '2026-09-09',
    check_in_time: '09:20:00',
    check_out_time: null,
    status: 'Late',
  },
  {
    attendance_id: 3,
    employee_id: 101,
    full_name: 'Demo Employee A',
    attendance_date: '2026-09-08',
    check_in_time: '08:50:00',
    check_out_time: '17:05:00',
    status: 'Present',
  },
];

const statusClasses = {
  Present: 'text-bg-success',
  Late: 'text-bg-warning',
};

// UI fixture only. Production staff identity must come from the authenticated
// backend session, and production attendance timestamps must come from the server.
const previewEmployee = { employee_id: 103, full_name: 'Demo Employee C' };

function getLocalAttendanceStamp() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return {
    date: `${now.getFullYear()}-${month}-${day}`,
    time: now.toTimeString().slice(0, 8),
  };
}

function AttendanceRecords() {
  const [records, setRecords] = useState(sampleAttendance);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeForm, setActiveForm] = useState(null);
  const [message, setMessage] = useState('');
  const lastTriggerRef = useRef(null);
  const recordButtonRef = useRef(null);

  useEffect(() => {
    if (activeForm === null && lastTriggerRef.current) {
      const target = lastTriggerRef.current.isConnected
        ? lastTriggerRef.current
        : recordButtonRef.current;
      target?.focus();
      lastTriggerRef.current = null;
    }
  }, [activeForm]);

  const query = search.trim().toLowerCase();

  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      record.full_name.toLowerCase().includes(query) ||
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

  function recordAttendance(action) {
    const stamp = getLocalAttendanceStamp();
    const todayRecord = records.find((record) =>
      record.employee_id === previewEmployee.employee_id &&
      record.attendance_date === stamp.date
    );
    const openRecord = records.find((record) =>
      record.employee_id === previewEmployee.employee_id && !record.check_out_time
    );

    if (action === 'check-in') {
      if (todayRecord) return 'A check-in already exists for this employee today.';
      if (openRecord) return 'An earlier attendance entry is still awaiting check-out.';

      const nextId = Math.max(0, ...records.map((record) => record.attendance_id)) + 1;
      setRecords((current) => [{
        attendance_id: nextId,
        ...previewEmployee,
        attendance_date: stamp.date,
        check_in_time: stamp.time,
        check_out_time: null,
        // Preview default only; lateness needs the agreed roster rules later.
        status: 'Present',
      }, ...current]);
      setMessage('Preview check-in added for Demo Employee C. No database record was created.');
    } else if (action === 'check-out') {
      if (!todayRecord) return 'Check in before checking out. This preview uses same-day attendance records.';
      if (todayRecord.check_out_time) return 'This attendance record already has a check-out.';
      if (stamp.time < todayRecord.check_in_time) return 'Check-out cannot be before check-in.';

      setRecords((current) => current.map((record) =>
        record.attendance_id === todayRecord.attendance_id
          ? { ...record, check_out_time: stamp.time }
          : record
      ));
      setMessage('Preview check-out added for Demo Employee C. No database record was changed.');
    } else {
      return 'Select check-in or check-out.';
    }

    resetFilters();
    setActiveForm(null);
    return '';
  }

  function saveCorrection(changes) {
    setRecords((current) => current.map((record) =>
      record.attendance_id === activeForm.record.attendance_id
        ? { ...record, ...changes }
        : record
    ));
    setMessage('Preview correction applied. No database record was changed.');
    resetFilters();
    setActiveForm(null);
  }

  return (
    <div className="mt-4">
      <p className="small text-secondary">
        Fictional data only. Staff and manager controls are shown together for
        interface testing. Refreshing the page resets all preview changes.
      </p>

      <div className="d-flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          className="btn btn-primary"
          ref={recordButtonRef}
          disabled={activeForm !== null}
          onClick={(event) => openForm({ type: 'record' }, event.currentTarget)}
        >
          Record attendance
        </button>
      </div>

      {message && <div className="alert alert-info" role="status">{message}</div>}

      {activeForm?.type === 'record' && (
        <AttendanceRecordingForm
          employee={previewEmployee}
          onRecord={recordAttendance}
          onCancel={() => setActiveForm(null)}
        />
      )}

      {activeForm?.type === 'correct' && (
        <AttendanceCorrectionForm
          record={activeForm.record}
          onSave={saveCorrection}
          onCancel={() => setActiveForm(null)}
        />
      )}

      <div className="row g-3 align-items-end mb-4">
        <div className="col-12 col-md-6 col-lg-4">
          <label htmlFor="attendance-search" className="form-label">
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
          <label htmlFor="attendance-date" className="form-label">
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
          <label htmlFor="attendance-status" className="form-label">
            Status
          </label>
          <select
            id="attendance-status"
            className="form-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
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
        Showing {filteredRecords.length} of {records.length} demo records.
      </p>

      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <caption className="visually-hidden">
            Fictional attendance records for the interface preview
          </caption>
          <thead className="table-light">
            <tr>
              <th scope="col">Employee</th>
              <th scope="col">Employee ID</th>
              <th scope="col">Date</th>
              <th scope="col">Check-in</th>
              <th scope="col">Check-out</th>
              <th scope="col">Status</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-secondary py-4">
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
                  <td className="text-nowrap">{record.attendance_date}</td>
                  <td>{record.check_in_time.slice(0, 5)}</td>
                  <td>
                    {record.check_out_time
                      ? record.check_out_time.slice(0, 5)
                      : 'Not checked out'}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        statusClasses[record.status] ?? 'text-bg-secondary'
                      }`}
                    >
                      {record.status}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      disabled={activeForm !== null}
                      aria-label={`Correct attendance for ${record.full_name} on ${record.attendance_date}`}
                      onClick={(event) => openForm({ type: 'correct', record }, event.currentTarget)}
                    >
                      Correct
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AttendanceRecords;
