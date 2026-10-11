
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { getOvertimeRecords } from '../../api/overtimeApi';
import OvertimeDetails from './OvertimeDetails';

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

function OvertimeRecords() {
  const { user } = useAuth();

  const [records, setRecords] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [selectedId, setSelectedId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Retrieve actual overtime records when the user changes.
  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setLoadError('');
    setRecords([]);
    setSelectedId(null);

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
      setRecords([]);
      setLoadError(error.message);
    } finally {
      setLoading(false);
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

    return matchesSearch && matchesDate && matchesStatus;
  });

  const selectedRecord = records.find(
    (record) => record.overtime_id === selectedId
  );

  return (
    <div className="mt-4">
      {loadError && (
        <div className="alert alert-danger" role="alert">
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
            <option value="">All statuses</option>

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

      {loading ? (
        <p role="status">Loading overtime records...</p>
      ) : (
        <div className="row g-4">
          <div
            className={
              selectedRecord
                ? 'col-12 col-xl-8'
                : 'col-12'
            }
          >
            <p className="small text-secondary" role="status">
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
                    <th scope="col">Action</th>
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
                        {Number(record.hours_worked).toFixed(2)}
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
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          aria-label={`View overtime ${recordLabel(
                            record.overtime_id
                          )} for ${record.full_name}`}
                          onClick={() =>
                            setSelectedId(record.overtime_id)
                          }
                        >
                          View
                        </button>
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
  );
}

export default OvertimeRecords;
