import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, UserCheck, Video, Clock } from 'lucide-react';
import Card from '../components/Card';
import api from '../api/client';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(20, 24, 41, 0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: '0.8125rem',
      }}>
        <p style={{ color: '#94a3b8', marginBottom: 2 }}>{label}</p>
        <p style={{ color: '#3b82f6', fontWeight: 700 }}>{payload[0].value}% attendance</p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    todayAttendance: 0,
    activeSessions: 0,
    recognitionEvents: 0,
  });
  const [weeklyData, setWeeklyData] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsRes, logsRes] = await Promise.all([
          api.get('/analytics/dashboard').catch(() => null),
          api.get('/attendance/logs?page_size=10').catch(() => null),
        ]);
        
        if (statsRes) {
          setStats({
            totalStudents: statsRes.total_students ?? 0,
            todayAttendance: statsRes.attendance_rate ?? 0,
            activeSessions: statsRes.active_sessions ?? 0,
            recognitionEvents: statsRes.total_events_today ?? 0,
          });
        }
        
        if (logsRes && logsRes.records) {
          setActivity(logsRes.records.map(r => ({
            id: r.id,
            student: r.student_name,
            action: r.event_type === 'entry' ? 'marked present' : 'marked absent',
            time: new Date(r.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            type: r.event_type === 'entry' ? 'present' : 'absent',
            confidence: r.confidence_score ? `${(r.confidence_score * 100).toFixed(1)}%` : '—'
          })));
        }
      } catch {
        // If API fails, leave arrays empty
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const getActivityIcon = (type) => {
    switch (type) {
      case 'present': return { icon: '✅', bg: 'var(--success-light)', color: 'var(--success)' };
      case 'late': return { icon: '⏰', bg: 'var(--warning-light)', color: 'var(--warning)' };
      case 'absent': return { icon: '❌', bg: 'var(--danger-light)', color: 'var(--danger)' };
      case 'registered': return { icon: '📝', bg: 'var(--primary-light)', color: 'var(--primary)' };
      default: return { icon: '📋', bg: 'var(--glass-bg)', color: 'var(--text-secondary)' };
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2>Dashboard</h2>
          <p>Welcome back! Here's what's happening today.</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-primary" onClick={() => navigate('/live')} id="btn-start-session">
            ▶ Start Session
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/register')} id="btn-register-student">
            + Register Student
          </button>
        </div>
      </div>

      <div className="stats-grid stagger-children">
        <Card title="Total Students" value={stats.totalStudents} icon="🎓" color="blue" />
        <Card title="Today's Attendance" value={`${stats.todayAttendance}%`} icon="📊" color="green" />
        <Card title="Active Sessions" value={stats.activeSessions} icon="📹" color="purple" />
        <Card title="Recognition Events" value={stats.recognitionEvents.toLocaleString()} icon="🔍" color="amber" />
      </div>

      <div className="dashboard-grid">
        <div className="glass-card animate-fade-in-up">
          <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
            Weekly Attendance Trend
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={weeklyData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
              <Bar dataKey="attendance" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card animate-fade-in-up">
          <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
            Recent Activity
          </h3>
          <div className="activity-list">
            {activity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
                No recent activity.
              </div>
            ) : (
              activity.map(item => (
                <div key={item.id} className="activity-item">
                  <div className="activity-icon" style={{ background: getActivityIcon(item.type).bg, color: getActivityIcon(item.type).color }}>
                    {item.type === 'present' && <UserCheck size={16} />}
                    {item.type === 'absent' && <Users size={16} />}
                    {item.type === 'late' && <Clock size={16} />}
                  </div>
                  <div className="activity-details">
                    <p className="activity-text"><strong>{item.student}</strong> {item.action}</p>
                    <span className="activity-time">{item.time}</span>
                  </div>
                  <div className="activity-confidence">{item.confidence}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
