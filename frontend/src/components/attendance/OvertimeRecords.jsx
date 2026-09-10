import { useEffect, useRef, useState } from 'react';
import OvertimeForm from './OvertimeForm';
import OvertimeDetails from './OvertimeDetails';

// Demo employees until the employee API is connected.
const employees = [
  { employee_id: 101, full_name: 'Demo Employee A' },
  { employee_id: 102, full_name: 'Demo Employee B' },
  { employee_id: 103, full_name: 'Demo Employee C' },
];
const statusClasses = {
  Pending: 'text-bg-warning', Approved: 'text-bg-success', Rejected: 'text-bg-danger',
};
const sampleRecords = [
  { overtime_id: 1, ...employees[0], overtime_date: '2026-09-09', hours_worked: 2, status: 'Approved' },
  { overtime_id: 2, ...employees[1], overtime_date: '2026-09-09', hours_worked: 1.5, status: 'Pending' },
  { overtime_id: 3, ...employees[0], overtime_date: '2026-09-08', hours_worked: 0.5, status: 'Rejected' },
];
const emptyFilters = { search: '', date: '', status: '' };

function OvertimeRecords() {
  // Demo changes reset when the page reloads.
  const [records, setRecords] = useState(sampleRecords);
  const [filters, setFilters] = useState(emptyFilters);
  const [activeForm, setActiveForm] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [message, setMessage] = useState('');
  const addButtonRef = useRef(null);
  const lastFormTriggerRef = useRef(null);
  const lastViewRef = useRef(null);

  // Return focus after the form closes and its buttons are enabled again.
  useEffect(() => {
    if (activeForm === null && lastFormTriggerRef.current) {
      const target = lastFormTriggerRef.current.isConnected ? lastFormTriggerRef.current : addButtonRef.current;
      target?.focus();
      lastFormTriggerRef.current = null;
    }
  }, [activeForm]);

  const query = filters.search.trim().toLowerCase();
  const filteredRecords = records.filter((record) => {
    const label = `OT-${String(record.overtime_id).padStart(4, '0')}`;
    return `${record.full_name} ${record.employee_id} ${label}`.toLowerCase().includes(query) &&
      (!filters.date || record.overtime_date === filters.date) &&
      (!filters.status || record.status === filters.status);
  });
  const selectedRecord = records.find((record) => record.overtime_id === selectedId);

  function updateFilter(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
    setSelectedId(null);
    setMessage('');
  }

  function openForm(record, trigger) {
    lastFormTriggerRef.current = trigger;
    setActiveForm({ record });
    setSelectedId(null);
    setMessage('');
  }

  // TODO: Check manager permissions and save through the API.
  function saveRecord(values) {
    const employee = employees.find((item) => item.employee_id === values.employee_id);
    if (!employee) return 'Select an employee from the list.';
    const editingId = activeForm.record?.overtime_id;
    if (editingId && !records.some((record) => record.overtime_id === editingId)) {
      return 'This overtime record could not be found.';
    }

    // Exclude the current record when checking the employee's total for that date.
    const otherHours = records.filter((record) =>
      record.employee_id === employee.employee_id && record.overtime_date === values.overtime_date &&
      record.overtime_id !== editingId
    ).reduce((total, record) => total + Math.round(Number(record.hours_worked) * 100), 0);
    if (otherHours + Math.round(values.hours_worked * 100) > 2400) {
      return 'Total overtime for an employee on one date cannot exceed 24 hours.';
    }

    const id = editingId ?? Math.max(0, ...records.map((record) => record.overtime_id)) + 1;
    const updatedRecord = { ...values, ...employee, overtime_id: id };
    setRecords((current) => editingId
      ? current.map((record) => record.overtime_id === id ? updatedRecord : record)
      : [updatedRecord, ...current]
    );
    // Show the saved record even if filters were active.
    setFilters(emptyFilters);
    setMessage(`Preview overtime OT-${String(id).padStart(4, '0')} ${editingId ? 'updated' : 'added'}. No database record was changed.`);
    setActiveForm(null);
    return '';
  }

  function closeDetails() {
    setSelectedId(null);
    if (lastViewRef.current?.isConnected) lastViewRef.current.focus();
    else addButtonRef.current?.focus();
  }

  return (
    <div className="mt-4">
      <p className="small text-secondary">Manager preview with fictional employees. Refreshing the page resets all preview changes.</p>
      <button type="button" className="btn btn-primary mb-4" ref={addButtonRef}
        disabled={activeForm !== null} onClick={(event) => openForm(null, event.currentTarget)}>Add overtime</button>
      {message && <div className="alert alert-info" role="status">{message}</div>}
      {activeForm && <OvertimeForm key={activeForm.record?.overtime_id ?? 'new'} record={activeForm.record}
        employees={employees} statuses={Object.keys(statusClasses)} onSave={saveRecord}
        onCancel={() => setActiveForm(null)} />}

      <div className="row g-3 align-items-end mb-4">
        <div className="col-12 col-md-6 col-lg-4">
          <label htmlFor="overtime-search" className="form-label">Search employee or record</label>
          <input id="overtime-search" name="search" type="search" className="form-control"
            placeholder="Employee name, employee ID or record ID" value={filters.search} onChange={updateFilter} />
        </div>
        <div className="col-12 col-md-6 col-lg-3">
          <label htmlFor="overtime-filter-date" className="form-label">Overtime date</label>
          <input id="overtime-filter-date" name="date" type="date" className="form-control"
            value={filters.date} onChange={updateFilter} />
        </div>
        <div className="col-12 col-md-6 col-lg-3">
          <label htmlFor="overtime-filter-status" className="form-label">Status</label>
          <select id="overtime-filter-status" name="status" className="form-select"
            value={filters.status} onChange={updateFilter}>
            <option value="">All statuses</option>
            {Object.keys(statusClasses).map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
        <div className="col-12 col-md-6 col-lg-2">
          <button type="button" className="btn btn-outline-secondary w-100" onClick={() => {
            setFilters(emptyFilters); setSelectedId(null); setMessage('');
          }}>Reset filters</button>
        </div>
      </div>

      <div className="row g-4">
        <div className={selectedRecord ? 'col-12 col-xl-8' : 'col-12'}>
          <p className="small" role="status">Showing {filteredRecords.length} of {records.length} demo records.</p>
          <div className="table-responsive" role="region" aria-label="Overtime records table" tabIndex={0}>
            <table className="table table-hover align-middle mb-0 small">
              <caption className="visually-hidden">Fictional overtime records with view and edit actions.</caption>
              <thead className="table-light"><tr>
                <th scope="col">Record ID</th><th scope="col">Employee</th><th scope="col">Date</th>
                <th scope="col">Hours</th><th scope="col">Status</th><th scope="col">Actions</th>
              </tr></thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.overtime_id} className={selectedId === record.overtime_id ? 'table-primary' : ''}>
                    <th scope="row" className="fw-normal text-nowrap">OT-{String(record.overtime_id).padStart(4, '0')}</th>
                    <td>{record.full_name}<span className="d-block text-secondary">ID: {record.employee_id}</span></td>
                    <td className="text-nowrap">{record.overtime_date}</td><td>{Number(record.hours_worked).toFixed(2)}</td>
                    <td><span className={`badge ${statusClasses[record.status]}`}>{record.status}</span></td>
                    <td><div className="d-flex flex-wrap gap-2">
                      <button type="button" className="btn btn-sm btn-outline-primary" disabled={activeForm !== null}
                        aria-label={`View overtime OT-${String(record.overtime_id).padStart(4, '0')} for ${record.full_name}`}
                        aria-pressed={selectedId === record.overtime_id} onClick={(event) => {
                          lastViewRef.current = event.currentTarget; setSelectedId(record.overtime_id); setMessage('');
                        }}>View</button>
                      <button type="button" className="btn btn-sm btn-outline-secondary" disabled={activeForm !== null}
                        aria-label={`Edit overtime OT-${String(record.overtime_id).padStart(4, '0')} for ${record.full_name}`}
                        onClick={(event) => openForm(record, event.currentTarget)}>Edit</button>
                    </div></td>
                  </tr>
                ))}
                {filteredRecords.length === 0 && <tr><td colSpan={6} className="text-center text-secondary py-4">No records match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        {selectedRecord && <div className="col-12 col-xl-4">
          <OvertimeDetails key={selectedRecord.overtime_id} record={selectedRecord} onEdit={openForm} onClose={closeDetails} />
        </div>}
      </div>
    </div>
  );
}

export default OvertimeRecords;
