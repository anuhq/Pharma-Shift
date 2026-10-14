import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../api/config';

// Default to a useful recent period while allowing managers to choose dates.
function localDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function initialDates() {
  const today = new Date();
  const earlier = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 90);
  return { from_date: localDate(earlier), to_date: localDate(today) };
}

async function loadWarnings(filters) {
  const params = new URLSearchParams(filters);
  const response = await fetch(
    `${API_BASE_URL}/api/incidents/repeated-warnings?${params.toString()}`,
    { credentials: 'include' },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Could not check repeated incidents.');
  return data;
}

// Read-only, manager-only review of patterns, not an allegation about staff.
function RepeatedIncidentWarnings({ employees, categories }) {
  const [filters, setFilters] = useState(initialDates);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setBusy(true);
    loadWarnings(initialDates())
      .then((data) => { if (active) { setResult(data); setError(''); } })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  function change(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  async function check(event) {
    event.preventDefault();
    setError('');
    if (!filters.from_date || !filters.to_date || filters.from_date > filters.to_date) {
      setError('Choose a valid date range. From date cannot be after To date.');
      return;
    }
    setBusy(true);
    try {
      const data = await loadWarnings(filters);
      setResult(data);
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card border-0 shadow-sm my-4" aria-labelledby="repeat-warning-title">
      <div className="card-body">
        <h4 id="repeat-warning-title" className="mb-2">Repeated-Incident Warnings</h4>
        <p className="text-muted mb-3">
          Manager-only pattern check using recorded MySQL incidents. Two or more
          incidents involving the same employee and category within the selected
          dates are highlighted for review. A match does not establish fault.
        </p>

        <form className="row g-2 align-items-end mb-3" onSubmit={check}>
          <div className="col-6 col-md-2">
            <label className="form-label" htmlFor="repeat_from">From date</label>
            <input className="form-control" id="repeat_from" type="date"
              name="from_date" value={filters.from_date} onChange={change} required />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label" htmlFor="repeat_to">To date</label>
            <input className="form-control" id="repeat_to" type="date"
              name="to_date" value={filters.to_date} onChange={change} required />
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label" htmlFor="repeat_employee">Employee</label>
            <select className="form-select" id="repeat_employee"
              name="employee_id" value={filters.employee_id || ''} onChange={change}>
              <option value="">All employees</option>
              {employees.map((employee) => (
                <option value={employee.employee_id} key={employee.employee_id}>
                  {employee.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label" htmlFor="repeat_category">Category</label>
            <select className="form-select" id="repeat_category"
              name="category_id" value={filters.category_id || ''} onChange={change}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option value={category.category_id} key={category.category_id}>
                  {category.category_name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-2">
            <button className="btn btn-primary w-100" type="submit" disabled={busy}>
              {busy ? 'Checking...' : 'Check repeats'}
            </button>
          </div>
        </form>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {!error && busy && <p className="text-muted" role="status">Checking incident history...</p>}
        {!error && !busy && result && (
          <>
            <p className="mb-3">
              <strong>{result.group_count}</strong> repeated employee/category
              {result.group_count === 1 ? ' pattern' : ' patterns'} found between
              {' '}{result.from_date} and {result.to_date} (inclusive).
            </p>
            {result.groups.length === 0 ? (
              <p className="text-muted mb-0">No repeated patterns found for these filters.</p>
            ) : (
              <div className="d-grid gap-3">
                {result.groups.map((group) => (
                  <div className="border rounded p-3" key={`${group.employee_id}:${group.category_id}`}>
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                      <div>
                        <strong>{group.full_name}</strong>
                        <span className="text-muted"> — {group.category_name}</span>
                      </div>
                      <span className="badge text-bg-warning">
                        {group.count} matching incidents
                      </span>
                    </div>
                    <p className="small text-muted mb-2">
                      Basis: same employee and category; {group.count} records within
                      the selected date range, including closed incidents.
                    </p>
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered align-middle mb-0">
                        <thead>
                          <tr>
                            <th scope="col">Incident ID</th>
                            <th scope="col">Date</th>
                            <th scope="col">Status</th>
                            <th scope="col">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.incidents.map((incident) => (
                            <tr key={incident.incident_id}>
                              <td>#{incident.incident_id}</td>
                              <td>{incident.incident_date}</td>
                              <td>{incident.status}</td>
                              <td>{incident.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default RepeatedIncidentWarnings;
