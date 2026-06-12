import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, Users, UserPlus, ClipboardList, 
  MonitorPlay, Camera, LineChart, Lock, LogOut 
} from 'lucide-react';

const navItems = [
  { section: 'Main' },
  { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { path: '/students', label: 'Students', icon: <Users size={18} /> },
  { path: '/register', label: 'Register', icon: <UserPlus size={18} /> },
  { section: 'Monitoring' },
  { path: '/attendance', label: 'Attendance', icon: <ClipboardList size={18} /> },
  { path: '/live', label: 'Live Monitor', icon: <MonitorPlay size={18} /> },
  { path: '/cameras', label: 'Cameras', icon: <Camera size={18} /> },
  { section: 'Insights' },
  { path: '/analytics', label: 'Analytics', icon: <LineChart size={18} /> },
];

export default function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'AD';

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={onClose}
          style={{
            display: 'none',
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 99,
          }}
        />
      )}
      <style>{`
        @media (max-width: 768px) {
          .sidebar-overlay { display: block !important; }
        }
      `}</style>

      <aside className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`} id="sidebar-nav">
        {/* Brand */}
        <div 
          className="sidebar-brand" 
          onClick={onToggleCollapse}
          style={{ cursor: 'pointer' }}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <div className="sidebar-brand-icon"><Lock size={24} /></div>
          {!isCollapsed && (
            <div className="sidebar-brand-text">
              <h1 className="cormorant-unicase-semibold">Visage</h1>
              <span>Core MVP</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navItems.map((item, index) => {
            if (item.section) {
              return !isCollapsed ? (
                <div className="sidebar-section-label" key={`section-${index}`}>
                  {item.section}
                </div>
              ) : (
                <div className="sidebar-section-divider" key={`section-${index}`} />
              );
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`
                }
                end={item.path === '/'}
                onClick={onClose}
                id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <span className="sidebar-link-icon" title={isCollapsed ? item.label : undefined}>{item.icon}</span>
                {!isCollapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* User section */}
        <div className="sidebar-user" onClick={isCollapsed ? onToggleCollapse : undefined} style={{ cursor: isCollapsed ? 'pointer' : 'default' }}>
          <div className="sidebar-user-avatar" title={isCollapsed ? (user?.name || 'Admin') : undefined}>{initials}</div>
          {!isCollapsed && (
            <>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user?.name || 'Admin'}</div>
                <div className="sidebar-user-role">{user?.role || 'Administrator'}</div>
              </div>
              <button
                className="sidebar-logout-btn"
                onClick={(e) => { e.stopPropagation(); logout(); }}
                title="Logout"
                id="btn-logout"
              >
                <LogOut size={18} />
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
