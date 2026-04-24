import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import featureConfig from '../api/featureConfig';

const SIDEBAR_SECTIONS = [
  {
    label: 'Integration',
    items: ['connections', 'apis', 'workflows', 'transformations', 'connectors', 'endpoints'],
  },
  {
    label: 'Operations',
    items: ['schedules', 'logs', 'alerts', 'webhooks', 'error-retries'],
  },
  {
    label: 'Resources',
    items: ['templates', 'users', 'settings'],
  },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({});

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSection = (label) => {
    setCollapsedSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const currentPath = location.pathname.replace('/', '') || 'dashboard';

  return (
    <div className="layout">
      <header className="header">
        <div className="header-left">
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="sidebar-toggle-icon">{collapsed ? '☰' : '✕'}</span>
          </button>
          <div className="header-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <span className="header-logo">⚡</span>
            <h1 className="header-title">System Integrator</h1>
          </div>
        </div>
        <div className="header-right">
          {user && (
            <span className="header-user">
              <span className="user-avatar">{(user.name || user.email || '?')[0].toUpperCase()}</span>
              <span className="user-name">{user.name || user.email}</span>
              <span className="user-role">{user.role}</span>
            </span>
          )}
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="layout-body">
        <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
          <nav className="sidebar-nav">
            {/* Dashboard */}
            <div className="sidebar-section">
              <button
                className={`sidebar-item ${currentPath === 'dashboard' ? 'active' : ''}`}
                onClick={() => navigate('/')}
              >
                <span className="sidebar-item-icon">📊</span>
                {!collapsed && <span className="sidebar-item-label">Dashboard</span>}
              </button>
            </div>

            {/* Feature Sections */}
            {SIDEBAR_SECTIONS.map((section) => (
              <div key={section.label} className="sidebar-section">
                {!collapsed && (
                  <button
                    className="sidebar-section-header"
                    onClick={() => toggleSection(section.label)}
                  >
                    <span className="sidebar-section-title">{section.label}</span>
                    <span className={`sidebar-section-chevron ${collapsedSections[section.label] ? 'collapsed' : ''}`}>
                      ›
                    </span>
                  </button>
                )}
                {!collapsedSections[section.label] && (
                  <div className="sidebar-section-items">
                    {section.items.map((key) => {
                      const config = featureConfig[key];
                      if (!config) return null;
                      return (
                        <button
                          key={key}
                          className={`sidebar-item ${currentPath === key ? 'active' : ''}`}
                          onClick={() => navigate(`/${key}`)}
                          title={config.title}
                        >
                          <span className="sidebar-item-icon">{config.icon}</span>
                          {!collapsed && <span className="sidebar-item-label">{config.title}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* AI Assistant */}
            <div className="sidebar-section">
              {!collapsed && (
                <div className="sidebar-section-header sidebar-section-header-static">
                  <span className="sidebar-section-title">Intelligence</span>
                </div>
              )}
              <button
                className={`sidebar-item sidebar-item-ai ${currentPath === 'ai' ? 'active' : ''}`}
                onClick={() => navigate('/ai')}
              >
                <span className="sidebar-item-icon">🤖</span>
                {!collapsed && <span className="sidebar-item-label">AI Assistant</span>}
              </button>
            </div>
          </nav>

          {/* Sidebar Footer */}
          {!collapsed && (
            <div className="sidebar-footer">
              <div className="sidebar-footer-status">
                <span className="status-dot status-dot-online"></span>
                <span className="sidebar-footer-text">System Online</span>
              </div>
              <span className="sidebar-footer-version">v2.1.0</span>
            </div>
          )}
        </aside>

        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
