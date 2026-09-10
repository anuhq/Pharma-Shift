import { useEffect, useRef, useState } from 'react';
import LeaveRequestForm from './LeaveRequestForm';
import LeaveRequestDetails from './LeaveRequestDetails';

const leaveTypes = ['Annual Leave', 'Sick Leave', 'Casual Leave', 'Maternity Leave'];
const statusClasses = {
  Pending: 'text-bg-warning', Approved: 'text-bg-success', Rejected: 'text-bg-danger',
};

// Demo users until login is connected.
const previewEmployee = { employee_id: 103, full_name: 'Demo Employee C' };
const previewManager = { employee_id: 104, full_name: 'Demo Manager' };
const sampleRequests = [
  {
    leave_request_id: 1, employee_id: 101, full_name: 'Demo Employee A',
    leave_type: 'Annual Leave', start_date: '2026-09-14', end_date: '2026-09-16',
    reason: 'Fictional family event.', status: 'Pending',
  },
  {
    leave_request_id: 2, employee_id: 102, full_name: 'Demo Employee B',
    leave_type: 'Sick Leave', start_date: '2026-09-11', end_date: '2026-09-11',
    reason: 'Fictional appointment.', status: 'Approved',
  },
  {
    leave_request_id: 3, employee_id: 103, full_name: 'Demo Employee C',
    leave_type: 'Casual Leave', start_date: '2026-09-18', end_date: '2026-09-18',
    reason: 'Fictional personal commitment.', status: 'Rejected',
  },
  {
    leave_request_id: 4, ...previewManager,
    leave_type: 'Annual Leave', start_date: '2026-09-21', end_date: '2026-09-22',
    reason: 'Fictional manager request for testing the own-request rule.', status: 'Pending',
  },
];
const emptyFilters = { search: '', type: '', status: '', from: '', to: '' };

function LeaveRequests() {
  // Demo changes reset when the page reloads.
  const [requests, setRequests] = useState(sampleRequests);
  const [filters, setFilters] = useState(emptyFilters);
  const [selectedId, setSelectedId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState('');
  const submitButtonRef = useRef(null);
  const lastViewRef = useRef(null);
  const restoreSubmitFocusRef = useRef(false);

  // Return focus to the button that opened the form.
  useEffect(() => {
    if (!formOpen && restoreSubmitFocusRef.current) {
      submitButtonRef.current?.focus();
      restoreSubmitFocusRef.current = false;
    }
  }, [formOpen]);

  const invalidRange = filters.from && filters.to && filters.to < filters.from;
  const query = filters.search.trim().toLowerCase();

  // Include leave that overlaps the selected dates.
  const filteredRequests = requests.filter((request) => {
    const label = `LR-${String(request.leave_request_id).padStart(4, '0')}`;
    return !invalidRange &&
      `${request.full_name} ${request.employee_id} ${label}`.toLowerCase().includes(query) &&
      (!filters.type || request.leave_type === filters.type) &&
      (!filters.status || request.status === filters.status) &&
      (!filters.from || request.end_date >= filters.from) &&
      (!filters.to || request.start_date <= filters.to);
  });
  const selectedRequest = requests.find((request) => request.leave_request_id === selectedId);

  function updateFilter(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
    setSelectedId(null);
    setMessage('');
  }

  function closeForm() {
    restoreSubmitFocusRef.current = true;
    setFormOpen(false);
  }

  function addRequest(values) {
    const nextId = Math.max(0, ...requests.map((request) => request.leave_request_id)) + 1;
    setRequests((current) => [{
      ...values, ...previewEmployee, leave_request_id: nextId, status: 'Pending',
    }, ...current]);
    // Show the new request even if filters were active.
    setFilters(emptyFilters);
    setSelectedId(null);
    setMessage(`Preview request LR-${String(nextId).padStart(4, '0')} added with Pending status. No database record was created.`);
    closeForm();
  }

  // TODO: Enforce these rules in the API when leave requests are connected.
  function decideRequest(requestId, decision) {
    const request = requests.find((item) => item.leave_request_id === requestId);
    if (!request) return 'The request could not be found.';
    if (request.employee_id === previewManager.employee_id) return 'Another manager must review your own request.';
    if (request.status !== 'Pending') return 'Only a pending request can be decided.';
    if (!['Approved', 'Rejected'].includes(decision)) return 'Select approval or rejection.';
    setRequests((current) => current.map((item) =>
      item.leave_request_id === requestId ? { ...item, status: decision } : item
    ));
    setFilters(emptyFilters);
    setMessage(`Preview request LR-${String(requestId).padStart(4, '0')} ${decision.toLowerCase()}. No database record was changed.`);
    return '';
  }

  function closeDetails() {
    setSelectedId(null);
    if (lastViewRef.current?.isConnected) lastViewRef.current.focus();
    else submitButtonRef.current?.focus();
  }

  return (
    <div className="mt-4">
      <p className="small text-secondary">
        Fictional data only. Staff and manager controls are shown together for
        interface testing. Refreshing the page resets all preview changes.
      </p>
      <button type="button" className="btn btn-primary mb-4" ref={submitButtonRef}
        disabled={formOpen} onClick={() => {
          setMessage(''); setSelectedId(null); setFormOpen(true);
        }}>
        Submit leave request
      </button>
      {message && <div className="alert alert-info" role="status">{message}</div>}
      {formOpen && <LeaveRequestForm employee={previewEmployee} leaveTypes={leaveTypes}
        onSubmit={addRequest} onCancel={closeForm} />}

      <div className="row g-3 align-items-end mb-3">
        <div className="col-12 col-md-6 col-xl-4">
          <label htmlFor="leave-search" className="form-label">Search employee or request</label>
          <input id="leave-search" name="search" type="search" className="form-control"
            placeholder="Employee name, employee ID or request ID"
            value={filters.search} onChange={updateFilter} />
        </div>
        <div className="col-12 col-md-6 col-xl-4">
          <label htmlFor="leave-type-filter" className="form-label">Leave type</label>
          <select id="leave-type-filter" name="type" className="form-select"
            value={filters.type} onChange={updateFilter}>
            <option value="">All leave types</option>
            {leaveTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <div className="col-12 col-md-6 col-xl-4">
          <label htmlFor="leave-status-filter" className="form-label">Status</label>
          <select id="leave-status-filter" name="status" className="form-select"
            value={filters.status} onChange={updateFilter}>
            <option value="">All statuses</option>
            {Object.keys(statusClasses).map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
        <div className="col-12 col-md-6 col-xl-4">
          <label htmlFor="leave-filter-from" className="form-label">Date range: from</label>
          <input id="leave-filter-from" name="from" type="date" className="form-control"
            value={filters.from} onChange={updateFilter} aria-describedby="leave-range-help" />
        </div>
        <div className="col-12 col-md-6 col-xl-4">
          <label htmlFor="leave-filter-to" className="form-label">Date range: to</label>
          <input id="leave-filter-to" name="to" type="date"
            className={`form-control${invalidRange ? ' is-invalid' : ''}`}
            value={filters.to} onChange={updateFilter} aria-invalid={Boolean(invalidRange)}
            aria-describedby={invalidRange ? 'leave-range-error' : 'leave-range-help'} />
        </div>
        <div className="col-12 col-md-6 col-xl-4">
          <button type="button" className="btn btn-outline-secondary w-100" onClick={() => {
            setFilters(emptyFilters); setSelectedId(null); setMessage('');
          }}>Reset filters</button>
        </div>
      </div>
      <p id="leave-range-help" className="small">Filters apply as you type. The date range includes leave that overlaps those dates.</p>
      {invalidRange && <div id="leave-range-error" className="alert alert-danger" role="alert">The end of the date range cannot be before its start.</div>}

      <div className="row g-4">
        <div className={selectedRequest ? 'col-12 col-xl-8' : 'col-12'}>
          <p className="small" role="status">Showing {filteredRequests.length} of {requests.length} demo requests.</p>
          <div className="table-responsive" role="region" aria-label="Leave requests table" tabIndex={0}>
            <table className="table table-hover align-middle mb-0 small">
              <caption className="visually-hidden">Fictional leave requests. Use View to open request details.</caption>
              <thead className="table-light"><tr>
                <th scope="col">Request ID</th><th scope="col">Employee</th>
                <th scope="col">Leave type</th><th scope="col">Start date</th>
                <th scope="col">End date</th><th scope="col">Status</th><th scope="col">Action</th>
              </tr></thead>
              <tbody>
                {filteredRequests.map((request) => (
                  <tr key={request.leave_request_id} className={selectedId === request.leave_request_id ? 'table-primary' : ''}>
                    <th scope="row" className="fw-normal text-nowrap">LR-{String(request.leave_request_id).padStart(4, '0')}</th>
                    <td>{request.full_name}<span className="d-block text-secondary">ID: {request.employee_id}</span></td>
                    <td>{request.leave_type}</td>
                    <td className="text-nowrap">{request.start_date}</td><td className="text-nowrap">{request.end_date}</td>
                    <td><span className={`badge ${statusClasses[request.status]}`}>{request.status}</span></td>
                    <td><button type="button" className="btn btn-sm btn-outline-primary" disabled={formOpen}
                      aria-label={`View request LR-${String(request.leave_request_id).padStart(4, '0')} for ${request.full_name}`}
                      aria-pressed={selectedId === request.leave_request_id}
                      onClick={(event) => {
                        lastViewRef.current = event.currentTarget;
                        setSelectedId(request.leave_request_id); setMessage('');
                      }}>View</button></td>
                  </tr>
                ))}
                {filteredRequests.length === 0 && <tr><td colSpan={7} className="text-center text-secondary py-4">
                  {invalidRange ? 'Correct the date range to view requests.' : 'No requests match these filters.'}
                </td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        {selectedRequest && <div className="col-12 col-xl-4">
          <LeaveRequestDetails key={selectedRequest.leave_request_id} request={selectedRequest}
            manager={previewManager} onDecision={decideRequest} onClose={closeDetails} />
        </div>}
      </div>
    </div>
  );
}

export default LeaveRequests;
