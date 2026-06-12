import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Menu, Search, Bell, Sun, Moon } from 'lucide-react';

export default function Header({ title, subtitle, onMenuClick }) {
  const { user } = useAuth();
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return (
    <header className="header" id="app-header">
      <div className="header-left">
        <button
          className="mobile-menu-btn"
          onClick={onMenuClick}
          id="btn-mobile-menu"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>
        <div>
          <h1 className="header-title">{title || 'Dashboard'}</h1>
          {subtitle && <p className="header-subtitle">{subtitle}</p>}
        </div>
      </div>

      <div className="header-right">
        <div className="header-search">
          <span className="header-search-icon"><Search size={16} /></span>
          <input
            type="text"
            placeholder="Search anything..."
            id="header-search-input"
          />
        </div>

        <button className="header-notification" onClick={toggleTheme} title="Toggle Theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button className="header-notification" id="btn-notifications" title="Notifications">
          <Bell size={18} />
          <span className="header-notification-dot" />
        </button>

        <div className="flex items-center gap-3">
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
              {user?.name || 'Admin'}
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
              {user?.role || 'Administrator'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
