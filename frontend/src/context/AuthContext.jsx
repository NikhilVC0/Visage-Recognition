import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('visage_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isAuthenticated = !!user;

  const login = useCallback(async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      // Try real API first
      const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const detailMsg = Array.isArray(err.detail)
          ? err.detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ')
          : err.detail;
        throw new Error(detailMsg || 'Invalid credentials');
      }

      const data = await response.json();
      const userData = {
        username: data.user?.username || data.username || username,
        role: data.user?.role || data.role || 'admin',
        name: data.user?.full_name || data.name || username,
      };

      localStorage.setItem('visage_token', data.access_token);
      localStorage.setItem('visage_user', JSON.stringify(userData));
      setUser(userData);
      return true;
    } catch (err) {
      // Fallback: allow demo login when API is unavailable
      if (err.message === 'Failed to fetch' || err.message.includes('Unable to connect')) {
        if (username === 'admin' && password === 'admin') {
          const demoUser = { username: 'admin', role: 'admin', name: 'Administrator' };
          localStorage.setItem('visage_token', 'demo-token-' + Date.now());
          localStorage.setItem('visage_user', JSON.stringify(demoUser));
          setUser(demoUser);
          return true;
        }
      }
      setError(err.message || 'Login failed');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('visage_token');
    localStorage.removeItem('visage_user');
    setUser(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, error, login, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
