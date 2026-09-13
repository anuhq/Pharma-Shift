import { useEffect, useRef, useState } from 'react';

const API_URL = 'http://127.0.0.1:5000/api';

const emptyForm = {
  full_name: '',
  contact_no: '',
  role_id: '',
  status: 'Active',
};

// Read the response and handle unsuccessful requests
async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'The request could not be completed.');
  }

  return data;
}

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ ...emptyForm });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const savingRef = useRef(false);

  // Load employees and roles when this section opens
  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      try {
        const [employeeData, roleData] = await Promise.all([
          apiRequest('/employees', { signal: controller.signal }),
          apiRequest('/roles', { signal: controller.signal }),
        ]);

        if (!controller.signal.aborted) {
          setEmployees(employeeData);
          setRoles(roleData);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(
            error instanceof TypeError
              ? 'Cannot reach the server. Check that the backend is running.'
              : error.message,
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadData();

    // Stop pending reads when leaving this section
    return () => controller.abort();
  }, [reloadCount]);

  function retryLoading() {
    setLoadError('');
    setLoading(true);
    setReloadCount((count) => count + 1);
  }

  function openAddForm() {
    setForm({ ...emptyForm });
    setEditingId(null);
    setFormError('');
    setSuccess('');
    setShowForm(true);
  }

  // Fill the form with the selected employee's details
  function openEditForm(employee) {
    setForm({
      full_name: employee.full_name,
      contact_no: employee.contact_no ?? '',
      role_id: String(employee.role_id),
      status: employee.status,
    });
    setEditingId(employee.employee_id);
    setFormError('');
    setSuccess('');
    setShowForm(true);
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (savingRef.current) {
      return;
    }

    if (form.full_name.trim().length < 2) {
      setFormError('Enter a name with at least 2 characters.');
      return;
    }

    if (!roles.some((role) => role.role_id === Number(form.role_id))) {
      setFormError('Select a role from the list.');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setFormError('');
    setSuccess('');

    try {
      // POST creates a record; PUT updates the selected record
      const path =
        editingId === null ? '/employees' : `/employees/${editingId}`;

      const savedEmployee = await apiRequest(path, {
        method: editingId === null ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          contact_no: form.contact_no.trim() || null,
          role_id: Number(form.role_id),
          status: form.status,
        }),
      });

      // Update the screen after the API confirms the save
      setEmployees((current) =>
        editingId === null
          ? [savedEmployee, ...current]
          : current.map((employee) =>
              employee.employee_id === editingId
                ? savedEmployee
                : employee,
            ),
      );

      setSuccess(
        editingId === null
          ? 'Employee added successfully.'
          : 'Employee updated successfully.',
      );
      setSearch('');
      setShowForm(false);
    } catch (error) {
      setFormError(
        error instanceof TypeError
          ? 'Connection lost. Check the employee list before retrying the save.'
          : error.message,
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  // Search the loaded records without changing the database
  const searchText = search.trim().toLowerCase();

  const filteredEmployees = employees.filter((employee) =>
    [
      employee.employee_id,
      employee.full_name,
      employee.role_name,
      employee.contact_no ?? '',
      employee.status,
    ].some((value) => String(value).toLowerCase().includes(searchText)),
  );

  return (
    <section aria-labelledby="employees-heading">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <h3 id="employees-heading" className="h5 mb-0">
          Employees
        </h3>

        <button
          type="button"
          className="btn btn-primary"
          disabled={
            loading || Boolean(loadError) || roles.length === 0 || saving
          }
          onClick={openAddForm}
        >
          Add Employee
        </button>
      </div>

      {success && (
        <div className="alert alert-success" role="status">
          {success}
        </div>
      )}

      {loading && <p role="status">Loading employees and roles…</p>}

      {loadError && (
        <div className="alert alert-danger" role="alert">
          <p>{loadError}</p>
          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={retryLoading}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !loadError && (
        <>
          {roles.length === 0 && (
            <div className="alert alert-warning" role="status">
              No employee roles are available. A role is needed before
              adding employees.
            </div>
          )}

          {showForm && (
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body">
                <h4 className="h5">
                  {editingId === null ? 'Add Employee' : 'Edit Employee'}
                </h4>

                {formError && (
                  <div className="alert alert-danger" role="alert">
                    {formError}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <fieldset disabled={saving}>
                    <legend className="visually-hidden">
                      Employee details
                    </legend>

                    <div className="row g-3">
                      <div className="col-md-6">
                        <label
                          htmlFor="employee-name"
                          className="form-label"
                        >
                          Full name (required)
                        </label>
                        <input
                          id="employee-name"
                          name="full_name"
                          className="form-control"
                          value={form.full_name}
                          onChange={handleChange}
                          required
                          minLength={2}
                          maxLength={100}
                        />
                      </div>

                      <div className="col-md-6">
                        <label
                          htmlFor="employee-contact"
                          className="form-label"
                        >
                          Contact number (optional)
                        </label>
                        <input
                          id="employee-contact"
                          name="contact_no"
                          type="tel"
                          className="form-control"
                          value={form.contact_no}
                          onChange={handleChange}
                          maxLength={20}
                        />
                      </div>

                      <div className="col-md-6">
                        <label
                          htmlFor="employee-role"
                          className="form-label"
                        >
                          Role (required)
                        </label>
                        <select
                          id="employee-role"
                          name="role_id"
                          className="form-select"
                          value={form.role_id}
                          onChange={handleChange}
                          required
                        >
                          <option value="">Select a role</option>
                          {roles.map((role) => (
                            <option
                              key={role.role_id}
                              value={role.role_id}
                            >
                              {role.role_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-md-6">
                        <label
                          htmlFor="employee-status"
                          className="form-label"
                        >
                          Status (required)
                        </label>
                        <select
                          id="employee-status"
                          name="status"
                          className="form-select"
                          value={form.status}
                          onChange={handleChange}
                          required
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </div>
                    </div>

                    <div className="d-flex gap-2 mt-4">
                      <button
                        type="submit"
                        className="btn btn-success"
                      >
                        {saving ? 'Saving…' : 'Save Employee'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowForm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </fieldset>
                </form>
              </div>
            </div>
          )}

          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <label
                htmlFor="employee-search"
                className="form-label"
              >
                Search employees
              </label>
              <input
                id="employee-search"
                type="search"
                className="form-control mb-3"
                placeholder="Name, role, contact, status or ID"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <caption>
                    {filteredEmployees.length} of {employees.length} employees
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">ID</th>
                      <th scope="col">Name</th>
                      <th scope="col">Role</th>
                      <th scope="col">Contact</th>
                      <th scope="col">Status</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((employee) => (
                      <tr key={employee.employee_id}>
                        <td>{employee.employee_id}</td>
                        <td>{employee.full_name}</td>
                        <td>{employee.role_name}</td>
                        <td>{employee.contact_no || 'Not provided'}</td>
                        <td>
                          <span
                            className={`badge ${
                              employee.status === 'Active'
                                ? 'text-bg-success'
                                : 'text-bg-secondary'
                            }`}
                          >
                            {employee.status}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            disabled={saving || roles.length === 0}
                            aria-label={`Edit ${employee.full_name}`}
                            onClick={() => openEditForm(employee)}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}

                    {filteredEmployees.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-4">
                          {employees.length === 0
                            ? 'No employees yet. Add the first employee.'
                            : 'No employees match your search.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}