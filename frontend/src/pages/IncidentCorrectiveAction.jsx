import { useCallback, useEffect, useState } from 'react';

const API_BASE_URL = 'http://127.0.0.1:5000';

const emptyForm = {
  category_name: '',
  severity_level: 'Low',
  description: '',
};

function IncidentCorrectiveAction() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/incident-categories`,
        { credentials: 'include' },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Unable to load categories.');
      }

      setCategories(data.categories || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEditing(category) {
    setEditingId(category.category_id);
    setForm({
      category_name: category.category_name,
      severity_level: category.severity_level,
      description: category.description || '',
    });
    setMessage('');
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    const isEditing = editingId !== null;
    const url = isEditing
      ? `${API_BASE_URL}/api/incident-categories/${editingId}`
      : `${API_BASE_URL}/api/incident-categories`;

    try {
      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Unable to save category.');
      }

      setMessage(
        isEditing
          ? 'Category updated successfully.'
          : 'Category created successfully.',
      );

      resetForm();
      await loadCategories();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
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

      <div className="row g-4">
        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h4 className="mb-3">
                {editingId === null
                  ? 'Add Incident Category'
                  : 'Edit Incident Category'}
              </h4>

              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}

              {message && (
                <div className="alert alert-success" role="alert">
                  {message}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label
                    className="form-label"
                    htmlFor="category_name"
                  >
                    Category name
                  </label>
                  <input
                    id="category_name"
                    name="category_name"
                    className="form-control"
                    value={form.category_name}
                    onChange={handleChange}
                    maxLength={100}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label
                    className="form-label"
                    htmlFor="severity_level"
                  >
                    Severity level
                  </label>
                  <select
                    id="severity_level"
                    name="severity_level"
                    className="form-select"
                    value={form.severity_level}
                    onChange={handleChange}
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
                    htmlFor="description"
                  >
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    className="form-control"
                    rows="3"
                    value={form.description}
                    onChange={handleChange}
                    maxLength={255}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary me-2"
                  disabled={saving}
                >
                  {saving
                    ? 'Saving...'
                    : editingId === null
                      ? 'Add Category'
                      : 'Update Category'}
                </button>

                {editingId !== null && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={resetForm}
                    disabled={saving}
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
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="mb-0">Incident Categories</h4>

                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={loadCategories}
                  disabled={loading}
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <p className="text-muted">Loading categories...</p>
              ) : categories.length === 0 ? (
                <p className="text-muted">No categories found.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-bordered align-middle">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Severity</th>
                        <th>Description</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((category) => (
                        <tr key={category.category_id}>
                          <td>{category.category_name}</td>
                          <td>{category.severity_level}</td>
                          <td>{category.description || '-'}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => startEditing(category)}
                            >
                              Edit
                            </button>
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
    </div>
  );
}

export default IncidentCorrectiveAction;