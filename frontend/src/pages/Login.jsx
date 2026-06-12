import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, error, clearError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    const success = await login(username, password);
    if (success) {
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg" />

      {/* Floating orbs */}
      <div style={{
        position: 'absolute', width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.08), transparent 70%)',
        top: '10%', left: '10%', animation: 'float 6s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: 200, height: 200, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.06), transparent 70%)',
        bottom: '15%', right: '15%', animation: 'float 8s ease-in-out infinite reverse',
      }} />

      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-icon">🔐</div>
          <h1 className="cormorant-unicase-semibold">Visage Core</h1>
          <p>AI-Powered Attendance System</p>
        </div>

        {error && (
          <div className="login-error" id="login-error">
            ⚠️ {error}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit} id="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="login-username">Username</label>
            <input
              type="text"
              className="form-input"
              id="login-username"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              type="password"
              className="form-input"
              id="login-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className={`btn btn-primary btn-lg w-full ${loading ? 'btn-loading' : ''}`}
            disabled={loading || !username || !password}
            id="btn-login"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <p style={{
            textAlign: 'center',
            fontSize: 'var(--font-xs)',
            color: 'var(--text-muted)',
            marginTop: 'var(--space-6)',
          }}>
            Demo: admin / admin (when offline)
          </p>
        </form>
      </div>
    </div>
  );
}
