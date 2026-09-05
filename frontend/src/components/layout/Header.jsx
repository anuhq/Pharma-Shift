function Header({ onMenuClick }) {
  return (
    <header className="app-header">
      <div className="container-fluid d-flex align-items-center justify-content-between px-3 px-lg-4">
        <div className="d-flex align-items-center gap-3">
          <button
            type="button"
            className="btn btn-outline-secondary d-lg-none"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
          >
            Menu
          </button>

          <div>
            <h1 className="app-title mb-0">PharmaShift</h1>
            <p className="app-subtitle mb-0">
              Pharmacy Workforce and Daily Operations Management System
            </p>
          </div>
        </div>

        <div className="text-end">
          <div className="fw-semibold">User</div>
          <small className="text-secondary">Owner / Manager</small>
        </div>
      </div>
    </header>
  );
}

export default Header;