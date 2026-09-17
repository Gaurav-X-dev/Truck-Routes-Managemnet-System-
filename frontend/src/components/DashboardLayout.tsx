import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Truck, Map, LogOut, LayoutDashboard, Store, Menu, X } from 'lucide-react';

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    navigate('/login');
  };

  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="app-container">
      <button 
        className="mobile-nav-toggle"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <div className={`sidebar ${!isMobileMenuOpen ? 'collapsed' : ''}`}>
        <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '1.25rem' }}>
          <Truck />
          <span>RouteMaster</span>
        </div>
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Link 
            to="/dashboard" 
            className={`nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`}
            onClick={closeMenu}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </Link>
          <Link 
            to="/dashboard/trucks" 
            className={`nav-item ${location.pathname.includes('/trucks') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            <Truck size={20} />
            Trucks & Routes
          </Link>
          <Link 
            to="/dashboard/shops" 
            className={`nav-item ${location.pathname.includes('/shops') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            <Store size={20} />
            Shops & Customers
          </Link>
          <Link 
            to="/dashboard/map" 
            className={`nav-item ${location.pathname === '/dashboard/map' ? 'active' : ''}`}
            onClick={closeMenu}
          >
            <Map size={20} />
            Live Tracking
          </Link>
        </div>

        <div>
          <button 
            onClick={handleLogout}
            className="nav-item" 
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </div>
      
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
}
