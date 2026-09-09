import { useState } from 'react';

function EmployeeShift() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">Employee Management</h2>
          <p className="text-muted mb-0">
            Manage pharmacy employees and their assigned roles.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Close Form' : 'Add Employee'}
        </button>
      </div>

      {showForm && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <h5 className="card-title mb-3">Add New Employee</h5>

            <form>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Full name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter employee name"
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Contact number</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter contact number"
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Role</label>
                  <select className="form-select" defaultValue="">
                    <option value="" disabled>
                      Select a role
                    </option>
                    <option value="manager">Manager</option>
                    <option value="pharmacist">Pharmacist</option>
                    <option value="assistant">Pharmacy Assistant</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label">Status</label>
                  <select className="form-select" defaultValue="Active">
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
              </div>

              <button type="button" className="btn btn-success mt-4">
                Save Employee
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="card-title mb-0">Employee List</h5>
            <input
              type="search"
              className="form-control"
              placeholder="Search employees"
              style={{ maxWidth: '240px' }}
            />
          </div>

          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td>Sample Employee</td>
                  <td>Pharmacist</td>
                  <td>077 000 0000</td>
                  <td>
                    <span className="badge text-bg-success">Active</span>
                  </td>
                  <td>
                    <button type="button" className="btn btn-sm btn-outline-primary">
                      Edit
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmployeeShift;