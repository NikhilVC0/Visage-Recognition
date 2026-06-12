import { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart
} from 'recharts';
import Card from '../components/Card';
import api from '../api/client';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e'];

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
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color, fontWeight: 700 }}>{p.name}: {p.value}%</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Analytics() {
  const [dateRange, setDateRange] = useState('week');
  const [dailyData, setDailyData] = useState([]);
  const [deptData, setDeptData] = useState([]);
  const [topStudents, setTopStudents] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [daily, dept, top] = await Promise.all([
          api.get(`/analytics/attendance-trends?days=${dateRange === 'week' ? 7 : dateRange === 'month' ? 30 : 90}`).catch(() => null),
          api.get('/analytics/classes').catch(() => null),
          api.get('/analytics/top-students').catch(() => null),
        ]);
        
        if (daily && daily.daily_data) {
          const formatted = daily.daily_data.map(d => {
            const parts = d.date.split('-');
            let dateLabel = d.date;
            if (parts.length === 3) {
              const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
              dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
            return {
              date: dateLabel,
              attendance: d.rate,
              total: d.total,
            };
          });
          setDailyData(formatted);
        }
        
        if (dept && Array.isArray(dept)) {
          const formatted = dept.map(d => ({
            name: d.class_name,
            rate: d.attendance_rate,
            students: d.total_students,
          }));
          setDeptData(formatted);
        }
        
        if (top && Array.isArray(top)) {
          setTopStudents(top.map(s => ({
            name: s.name,
            id: s.id,
            rate: s.rate,
            dept: s.class_name
          })));
        }
      } catch (error) {
        console.error("Failed to load analytics data", error);
      }
    };
    loadData();
  }, [dateRange]);

  const avgAttendance = dailyData.length > 0
    ? (dailyData.reduce((s, d) => s + (d.attendance || 0), 0) / dailyData.length).toFixed(1)
    : '0.0';
  const peakDay = dailyData.length > 0
    ? dailyData.reduce((a, b) => (a.attendance || 0) > (b.attendance || 0) ? a : b, dailyData[0])
    : { attendance: 0, date: '—' };

  const pieData = deptData.map(d => ({ name: d.name, value: d.students }));

  const handleExport = () => {
    const headers = ['Date', 'Attendance %', 'Total Students'];
    const rows = dailyData.map(d => [d.date, d.attendance, d.total].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${dateRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2>Analytics</h2>
          <p>Attendance insights and performance metrics</p>
        </div>
        <div className="page-header-right">
          <div className="analytics-filters">
            {['week', 'month', 'semester'].map(range => (
              <button
                key={range}
                className={`btn ${dateRange === range ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setDateRange(range)}
                id={`btn-range-${range}`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary" onClick={handleExport} id="btn-export-analytics">
            📊 Export
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid stagger-children">
        <Card title="Average Attendance" value={`${avgAttendance}%`} icon="📊" color="blue" trend={avgAttendance > 80 ? "up" : "down"} />
        <Card title="Peak Day" value={`${peakDay.attendance || 0}%`} icon="🏆" color="green" subtitle={peakDay.date} />
        <Card title="Total Students" value={dailyData.length > 0 ? dailyData[0].total : 0} icon="🎓" color="purple" trend="neutral" />
        <Card title="Total Groups" value={deptData.length || 0} icon="🏛️" color="amber" subtitle="All monitored" />
      </div>

      {/* Charts Grid */}
      <div className="analytics-grid" style={{ marginTop: 'var(--space-6)' }}>
        {/* Attendance Trend */}
        <div className="analytics-chart-card animate-fade-in-up">
          <h3 className="analytics-chart-title">📈 Attendance Rate by Day</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} domain={[70, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="attendance"
                name="Attendance"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#areaGradient)"
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Department Distribution */}
        <div className="analytics-chart-card animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <h3 className="analytics-chart-title">🏛️ Student Distribution by Group</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, value }) => `${name} (${value})`}
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No grouping data available
            </div>
          )}
        </div>

        {/* Department Breakdown */}
        <div className="analytics-chart-card animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <h3 className="analytics-chart-title">📋 Group-wise Attendance Rate</h3>
          {deptData.length > 0 ? (
            <ul className="dept-list">
              {deptData.map((dept, i) => (
                <li className="dept-item" key={i}>
                  <span className="dept-name">{dept.name}</span>
                  <div className="dept-bar">
                    <div className="progress-bar-container">
                      <div
                        className="progress-bar"
                        style={{
                          width: `${dept.rate}%`,
                          background: `linear-gradient(90deg, ${COLORS[i]}, ${COLORS[i]}aa)`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="dept-value">{dept.rate}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No attendance data to display
            </div>
          )}
        </div>

        {/* Top Students */}
        <div className="analytics-chart-card animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <h3 className="analytics-chart-title">🏅 Top Attending Students</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {topStudents.length > 0 ? topStudents.map((student, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                background: i < 3 ? 'rgba(59,130,246,0.05)' : 'transparent',
              }}>
                <span style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: i === 0 ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' :
                             i === 1 ? 'linear-gradient(135deg, #94a3b8, #64748b)' :
                             i === 2 ? 'linear-gradient(135deg, #cd7f32, #b8860b)' :
                             'var(--glass-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--font-xs)', fontWeight: 700,
                  color: i < 3 ? 'var(--bg-deep)' : 'var(--text-muted)',
                  flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {student.name}
                  </div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                    {student.id} · {student.dept}
                  </div>
                </div>
                <span style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--success)' }}>
                  {student.rate}%
                </span>
              </div>
            )) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: 'var(--space-4)' }}>
                No active students found
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
