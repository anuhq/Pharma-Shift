import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../../api/config';

const API_URL = `${API_BASE_URL}/api/roles`;

export default function RoleManagement() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [roleName, setRoleName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const savingRef = useRef(false);

  // Load roles from MySQL
  useEffect(() => {
    const controller = new AbortController();

    async function loadRoles() {
      try {
        const response = await fetch(API_URL, {
          credentials: 'include',
          signal: controller.signal,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Unable to load roles.');
        }

        if (!controller.signal.aborted) {
          setRoles(data);
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadRoles();

    return () => controller.abort();
  }, [reloadCount]);

  function retryLoading() {
    setError('');
    setLoading(true);
    setReloadCount((count) => count + 1);
  }

  function openForm() {
    setRoleName('');
    setDescription('');
    setFormError('');
    setSuccess('');
    setEditingRoleId(null);
    setShowForm(true);
  }

  function openEditForm(role) {
  setEditingRoleId(role.role_id);
  setRoleName(role.role_name);
  setDescription(role.description || '');
  setFormError('');
  setSuccess('');
  setShowForm(true);
}

// Delete a role after manager confirmation
async function handleDelete(role) {
  if (savingRef.current) return;

  const confirmed = window.confirm(
    `Are you sure you want to delete "${role.role_name}"?`
  );

  if (!confirmed) return;

  savingRef.current = true;
  setSaving(true);
  setSuccess('');
  setDeleteError('');

  try {
    const response = await fetch(
      `${API_URL}/${role.role_id}`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Unable to delete role.');
    }

    // Remove deleted role from the displayed table
    setRoles((current) =>
      current.filter((item) => item.role_id !== role.role_id)
    );

    if (editingRoleId === role.role_id) {
      setShowForm(false);
      setEditingRoleId(null);
    }

    setSuccess('Role deleted successfully.');

  } catch (error) {
    setDeleteError(
      error instanceof TypeError
        ? 'Connection lost. Refresh the role list before retrying.'
        : error.message
    );
  } finally {
    savingRef.current = false;
    setSaving(false);
  }
}

  // Create a role through the backend
  async function handleSave(event) {
    event.preventDefault();

    if (savingRef.current) return;

    const name = roleName.trim();
    const details = description.trim();

    if (name.length < 2 || name.length > 50) {
      setFormError('Role name must contain 2 to 50 characters.');
      return;
    }

    if (details.length > 255) {
      setFormError('Description must not exceed 255 characters.');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setFormError('');
    setSuccess('');

    try {
      const isEditing = editingRoleId !== null;

      const response = await fetch(
        isEditing ? `${API_URL}/${editingRoleId}` : API_URL,
        {
          method: isEditing ? 'PUT' : 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role_name: name,
          description: details || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to create role.');
      }

      setRoles((current) => {
        const updated = isEditing
          ? current.map((role) =>
              role.role_id === editingRoleId
                ? { ...role, ...data }
                : role
            )
          : [...current, data];

        return updated.sort((a, b) =>
          a.role_name.localeCompare(b.role_name)
        );
      });

      setShowForm(false);
      setEditingRoleId(null);
      setRoleName('');
      setDescription('');

      setSuccess(
        isEditing
          ? 'Role updated successfully.'
          : 'Role created successfully.'
      );
    } catch (saveError) {
      setFormError(
        saveError instanceof TypeError
          ? 'Connection lost. Check the role list before retrying.'
          : saveError.message
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="card border-0 shadow-sm">
      <div className="card-body">

        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
          <div>
            <h3 className="h5 mb-1">Employee Roles</h3>
            <p className="text-muted mb-0">
              Manage employee roles and descriptions.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={openForm}
            disabled={loading || Boolean(error) || saving}
          >
            Add Role
          </button>
        </div>

        {success && (
          <div className="alert alert-success" role="status">
            {success}
          </div>
        )}

        {deleteError && (
          <div className="alert alert-danger" role="alert">
            {deleteError}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSave} className="border rounded p-3 mb-4">
            <h4 className="h6 mb-3">{editingRoleId !== null ? 'Edit Role' : 'Add New Role'}</h4>

            {formError && (
              <div className="alert alert-danger" role="alert">
                {formError}
              </div>
            )}

            <div className="mb-3">
              <label htmlFor="roleName" className="form-label">
                Role Name *
              </label>

              <input
                id="roleName"
                type="text"
                className="form-control"
                value={roleName}
                onChange={(event) => setRoleName(event.target.value)}
                maxLength={50}
                required
                disabled={saving}
                placeholder="Enter role name"
              />
            </div>

            <div className="mb-3">
              <label htmlFor="roleDescription" className="form-label">
                Description
              </label>

              <textarea
                id="roleDescription"
                className="form-control"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={255}
                disabled={saving}
                placeholder="Enter role description"
              />
            </div>

            <div className="d-flex gap-2">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving  ? 'Saving...'  : editingRoleId !== null    ? 'Update Role'    : 'Save Role'}
              </button>

              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={saving}
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading && <p role="status">Loading roles...</p>}

        {error && (
          <div className="alert alert-danger" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={retryLoading}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Description</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>

              <tbody>
                {roles.map((role) => (
                  <tr key={role.role_id}>
                    <td>{role.role_name}</td>
                    <td>{role.description || '—'}</td>

                   <td className="text-end">
                      <div className="d-flex justify-content-end gap-2">
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => openEditForm(role)}
                          disabled={
                            saving ||
                            role.role_name.trim().toLowerCase() === 'owner/manager'
                          }
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => handleDelete(role)}
                          disabled={
                            saving ||
                            role.role_name.trim().toLowerCase() === 'owner/manager'
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {roles.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center py-4">
                      No roles found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </section>
  );
}