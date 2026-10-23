import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [demoAvailable, setDemoAvailable] = useState(false);
  const { login, demoLogin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { api.get('/auth/demo-availability').then(({ data }) => setDemoAvailable(data.available)).catch(() => setDemoAvailable(false)); }, []);

  const demoEmail = import.meta.env.VITE_DEMO_EMAIL;
  const demoPassword = import.meta.env.VITE_DEMO_PASSWORD;

  const handleDemoFill = async () => {
    if (demoEmail && demoPassword) { setEmail(demoEmail); setPassword(demoPassword); return; }
    try {
      const res = await fetch('/api/auth/demo-credentials', { cache: 'no-store' });
      if (res.ok) { const data = await res.json(); if (data.email && data.password) { setEmail(data.email); setPassword(data.password); return; } }
    } catch { /* fallback below */ }
    setError('Demo credentials are not configured for this environment.');
  };

  const handleDemo = async () => {
    setError('');
    const result = await demoLogin();
    if (result.success) navigate('/');
    else setError(result.error);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    const result = await login(email, password);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-pattern" />
      <div className="login-card">
        <div className="login-header">
          <span className="login-logo">⚡</span>
          <h1 className="login-title">System Integrator</h1>
          <p className="login-subtitle">Sign in to your account</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          <button
              type="button"
              onClick={handleDemoFill}
              aria-label="Fill demo credentials"
              style={{ width: '100%', marginBottom: '12px', padding: '10px 14px', borderRadius: '8px', border: '1px solid currentColor', background: 'transparent', cursor: 'pointer' }}
            >
              Fill demo credentials
            </button>
          <button
            type="button"
            onClick={handleDemo}
            disabled={!demoAvailable || loading}
            aria-label="Log In as Demo"
            style={{ width: '100%', marginBottom: '12px', padding: '10px 14px', borderRadius: '8px', border: '1px solid currentColor', background: 'transparent', cursor: 'pointer' }}
          >
            Log In as Demo
          </button>
          {!demoAvailable && <p className="login-demo-note">Demo login requires configured demo credentials on the server.</p>}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? (
              <span className="btn-loading">
                <span className="spinner" /> Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>

        </form>

        <div className="login-footer">
          <p>Accounts are provisioned by an administrator. Credentials are never embedded in the client.</p>
        </div>
      </div>
    </div>
  );
}
