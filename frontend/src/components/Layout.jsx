import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="header-brand">
          <span className="header-logo">↯</span>
          <div>
            <h1 className="header-title">Integrator Control Plane</h1>
            <span className="control-plane-label">durable workflow operations</span>
          </div>
        </div>
        <div className="header-right">
          <span className="header-user">
            <span className="user-avatar">{(user?.name || user?.email || '?')[0].toUpperCase()}</span>
            <span className="user-name">{user?.name || user?.email}</span>
            <span className="user-role">{user?.role}</span>
          </span>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Sign out all sessions</button>
        </div>
      </header>
      <main className="operations-main">{children}</main>
    </div>
  );
}
