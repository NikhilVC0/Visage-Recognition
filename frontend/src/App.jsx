import { useState } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import RegisterStudent from './pages/RegisterStudent';
import AttendanceLogs from './pages/AttendanceLogs';
import LiveMonitor from './pages/LiveMonitor';
import Analytics from './pages/Analytics';
import CameraSettings from './pages/CameraSettings';

const pageTitles = {
  '/': { title: 'Dashboard', subtitle: 'Overview of your attendance system' },
  '/students': { title: 'Students', subtitle: 'Manage enrolled students' },
  '/register': { title: 'Register Student', subtitle: 'Enroll new students with face recognition' },
  '/attendance': { title: 'Attendance Logs', subtitle: 'View and manage records' },
  '/live': { title: 'Live Monitor', subtitle: 'Real-time face recognition' },
  '/cameras': { title: 'Camera Settings', subtitle: 'Manage camera sources' },
  '/analytics': { title: 'Analytics', subtitle: 'Insights and reports' },
};

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const pageInfo = pageTitles[location.pathname] || { title: 'Page', subtitle: '' };

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="app-content-wrapper">
        <Header
          title={pageInfo.title}
          subtitle={pageInfo.subtitle}
          onMenuClick={() => setSidebarOpen(prev => !prev)}
        />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/students" element={<Students />} />
          <Route path="/register" element={<RegisterStudent />} />
          <Route path="/attendance" element={<AttendanceLogs />} />
          <Route path="/live" element={<LiveMonitor />} />
          <Route path="/cameras" element={<CameraSettings />} />
          <Route path="/analytics" element={<Analytics />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
