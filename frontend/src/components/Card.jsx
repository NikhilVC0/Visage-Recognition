export default function Card({ title, value, subtitle, icon, trend, color = 'blue', onClick }) {
  const trendClass = trend === 'up' ? 'up' : trend === 'down' ? 'down' : 'neutral';
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—';
  const trendLabel = trend === 'up' ? '+5.2%' : trend === 'down' ? '-2.1%' : '0%';

  return (
    <div
      className="stat-card animate-fade-in-up"
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="stat-card-header">
        <div className={`stat-card-icon ${color}`}>
          {icon || '📊'}
        </div>
        {trend && (
          <div className={`stat-card-trend ${trendClass}`}>
            {trendIcon} {typeof trend === 'string' ? trendLabel : trend}
          </div>
        )}
      </div>
      <div className="stat-card-value">{value ?? '—'}</div>
      <div className="stat-card-title">{title}</div>
      {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
    </div>
  );
}
