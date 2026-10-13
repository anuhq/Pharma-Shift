
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { useAuth } from '../../auth/useAuth';

import {
  getOvertimeRecords,
  getEligibleOvertimeEmployees,
  createOvertimeRecord,
  updateOvertimeRecord,
  deleteOvertimeRecord,
} from '../../api/overtimeApi';

import OvertimeDetails from './OvertimeDetails';
import OvertimeForm from './OvertimeForm';

const statusClasses = {
  Pending: 'text-bg-warning',
  Approved: 'text-bg-success',
  Rejected: 'text-bg-danger',
  Cancelled: 'text-bg-secondary',
};

const emptyFilters = {
  search: '',
  date: '',
  status: '',
};

function recordLabel(id) {
  return `OT-${String(id).padStart(4, '0')}`;
}

function OvertimeRecords({ headerActionContainer }) {
  const { user } = useAuth();

  const roleName =
    user?.roleName ??
    user?.role_name ??
    user?.role;

  const isManager = roleName === 'Owner/Manager';

  const [records, setRecords] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [selectedId, setSelectedId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [formMode, setFormMode] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);

  const [eligibleEmployees, setEligibleEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState('');

  const [successMessage, setSuccessMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const [deletingId, setDeletingId] = useState(null);

  // READ - Load overtime records from MySQL.
  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setLoadError('');
    setRecords([]);
    setSelectedId(null);
    setFormMode(null);
    setEditingRecord(null);
    setEligibleEmployees([]);
    setSuccessMessage('');
    setActionError('');

    getOvertimeRecords()
      .then((data) => {
        if (cancelled) return;

        setRecords(
          Array.isArray(data.records) ? data.records : []
        );
      })
      .catch((error) => {
        if (cancelled) return;

        setLoadError(error.message);
        setRecords([]);
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

  // Refresh overtime records after Create, Edit or Delete.
  async function reloadRecords() {
    setLoading(true);
    setLoadError('');
    setSelectedId(null);

    try {
      const data = await getOvertimeRecords();

      setRecords(
        Array.isArray(data.records) ? data.records : []
      );
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }

  // Open the Create or Edit form.
  async function openForm(mode, record = null) {
    if (!isManager || deletingId !== null) {
      return;
    }

    if (mode === 'edit') {
      if (!record || record.status !== 'Approved') {
        return;
      }
    }

    setFormMode(mode);
    setEditingRecord(
      mode === 'edit' ? record : null
    );

    setSelectedId(null);
    setSuccessMessage('');
    setActionError('');

    setEmployeesLoading(true);
    setEmployeesError('');
    setEligibleEmployees([]);

    try {
      const data = await getEligibleOvertimeEmployees();

      setEligibleEmployees(
        Array.isArray(data.employees)
          ? data.employees
          : []
      );
    } catch (error) {
      setEmployeesError(error.message);
    } finally {
      setEmployeesLoading(false);
    }
  }

  function closeForm() {
    setFormMode(null);
    setEditingRecord(null);
    setEligibleEmployees([]);
    setEmployeesError('');
  }

  // CREATE or UPDATE - Save overtime details.
  async function handleSaveOvertime(formData) {
    if (!isManager) {
      throw new Error(
        'Only the Owner/Manager can manage overtime records.'
      );
    }

    let response;

    if (formMode === 'edit' && editingRecord) {
      response = await updateOvertimeRecord(
        editingRecord.overtime_id,
        formData
      );
    } else if (formMode === 'create') {
      response = await createOvertimeRecord(formData);
    } else {
      throw new Error(
        'No overtime form is currently active.'
      );
    }

    closeForm();

    setSuccessMessage(
      response.message ||
      'Overtime record saved successfully.'
    );

    setActionError('');
    setFilters(emptyFilters);

    await reloadRecords();
  }

  // DELETE - Permanently remove an overtime record.
  async function handleDeleteOvertime(record) {
    if (!isManager || deletingId !== null) {
      return;
    }

    const label = recordLabel(record.overtime_id);

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${label}?\n\n` +
      `Employee: ${record.full_name}\n` +
      `Date: ${record.overtime_date}\n` +
      `Hours: ${Number(record.hours_worked).toFixed(2)}\n\n` +
      'This action cannot be undone.'
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(record.overtime_id);
    setSuccessMessage('');
    setActionError('');

    try {
      const response = await deleteOvertimeRecord(
        record.overtime_id
      );

      setRecords((current) =>
        current.filter(
          (item) =>
            item.overtime_id !== record.overtime_id
        )
      );

      setSelectedId(null);

      setSuccessMessage(
        response.message ||
        'Overtime record deleted successfully.'
      );

      await reloadRecords();
    } catch (error) {
      setActionError(
        error.message ||
        'Unable to delete overtime record.'
      );
    } finally {
      setDeletingId(null);
    }
  }

  function updateFilter(event) {
    const { name, value } = event.target;

    setFilters((current) => ({
      ...current,
      [name]: value,
    }));

    setSelectedId(null);
  }

  const query = filters.search.trim().toLowerCase();

  const filteredRecords = records.filter((record) => {
    const label = recordLabel(record.overtime_id);

    const matchesSearch =
      `${record.full_name} ${record.employee_id} ${label}`
        .toLowerCase()
        .includes(query);

    const matchesDate =
      !filters.date ||
      record.overtime_date === filters.date;

    const matchesStatus =
      !filters.status ||
      record.status === filters.status;

    return (
      matchesSearch &&
      matchesDate &&
      matchesStatus
    );
  });

  const selectedRecord = records.find(
    (record) => record.overtime_id === selectedId
  );

  return (
    <>
      {/* Add Overtime in the shared header - manager only. */}
      {headerActionContainer &&
        isManager &&
        !formMode &&
        createPortal(
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openForm('create')}
            disabled={deletingId !== null}
          >
            Add Overtime
          </button>,
          headerActionContainer
        )}

      <div className="mt-4">
        {successMessage && (
          <div
            className="alert alert-success alert-dismissible"
            role="status"
          >
            <div className="d-flex justify-content-between align-items-start gap-3">
              <span>{successMessage}</span>

              <button
                type="button"
                className="btn-close"
                aria-label="Dismiss message"
                onClick={() => setSuccessMessage('')}
              />
            </div>
          </div>
        )}

        {actionError && (
          <div className="alert alert-danger" role="alert">
            {actionError}
          </div>
        )}

        {/* Manager-only Create and Edit form */}
        {isManager && formMode && (
          <div className="mb-4">
            {employeesLoading ? (
              <div
                className="border rounded p-3 bg-light"
                role="status"
              >
                Loading eligible employees...
              </div>
            ) : employeesError ? (
              <div
                className="alert alert-danger"
                role="alert"
              >
                <p className="mb-3">
                  {employeesError}
                </p>

                <div className="d-flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={() =>
                      openForm(formMode, editingRecord)
                    }
                  >
                    Try again
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={closeForm}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {eligibleEmployees.length === 0 && (
                  <div
                    className="alert alert-warning"
                    role="status"
                  >
                    No active Pharmacists or Pharmacy Assistants
                    are currently available for overtime entry.
                  </div>
                )}

                <OvertimeForm
                  key={
                    formMode === 'edit'
                      ? `edit-${editingRecord.overtime_id}`
                      : 'create'
                  }
                  record={
                    formMode === 'edit'
                      ? editingRecord
                      : null
                  }
                  employees={eligibleEmployees}
                  onSave={handleSaveOvertime}
                  onCancel={closeForm}
                />
              </>
            )}
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
              onClick={reloadRecords}
              disabled={loading}
            >
              Try again
            </button>
          </div>
        )}

        {/* Search and filters */}
        <div className="row g-3 align-items-end mb-4">
          <div className="col-12 col-md-6 col-lg-4">
            <label
              htmlFor="overtime-search"
              className="form-label"
            >
              Search employee or record
            </label>

            <input
              id="overtime-search"
              name="search"
              type="search"
              className="form-control"
              placeholder="Employee name, employee ID or record ID"
              value={filters.search}
              onChange={updateFilter}
            />
          </div>

          <div className="col-12 col-md-6 col-lg-3">
            <label
              htmlFor="overtime-filter-date"
              className="form-label"
            >
              Overtime date
            </label>

            <input
              id="overtime-filter-date"
              name="date"
              type="date"
              className="form-control"
              value={filters.date}
              onChange={updateFilter}
            />
          </div>

          <div className="col-12 col-md-6 col-lg-3">
            <label
              htmlFor="overtime-filter-status"
              className="form-label"
            >
              Status
            </label>

            <select
              id="overtime-filter-status"
              name="status"
              className="form-select"
              value={filters.status}
              onChange={updateFilter}
            >
              <option value="">
                All statuses
              </option>

              {Object.keys(statusClasses).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-6 col-lg-2">
            <button
              type="button"
              className="btn btn-outline-secondary w-100"
              onClick={() => {
                setFilters(emptyFilters);
                setSelectedId(null);
              }}
            >
              Reset filters
            </button>
          </div>
        </div>

        {/* Overtime records table */}
        {loading ? (
          <p role="status">
            Loading overtime records...
          </p>
        ) : (
          <div className="row g-4">
            <div
              className={
                selectedRecord
                  ? 'col-12 col-xl-8'
                  : 'col-12'
              }
            >
              <p
                className="small text-secondary"
                role="status"
              >
                Showing {filteredRecords.length} of{' '}
                {records.length} overtime records.
              </p>

              <div
                className="table-responsive"
                role="region"
                aria-label="Overtime records table"
                tabIndex={0}
              >
                <table className="table table-hover align-middle mb-0 small">
                  <caption className="visually-hidden">
                    Employee overtime records
                  </caption>

                  <thead className="table-light">
                    <tr>
                      <th scope="col">Record ID</th>
                      <th scope="col">Employee</th>
                      <th scope="col">Date</th>
                      <th scope="col">Hours</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRecords.map((record) => (
                      <tr
                        key={record.overtime_id}
                        className={
                          selectedId === record.overtime_id
                            ? 'table-primary'
                            : ''
                        }
                      >
                        <th
                          scope="row"
                          className="fw-normal text-nowrap"
                        >
                          {recordLabel(record.overtime_id)}
                        </th>

                        <td>
                          {record.full_name}

                          <span className="d-block text-secondary">
                            ID: {record.employee_id}
                          </span>
                        </td>

                        <td className="text-nowrap">
                          {record.overtime_date}
                        </td>

                        <td>
                          {Number(
                            record.hours_worked
                          ).toFixed(2)}
                        </td>

                        <td>
                          <span
                            className={`badge ${
                              statusClasses[record.status] ||
                              'text-bg-secondary'
                            }`}
                          >
                            {record.status}
                          </span>
                        </td>

                        <td>
                          <div className="d-flex flex-wrap gap-2">
                            {/* View - All authorized users */}
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              aria-label={`View overtime ${recordLabel(
                                record.overtime_id
                              )} for ${record.full_name}`}
                              onClick={() =>
                                setSelectedId(record.overtime_id)
                              }
                              disabled={deletingId !== null}
                            >
                              View
                            </button>

                            {/* Edit - Manager only */}
                            {isManager &&
                              record.status === 'Approved' && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary"
                                  aria-label={`Edit overtime ${recordLabel(
                                    record.overtime_id
                                  )} for ${record.full_name}`}
                                  onClick={() =>
                                    openForm('edit', record)
                                  }
                                  disabled={
                                    deletingId !== null ||
                                    Boolean(formMode)
                                  }
                                >
                                  Edit
                                </button>
                              )}

                            {/* Delete - Manager only */}
                            {isManager && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                aria-label={`Delete overtime ${recordLabel(
                                  record.overtime_id
                                )} for ${record.full_name}`}
                                onClick={() =>
                                  handleDeleteOvertime(record)
                                }
                                disabled={
                                  deletingId !== null ||
                                  Boolean(formMode)
                                }
                              >
                                {deletingId === record.overtime_id
                                  ? 'Deleting...'
                                  : 'Delete'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredRecords.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="text-center text-secondary py-4"
                        >
                          {loadError
                            ? 'Unable to load overtime records.'
                            : 'No overtime records found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Existing View Details panel */}
            {selectedRecord && (
              <div className="col-12 col-xl-4">
                <OvertimeDetails
                  key={selectedRecord.overtime_id}
                  record={selectedRecord}
                  onClose={() => setSelectedId(null)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default OvertimeRecords;
