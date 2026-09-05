import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';

function MainLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className="app-shell">
      <Header
        onMenuClick={() => setMobileMenuOpen((current) => !current)}
      />

      <div className="app-body">
        <Sidebar
          mobileOpen={mobileMenuOpen}
          onNavigate={closeMobileMenu}
        />

        {mobileMenuOpen && (
          <button
            type="button"
            className="sidebar-backdrop d-lg-none"
            onClick={closeMobileMenu}
            aria-label="Close navigation menu"
          />
        )}

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;