const statusConfig = {
  present: { label: 'Present', className: 'badge-present' },
  absent: { label: 'Absent', className: 'badge-absent' },
  late: { label: 'Late', className: 'badge-late' },
  active: { label: 'Active', className: 'badge-active' },
  inactive: { label: 'Inactive', className: 'badge-inactive' },
  pending: { label: 'Pending', className: 'badge-pending' },
  registered: { label: 'Registered', className: 'badge-present' },
  unregistered: { label: 'Unregistered', className: 'badge-neutral' },
  yes: { label: 'Yes', className: 'badge-present' },
  no: { label: 'No', className: 'badge-absent' },
};

export default function StatusBadge({ status, label }) {
  const key = String(status).toLowerCase();
  const config = statusConfig[key] || { label: status, className: 'badge-neutral' };

  return (
    <span className={`badge ${config.className}`}>
      <span className="badge-dot" />
      {label || config.label}
    </span>
  );
}
