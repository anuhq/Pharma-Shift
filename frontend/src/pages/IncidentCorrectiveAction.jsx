import { API_BASE_URL } from '../api/config';
import { useCallback, useEffect, useState } from 'react';
import Investigations from './Investigations';
import CorrectiveActions from './CorrectiveActions';



const emptyCategory = {
  category_name: '',
  severity_level: 'Low',
  description: '',
};

const emptyIncident = {
  employee_id: '',
  category_id: '',
  incident_date: '',
  description: '',
};

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Request failed.');
  }

  return data;
}

function IncidentCorrectiveAction() {
  const [categories, setCategories] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [incidents, setIncidents] = useState([]);

  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [incidentForm, setIncidentForm] = useState(emptyIncident);

  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingIncidentId, setEditingIncidentId] = useState(null);
  const [categorySearch, setCategorySearch] = useState('');
  const [deletingCategoryId, setDeletingCategoryId] = useState(null);
  const [deletingIncidentId, setDeletingIncidentId] = useState(null);
  const [incidentSearch, setIncidentSearch] = useState('');
  const [incidentEmployeeFilter, setIncidentEmployeeFilter] = useState('');
  const [incidentCategoryFilter, setIncidentCategoryFilter] = useState('');
  const [incidentStatusFilter, setIncidentStatusFilter] = useState('');
  const [incidentFromDate, setIncidentFromDate] = useState('');
  const [incidentToDate, setIncidentToDate] = useState('');

  const [loading, setLoading] = useState(true);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingIncident, setSavingIncident] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [categoryData, employeeData, incidentData] =
        await Promise.all([
          requestJson(`${API_BASE_URL}/api/incident-categories`),
          requestJson(`${API_BASE_URL}/api/incidents/employees`),
          requestJson(`${API_BASE_URL}/api/incidents`),
        ]);

      setCategories(categoryData.categories || []);
      setEmployees(employeeData.employees || []);
      setIncidents(incidentData.incidents || []);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [loadData]);

  function handleCategoryChange(event) {
    const { name, value } = event.target;

    setCategoryForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleIncidentChange(event) {
    const { name, value } = event.target;

    setIncidentForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetCategoryForm() {
    setCategoryForm(emptyCategory);
    setEditingCategoryId(null);
  }

  function resetIncidentForm() {
    setIncidentForm(emptyIncident);
    setEditingIncidentId(null);
  }

  function editCategory(category) {
    setEditingCategoryId(category.category_id);

    setCategoryForm({
      category_name: category.category_name,
      severity_level: category.severity_level,
      description: category.description || '',
    });

    setMessage('');
    setError('');
  }

  function editIncident(incident) {
    setEditingIncidentId(incident.incident_id);

    setIncidentForm({
      employee_id: String(incident.employee_id),
      category_id: String(incident.category_id),
      incident_date: incident.incident_date,
      description: incident.description,
    });

    setMessage('');
    setError('');
  }

  async function submitCategory(event) {
    event.preventDefault();
    setSavingCategory(true);
    setError('');
    setMessage('');

    const isEditing = editingCategoryId !== null;

    const url = isEditing
      ? `${API_BASE_URL}/api/incident-categories/${editingCategoryId}`
      : `${API_BASE_URL}/api/incident-categories`;

    try {
      await requestJson(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(categoryForm),
      });

      setMessage(
        isEditing
          ? 'Category updated successfully.'
          : 'Category created successfully.',
      );

      resetCategoryForm();
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingCategory(false);
    }
  }

  async function deleteCategory(category) {
    if (
      !window.confirm(
        `Delete category "${category.category_name}"? This cannot be undone.`,
      )
    ) {
      return;
    }

    setDeletingCategoryId(category.category_id);
    setError('');
    setMessage('');

    try {
      await requestJson(
        `${API_BASE_URL}/api/incident-categories/${category.category_id}`,
        { method: 'DELETE' },
      );

      if (editingCategoryId === category.category_id) {
        resetCategoryForm();
      }

      setIncidentForm((current) =>
        current.category_id === String(category.category_id)
          ? { ...current, category_id: '' }
          : current,
      );

      await loadData();
      setMessage('Category deleted successfully.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeletingCategoryId(null);
    }
  }

  const searchText = categorySearch.trim().toLowerCase();
  const visibleCategories = categories.filter((category) =>
    [category.category_name, category.severity_level, category.description || '']
      .some((value) => value.toLowerCase().includes(searchText)),
  );

  async function deleteIncident(incident) {
    if (
      !window.confirm(
        `Delete incident #${incident.incident_id} for ${incident.full_name}? This cannot be undone.`,
      )
    ) {
      return;
    }

    setDeletingIncidentId(incident.incident_id);
    setError('');
    setMessage('');

    try {
      await requestJson(
        `${API_BASE_URL}/api/incidents/${incident.incident_id}`,
        { method: 'DELETE' },
      );
      if (editingIncidentId === incident.incident_id) {
        resetIncidentForm();
      }
      await loadData();
      setMessage('Incident deleted successfully.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeletingIncidentId(null);
    }
  }

  const invalidIncidentDateRange = Boolean(
    incidentFromDate && incidentToDate && incidentFromDate > incidentToDate,
  );
  const incidentStatuses = [...new Set(incidents.map((incident) => incident.status))]
    .filter(Boolean)
    .sort();
  const visibleIncidents = incidents.filter((incident) => {
    if (invalidIncidentDateRange) return false;

    const search = incidentSearch.trim().toLowerCase();
    const matchesSearch = [
      String(incident.incident_id),
      incident.full_name,
      incident.category_name,
      incident.description,
      incident.status,
    ].some((value) => String(value).toLowerCase().includes(search));

    return (
      matchesSearch &&
      (!incidentEmployeeFilter || String(incident.employee_id) === incidentEmployeeFilter) &&
      (!incidentCategoryFilter || String(incident.category_id) === incidentCategoryFilter) &&
      (!incidentStatusFilter || incident.status === incidentStatusFilter) &&
      (!incidentFromDate || incident.incident_date >= incidentFromDate) &&
      (!incidentToDate || incident.incident_date <= incidentToDate)
    );
  });

  function resetIncidentFilters() {
    setIncidentSearch('');
    setIncidentEmployeeFilter('');
    setIncidentCategoryFilter('');
    setIncidentStatusFilter('');
    setIncidentFromDate('');
    setIncidentToDate('');
  }

  async function submitIncident(event) {
    event.preventDefault();
    setSavingIncident(true);
    setError('');
    setMessage('');

    const isEditing = editingIncidentId !== null;

    const url = isEditing
      ? `${API_BASE_URL}/api/incidents/${editingIncidentId}`
      : `${API_BASE_URL}/api/incidents`;

    try {
      await requestJson(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(incidentForm),
      });

      setMessage(
        isEditing
          ? 'Incident updated successfully.'
          : 'Incident recorded successfully.',
      );

      resetIncidentForm();
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingIncident(false);
    }
  }

  return (
    <div className="container-fluid py-4">
      <div className="mb-4">
        <h2 className="mb-2">
          Staff Incident &amp; Corrective Action
        </h2>

        <p className="text-muted mb-0">
          Record incidents, investigate causes and manage corrective actions.
        </p>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="alert alert-success" role="status">
          {message}
        </div>
      )}

      <div className="row g-4">
        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h4 className="mb-3">
                {editingCategoryId === null
                  ? 'Add Incident Category'
                  : 'Edit Incident Category'}
              </h4>

              <form onSubmit={submitCategory}>
                <div className="mb-3">
                  <label className="form-label" htmlFor="category_name">
                    Category name
                  </label>

                  <input
                    id="category_name"
                    name="category_name"
                    className="form-control"
                    value={categoryForm.category_name}
                    onChange={handleCategoryChange}
                    maxLength={100}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label" htmlFor="severity_level">
                    Severity level
                  </label>

                  <select
                    id="severity_level"
                    name="severity_level"
                    className="form-select"
                    value={categoryForm.severity_level}
                    onChange={handleCategoryChange}
                    required
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label
                    className="form-label"
                    htmlFor="category_description"
                  >
                    Description
                  </label>

                  <textarea
                    id="category_description"
                    name="description"
                    className="form-control"
                    rows={3}
                    value={categoryForm.description}
                    onChange={handleCategoryChange}
                    maxLength={255}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary me-2"
                  disabled={savingCategory}
                >
                  {savingCategory
                    ? 'Saving...'
                    : editingCategoryId === null
                      ? 'Add Category'
                      : 'Update Category'}
                </button>

                {editingCategoryId !== null && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={resetCategoryForm}
                    disabled={savingCategory}
                  >
                    Cancel
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-7">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h4 className="mb-3">Incident Categories</h4>

              <label className="form-label" htmlFor="category_search">
                Search categories
              </label>
              <input
                id="category_search"
                type="search"
                className="form-control mb-3"
                placeholder="Search name, severity or description"
                value={categorySearch}
                onChange={(event) => setCategorySearch(event.target.value)}
              />

              {loading ? (
                <p className="text-muted">Loading...</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-bordered align-middle">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Severity</th>
                        <th>Description</th>
                        <th>Linked incidents</th>
                        <th>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {visibleCategories.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-muted text-center">
                            No matching categories found.
                          </td>
                        </tr>
                      )}
                      {visibleCategories.map((category) => (
                        <tr key={category.category_id}>
                          <td>{category.category_name}</td>
                          <td>{category.severity_level}</td>
                          <td>{category.description || '-'}</td>
                          <td>{category.incident_count || 0}</td>
                          <td>
                            <div className="d-flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => editCategory(category)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => void deleteCategory(category)}
                                disabled={deletingCategoryId !== null}
                              >
                                {deletingCategoryId === category.category_id
                                  ? 'Deleting...'
                                  : 'Delete'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4 mt-1">
        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h4 className="mb-3">
                {editingIncidentId === null
                  ? 'Record Incident'
                  : 'Edit Incident'}
              </h4>

              <form onSubmit={submitIncident}>
                <div className="mb-3">
                  <label className="form-label" htmlFor="employee_id">
                    Employee
                  </label>

                  <select
                    id="employee_id"
                    name="employee_id"
                    className="form-select"
                    value={incidentForm.employee_id}
                    onChange={handleIncidentChange}
                    required
                  >
                    <option value="">Select employee</option>

                    {employees.map((employee) => (
                      <option
                        key={employee.employee_id}
                        value={employee.employee_id}
                      >
                        {employee.full_name} ({employee.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label
                    className="form-label"
                    htmlFor="incident_category_id"
                  >
                    Incident category
                  </label>

                  <select
                    id="incident_category_id"
                    name="category_id"
                    className="form-select"
                    value={incidentForm.category_id}
                    onChange={handleIncidentChange}
                    required
                  >
                    <option value="">Select category</option>

                    {categories.map((category) => (
                      <option
                        key={category.category_id}
                        value={category.category_id}
                      >
                        {category.category_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label" htmlFor="incident_date">
                    Incident date
                  </label>

                  <input
                    id="incident_date"
                    name="incident_date"
                    type="date"
                    className="form-control"
                    value={incidentForm.incident_date}
                    onChange={handleIncidentChange}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label
                    className="form-label"
                    htmlFor="incident_description"
                  >
                    Incident description
                  </label>

                  <textarea
                    id="incident_description"
                    name="description"
                    className="form-control"
                    rows={4}
                    value={incidentForm.description}
                    onChange={handleIncidentChange}
                    maxLength={500}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary me-2"
                  disabled={savingIncident}
                >
                  {savingIncident
                    ? 'Saving...'
                    : editingIncidentId === null
                      ? 'Record Incident'
                      : 'Update Incident'}
                </button>

                {editingIncidentId !== null && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={resetIncidentForm}
                    disabled={savingIncident}
                  >
                    Cancel
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-7">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h4 className="mb-3">Incident Records</h4>

              <label className="form-label" htmlFor="incident_search">
                Search incidents
              </label>
              <input
                id="incident_search"
                type="search"
                className="form-control mb-3"
                placeholder="Search ID, employee, category or description"
                value={incidentSearch}
                onChange={(event) => setIncidentSearch(event.target.value)}
              />
              <div className="row g-2 mb-3">
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="incident_employee_filter">Employee</label>
                  <select
                    id="incident_employee_filter"
                    className="form-select"
                    value={incidentEmployeeFilter}
                    onChange={(event) => setIncidentEmployeeFilter(event.target.value)}
                  >
                    <option value="">All employees</option>
                    {employees.map((employee) => (
                      <option key={employee.employee_id} value={employee.employee_id}>
                        {employee.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="incident_category_filter">Category</label>
                  <select
                    id="incident_category_filter"
                    className="form-select"
                    value={incidentCategoryFilter}
                    onChange={(event) => setIncidentCategoryFilter(event.target.value)}
                  >
                    <option value="">All categories</option>
                    {categories.map((category) => (
                      <option key={category.category_id} value={category.category_id}>
                        {category.category_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label" htmlFor="incident_status_filter">Status</label>
                  <select
                    id="incident_status_filter"
                    className="form-select"
                    value={incidentStatusFilter}
                    onChange={(event) => setIncidentStatusFilter(event.target.value)}
                  >
                    <option value="">All statuses</option>
                    {incidentStatuses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label" htmlFor="incident_from_date">From date</label>
                  <input
                    id="incident_from_date"
                    type="date"
                    className="form-control"
                    value={incidentFromDate}
                    onChange={(event) => setIncidentFromDate(event.target.value)}
                  />
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label" htmlFor="incident_to_date">To date</label>
                  <input
                    id="incident_to_date"
                    type="date"
                    className="form-control"
                    value={incidentToDate}
                    onChange={(event) => setIncidentToDate(event.target.value)}
                  />
                </div>
              </div>
              {invalidIncidentDateRange && (
                <p className="text-danger" role="alert">
                  From date must not be later than To date.
                </p>
              )}
              <div className="d-flex align-items-center justify-content-between mb-3 gap-2">
                <small className="text-muted">
                  Showing {visibleIncidents.length} of {incidents.length} incidents
                </small>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={resetIncidentFilters}
                >
                  Clear filters
                </button>
              </div>

              {loading ? (
                <p className="text-muted">Loading...</p>
              ) : visibleIncidents.length === 0 ? (
                <p className="text-muted">No matching incidents found.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-bordered align-middle">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Category</th>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th>Linked work</th>
                        <th>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {visibleIncidents.map((incident) => (
                        <tr key={incident.incident_id}>
                          <td>{incident.full_name}</td>

                          <td>
                            {incident.category_name}
                            <br />
                            <small className="text-muted">
                              {incident.severity_level}
                            </small>
                          </td>

                          <td>{incident.incident_date}</td>
                          <td>{incident.description}</td>
                          <td>{incident.status}</td>
                          <td>
                            <small>
                              {Number(incident.investigation_count || 0)} investigation(s)
                              <br />
                              {Number(incident.corrective_action_count || 0)} action(s)
                            </small>
                          </td>

                          <td>
                            <div className="d-flex flex-wrap gap-2">
                              {String(incident.status).toLowerCase() === 'closed' ? (
                                <span className="text-muted">Closed</span>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={() => editIncident(incident)}
                                >
                                  Edit
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => void deleteIncident(incident)}
                                disabled={deletingIncidentId !== null}
                                title="Only Open incidents without investigations or actions can be deleted"
                              >
                                {deletingIncidentId === incident.incident_id
                                  ? 'Deleting...'
                                  : 'Delete'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Investigations incidents={incidents} onSaved={loadData} />

      <CorrectiveActions
        incidents={incidents}
        employees={employees}
        onSaved={loadData}
      />
    </div>
  );
}

export default IncidentCorrectiveAction;