import { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import api from '../api/client';

const mockLogs = [
  { id: 1, studentId: 'STU001', studentName: 'Priya Sharma', eventType: 'present', time: '2026-06-11 09:02:14', confidence: 98.4, session: 'CS-301 Morning', manualOverride: false },
  { id: 2, studentId: 'STU002', studentName: 'Rahul Verma', eventType: 'present', time: '2026-06-11 09:03:27', confidence: 96.1, session: 'CS-301 Morning', manualOverride: false },
  { id: 3, studentId: 'STU003', studentName: 'Anita Das', eventType: 'late', time: '2026-06-11 09:18:42', confidence: 94.7, session: 'CS-301 Morning', manualOverride: false },
  { id: 4, studentId: 'STU005', studentName: 'Sneha Patel', eventType: 'present', time: '2026-06-11 09:01:58', confidence: 99.2, session: 'ME-201 Lab', manualOverride: false },
  { id: 5, studentId: 'STU006', studentName: 'Amit Kumar', eventType: 'absent', time: '2026-06-11 09:30:00', confidence: 0, session: 'CS-301 Morning', manualOverride: true },
  { id: 6, studentId: 'STU008', studentName: 'Ravi Shankar', eventType: 'present', time: '2026-06-11 09:04:11', confidence: 95.3, session: 'ME-201 Lab', manualOverride: false },
  { id: 7, studentId: 'STU009', studentName: 'Meena Gupta', eventType: 'present', time: '2026-06-11 09:05:33', confidence: 97.8, session: 'CS-301 Morning', manualOverride: false },
  { id: 8, studentId: 'STU011', studentName: 'Lakshmi Venkat', eventType: 'late', time: '2026-06-11 09:22:15', confidence: 93.4, session: 'CE-101 Morning', manualOverride: false },
  { id: 9, studentId: 'STU013', studentName: 'Neha Joshi', eventType: 'present', time: '2026-06-11 09:01:47', confidence: 98.9, session: 'CS-301 Morning', manualOverride: false },
  { id: 10, studentId: 'STU014', studentName: 'Suresh Babu', eventType: 'present', time: '2026-06-11 09:06:22', confidence: 96.7, session: 'EC-202 Morning', manualOverride: false },
  { id: 11, studentId: 'STU004', studentName: 'Karthik Nair', eventType: 'present', time: '2026-06-11 09:03:55', confidence: 97.1, session: 'CS-301 Morning', manualOverride: false },
  { id: 12, studentId: 'STU007', studentName: 'Divya Iyer', eventType: 'absent', time: '2026-06-11 09:30:00', confidence: 0, session: 'CS-301 Morning', manualOverride: true },
];

const sessions = ['All Sessions', 'CS-301 Morning', 'ME-201 Lab', 'EC-202 Morning', 'CE-101 Morning'];

export default function AttendanceLogs() {
  const [logs, setLogs] = useState(mockLogs);
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState('2026-06-11');
  const [sessionFilter, setSessionFilter] = useState('All Sessions');

  useEffect(() => {
    const loadLogs = async () => {
      try {
        setLoading(true);
        const data = await api.get(`/attendance/logs?target_date=${dateFilter}`);
        if (data && data.records) {
          const formatted = data.records.map(r => ({
            id: r.id,
            studentId: r.student_student_id || String(r.student_id),
            studentName: r.student_name,
            eventType: r.event_type === 'entry' ? 'present' : 'absent',
            time: r.timestamp,
            confidence: r.confidence_score ? r.confidence_score * 100 : 0,
            session: r.session_id ? `Session #${r.session_id}` : 'General',
            manualOverride: r.is_manual_override,
          }));
          setLogs(formatted);
        }
      } catch {
        // Use mock data
      } finally {
        setLoading(false);
      }
    };
    loadLogs();
  }, [dateFilter]);

  const filteredLogs = sessionFilter === 'All Sessions'
    ? logs
    : logs.filter(l => l.session === sessionFilter);

  const handleOverride = async (logId) => {
    const reason = prompt('Please enter the reason for this attendance override:');
    if (reason === null) return;
    if (!reason.trim()) {
      alert('A reason is required to perform an override.');
      return;
    }

    try {
      const record = logs.find(l => l.id === logId);
      if (!record) return;

      const targetEventType = record.eventType === 'present' ? 'exit' : 'entry';
      const updated = await api.put(`/attendance/${logId}/override`, {
        event_type: targetEventType,
        notes: reason,
      });

      setLogs(prev => prev.map(l =>
        l.id === logId
          ? {
              ...l,
              eventType: updated.event_type === 'entry' ? 'present' : 'absent',
              manualOverride: true,
              confidence: updated.confidence_score ? updated.confidence_score * 100 : 0,
            }
          : l
      ));
    } catch (err) {
      alert(err.message || 'Failed to override attendance');
    }
  };

  const handleExport = (format) => {
    // Build CSV data for demo
    if (format === 'csv') {
      const headers = ['Student ID', 'Name', 'Status', 'Time', 'Confidence', 'Session'];
      const rows = filteredLogs.map(l =>
        [l.studentId, l.studentName, l.eventType, l.time, l.confidence, l.session].join(',')
      );
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${dateFilter}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const columns = [
    {
      key: 'studentName',
      accessor: 'studentName',
      header: 'Student',
      render: (val, row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{val}</div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>{row.studentId}</div>
        </div>
      ),
    },
    {
      key: 'eventType',
      accessor: 'eventType',
      header: 'Status',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: 'time',
      accessor: 'time',
      header: 'Time',
      render: (val) => {
        const timePart = val.includes('T') ? val.split('T')[1] : val.split(' ')[1] || val;
        const displayTime = timePart.substring(0, 8);
        return <span style={{ fontFamily: 'monospace', fontSize: 'var(--font-sm)' }}>{displayTime}</span>;
      },
    },
    {
      key: 'confidence',
      accessor: 'confidence',
      header: 'Confidence',
      render: (val) => {
        if (!val) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
        const color = val >= 95 ? 'var(--success)' : val >= 90 ? 'var(--warning)' : 'var(--danger)';
        return <span style={{ fontWeight: 700, color }}>{val.toFixed(1)}%</span>;
      },
    },
    { key: 'session', accessor: 'session', header: 'Session' },
    {
      key: 'manualOverride',
      accessor: 'manualOverride',
      header: 'Override',
      render: (val) => val ? (
        <span className="badge badge-pending">
          <span className="badge-dot" />Manual
        </span>
      ) : null,
    },
    {
      key: 'actions',
      accessor: () => '',
      header: '',
      sortable: false,
      width: '100px',
      render: (_, row) => (
        <button
          className="btn btn-ghost btn-sm"
          onClick={(e) => { e.stopPropagation(); handleOverride(row.id); }}
          title="Toggle override"
          id={`btn-override-${row.id}`}
        >
          ↻ Override
        </button>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2>Attendance Logs</h2>
          <p>View and manage attendance records</p>
        </div>
        <div className="page-header-right">
          <input
            type="date"
            className="form-input"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            id="filter-date"
            style={{ width: 180 }}
          />
          <select
            className="form-select"
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
            id="filter-session"
            style={{ width: 200 }}
          >
            {sessions.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={() => handleExport('csv')} id="btn-export-csv">
            📄 Export CSV
          </button>
          <button className="btn btn-secondary" onClick={() => handleExport('pdf')} id="btn-export-pdf">
            📑 Export PDF
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredLogs}
        loading={loading}
        searchPlaceholder="Search by student name or ID..."
        id="attendance-table"
        emptyIcon="📋"
        emptyTitle="No attendance records"
        emptySubtitle="Records will appear here once sessions are started"
      />
    </div>
  );
}
