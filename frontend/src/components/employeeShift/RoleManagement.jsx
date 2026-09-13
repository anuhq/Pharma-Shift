import { useEffect, useState } from 'react';

const API_URL = 'http://127.0.0.1:5000/api';

export default function RoleManagement() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  // Read the roles stored in MySQL
  useEffect(() => {
    const controller = new AbortController();

    async function loadRoles() {
      try {
        const response = await fetch(`${API_URL}/roles`, {
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

  return (
    <section className="card border-0 shadow-sm">
      <div className="card-body">
        <h3 className="h5 mb-1">Employee Roles</h3>
        <p className="text-muted">
          View the roles available for employee records.
        </p>

        {loading && <p role="status">Loading roles…</p>}

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
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.role_id}>
                    <td>{role.role_name}</td>
                    <td>{role.description || '—'}</td>
                  </tr>
                ))}

                {roles.length === 0 && (
                  <tr>
                    <td colSpan={2} className="text-center py-4">
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