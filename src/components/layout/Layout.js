import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission, PERMISSIONS } from '../../utils/permissions';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faServer, 
  faTh, 
  faLayerGroup, 
  faUsers, 
  faFileAlt,
  faSignOutAlt,
  faBell,
  faCog,
  faUser,
  faMoon,
  faSun
} from '@fortawesome/free-solid-svg-icons';
import './Layout.css';

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { 
      path: '/dashboard', 
      icon: faTh, 
      label: 'Dashboard',
      permission: PERMISSIONS.VIEW_DASHBOARD
    },
    { 
      path: '/devices', 
      icon: faLayerGroup, 
      label: 'Devices',
      permission: PERMISSIONS.VIEW_DEVICES
    },
    { 
      path: '/users', 
      icon: faUsers, 
      label: 'Users',
      permission: PERMISSIONS.VIEW_USERS
    },
    { 
      path: '/logs', 
      icon: faFileAlt, 
      label: 'Logs',
      permission: PERMISSIONS.VIEW_LOGS
    }
  ];

  if (!user) {
    return null;
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <FontAwesomeIcon icon={faServer} size="lg" />
            <span>PiMan</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            
            // Only show nav items if user has permission
            if (!hasPermission(user, item.permission)) {
              return null;
            }
            
            return (
              <button
                key={item.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <FontAwesomeIcon icon={item.icon} size="sm" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item logout-btn" onClick={handleLogout}>
            <FontAwesomeIcon icon={faSignOutAlt} size="sm" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="header">
          <div className="header-left">
            <h1>
              {location.pathname === '/dashboard' && 'Dashboard'}
              {location.pathname === '/devices' && 'Devices'}
              {location.pathname === '/users' && 'Users'}
              {location.pathname === '/logs' && 'Logs'}
              {location.pathname.startsWith('/terminal/') && 'Terminal'}
              {location.pathname.startsWith('/files/') && 'File Editor'}
            </h1>
          </div>

          <div className="header-right">
            <button 
              className="theme-toggle" 
              onClick={toggleDarkMode}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <FontAwesomeIcon icon={darkMode ? faSun : faMoon} size="sm" />
            </button>
            
            <div className="user-menu">
              <div className="user-avatar">
                <FontAwesomeIcon icon={faUser} size="sm" />
              </div>
              <div className="user-info">
                <span className="user-name">{user.name}</span>
                <span className="user-role">{user.role}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout; 