import { useState, useEffect } from 'react';
import api from '../api/client';

const CAMERA_TYPES = [
  { value: 'webcam', label: '🎥 Local Webcam', hint: 'Built-in or USB camera (use device index like 0, 1)' },
  { value: 'rtsp', label: '📹 RTSP Stream', hint: 'CCTV / IP Camera (e.g., rtsp://user:pass@192.168.1.100:554/stream)' },
  { value: 'http', label: '📱 HTTP / Phone Camera', hint: 'MJPEG stream (e.g., http://192.168.1.50:8080/video)' },
  { value: 'onvif', label: '🏢 ONVIF Camera', hint: 'ONVIF-compatible network camera' },
];

export default function CameraSettings() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    source_url: '0',
    camera_type: 'webcam',
    role: 'entry',
    location: '',
    fps: 1.0,
    notes: '',
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const loadCameras = async () => {
    try {
      setLoading(true);
      const res = await api.get('/cameras?active_only=false');
      setCameras(res || []);
    } catch {
      setCameras([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCameras(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/cameras', formData);
      setSuccess('Camera added successfully!');
      setShowAddForm(false);
      setFormData({ name: '', source_url: '0', camera_type: 'webcam', role: 'entry', location: '', fps: 1.0, notes: '' });
      await loadCameras();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to add camera');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this camera source?')) return;
    try {
      await api.delete(`/cameras/${id}`);
      await loadCameras();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTest = async (sourceUrl, cameraType, id = null) => {
    setTesting(id || 'new');
    setTestResult(null);
    try {
      const res = await api.post('/cameras/test', { source_url: sourceUrl, camera_type: cameraType });
      setTestResult(res);
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(null);
    }
  };

  const handleSnapshot = async (id) => {
    try {
      const res = await api.get(`/cameras/${id}/snapshot`);
      setPreviewImage({ id, image: res.image, resolution: res.resolution });
    } catch (err) {
      setError(`Snapshot failed: ${err.message}`);
    }
  };

  const handleToggleActive = async (id, currentActive) => {
    try {
      await api.patch(`/cameras/${id}`, { is_active: !currentActive });
      await loadCameras();
    } catch (err) {
      setError(err.message);
    }
  };

  const selectedType = CAMERA_TYPES.find(t => t.value === formData.camera_type);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2>Camera Settings</h2>
          <p>Manage camera sources for attendance monitoring</p>
        </div>
        <div className="page-header-right">
          <button
            className="btn btn-primary btn-lg"
            onClick={() => { setShowAddForm(!showAddForm); setError(null); setTestResult(null); }}
          >
            {showAddForm ? '✕ Cancel' : '+ Add Camera'}
          </button>
        </div>
      </div>

      {success && (
        <div style={{
          background: 'rgba(0, 200, 117, 0.15)',
          border: '1px solid rgba(0, 200, 117, 0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
          fontSize: 'var(--font-sm)',
          color: 'var(--success)',
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        }}>
          ✅ {success}
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(255, 107, 53, 0.15)',
          border: '1px solid rgba(255, 107, 53, 0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
          fontSize: 'var(--font-sm)',
          color: 'var(--warning)',
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        }}>
          ⚠️ {error}
          <button
            onClick={() => setError(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.1rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {showAddForm && (
        <div className="glass-card animate-fade-in-up" style={{ marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
            📷 Add New Camera Source
          </h3>

          <form onSubmit={handleAdd}>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Camera Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Front Entrance Camera"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Type</label>
                <select
                  className="form-select"
                  value={formData.camera_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, camera_type: e.target.value }))}
                >
                  {CAMERA_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Role</label>
                <select
                  className="form-select"
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                >
                  <option value="entry">Entrance (Marks In)</option>
                  <option value="exit">Exit (Marks Out)</option>
                  <option value="both">Both (Depends on session)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Source URL / Device Index</label>
              <input
                type="text"
                className="form-input"
                placeholder={selectedType?.hint || 'Camera source'}
                value={formData.source_url}
                onChange={(e) => setFormData(prev => ({ ...prev, source_url: e.target.value }))}
                required
              />
              <span className="form-hint">{selectedType?.hint}</span>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Location</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Room 301, Main Gate"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Capture FPS</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.fps}
                  onChange={(e) => setFormData(prev => ({ ...prev, fps: parseFloat(e.target.value) || 1.0 }))}
                  min="0.1"
                  max="30"
                  step="0.1"
                />
                <span className="form-hint">Frames per second for capture (1.0 recommended)</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <input
                type="text"
                className="form-input"
                placeholder="Optional notes about this camera"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            {testResult && (
              <div style={{
                background: testResult.success ? 'rgba(0, 200, 117, 0.1)' : 'rgba(255, 71, 87, 0.1)',
                border: `1px solid ${testResult.success ? 'rgba(0, 200, 117, 0.3)' : 'rgba(255, 71, 87, 0.3)'}`,
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                marginBottom: 'var(--space-4)',
                fontSize: 'var(--font-sm)',
              }}>
                {testResult.success
                  ? `✅ Connection successful! Resolution: ${testResult.resolution || 'Unknown'}`
                  : `❌ Connection failed: ${testResult.error || 'Unknown error'}`}
              </div>
            )}

            <div className="flex gap-3" style={{ marginTop: 'var(--space-4)' }}>
              <button type="submit" className="btn btn-primary">
                💾 Save Camera
              </button>
              <button
                type="button"
                className={`btn btn-secondary ${testing === 'new' ? 'btn-loading' : ''}`}
                onClick={() => handleTest(formData.source_url, formData.camera_type)}
                disabled={testing === 'new'}
              >
                {testing === 'new' ? 'Testing...' : '🔌 Test Connection'}
              </button>
            </div>
          </form>
        </div>
      )}

      {previewImage && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 'var(--space-4)',
          }}
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="glass-card animate-fade-in-up"
            style={{ maxWidth: 700, width: '100%', padding: 'var(--space-6)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between" style={{ marginBottom: 'var(--space-4)', alignItems: 'center' }}>
              <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 600 }}>📸 Camera Snapshot</h3>
              <button
                className="btn btn-secondary"
                onClick={() => setPreviewImage(null)}
                style={{ padding: '4px 12px', fontSize: 'var(--font-sm)' }}
              >
                ✕ Close
              </button>
            </div>
            <img
              src={previewImage.image}
              alt="Camera snapshot"
              style={{
                width: '100%', borderRadius: 'var(--radius-lg)',
                border: '2px solid var(--border-color)',
              }}
            />
            {previewImage.resolution && (
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-2)', textAlign: 'center' }}>
                Resolution: {previewImage.resolution}
              </p>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 'var(--space-4)' }}>
        {loading ? (
          <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-8)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)' }}>⏳</div>
            <p style={{ color: 'var(--text-muted)' }}>Loading cameras...</p>
          </div>
        ) : cameras.length === 0 ? (
          <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-8)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-3)', opacity: 0.3 }}>📷</div>
            <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              No Cameras Configured
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-4)' }}>
              Add a camera source to start monitoring attendance. You can use a local webcam, RTSP stream, or phone camera.
            </p>
            <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
              + Add Your First Camera
            </button>
          </div>
        ) : (
          cameras.map(cam => (
            <div className="glass-card animate-fade-in-up" key={cam.id}>
              <div className="flex justify-between" style={{ marginBottom: 'var(--space-3)', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ fontSize: 'var(--font-md)', fontWeight: 600, marginBottom: 4 }}>
                    {CAMERA_TYPES.find(t => t.value === cam.camera_type)?.label?.split(' ')[0] || '📷'} {cam.name}
                  </h4>
                  <span style={{
                    display: 'inline-block',
                    fontSize: 'var(--font-xs)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: cam.is_active ? 'rgba(0, 200, 117, 0.15)' : 'rgba(255, 71, 87, 0.15)',
                    color: cam.is_active ? 'var(--success)' : 'var(--danger)',
                    fontWeight: 600,
                  }}>
                    {cam.is_active ? '● Active' : '○ Inactive'}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(cam.id)}
                  style={{
                    background: 'rgba(255, 71, 87, 0.1)', border: '1px solid rgba(255, 71, 87, 0.2)',
                    color: 'var(--danger)', borderRadius: 'var(--radius-md)',
                    padding: '4px 10px', cursor: 'pointer', fontSize: 'var(--font-xs)',
                  }}
                >
                  🗑 Remove
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                <div className="flex justify-between">
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Type</span>
                  <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600 }}>
                    {CAMERA_TYPES.find(t => t.value === cam.camera_type)?.label || cam.camera_type}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Source</span>
                  <span style={{
                    fontSize: 'var(--font-xs)', fontWeight: 500, fontFamily: 'monospace',
                    maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }} title={cam.source_url}>
                    {cam.source_url}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Role</span>
                  <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: cam.role === 'entry' ? 'var(--primary-light)' : 'var(--warning)' }}>
                    {cam.role === 'entry' ? '🟢 Entrance' : cam.role === 'exit' ? '🔴 Exit' : '🔵 Both'}
                  </span>
                </div>
                {cam.location && (
                  <div className="flex justify-between">
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Location</span>
                    <span style={{ fontSize: 'var(--font-xs)', fontWeight: 500 }}>{cam.location}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Capture FPS</span>
                  <span style={{ fontSize: 'var(--font-xs)', fontWeight: 500 }}>{cam.fps || 1.0}</span>
                </div>
              </div>

              <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                <button
                  className={`btn btn-secondary ${testing === cam.id ? 'btn-loading' : ''}`}
                  onClick={() => handleTest(cam.source_url, cam.camera_type, cam.id)}
                  disabled={testing === cam.id}
                  style={{ fontSize: 'var(--font-xs)', padding: '6px 12px' }}
                >
                  {testing === cam.id ? 'Testing...' : '🔌 Test'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleSnapshot(cam.id)}
                  style={{ fontSize: 'var(--font-xs)', padding: '6px 12px' }}
                >
                  📸 Snapshot
                </button>
                <button
                  className={`btn ${cam.is_active ? 'btn-warning' : 'btn-success'}`}
                  onClick={() => handleToggleActive(cam.id, cam.is_active)}
                  style={{ fontSize: 'var(--font-xs)', padding: '6px 12px' }}
                >
                  {cam.is_active ? '⏸ Disable' : '▶ Enable'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="glass-card" style={{ marginTop: 'var(--space-6)' }}>
        <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
          💡 Camera Setup Guide
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
          {CAMERA_TYPES.map(type => (
            <div key={type.value} style={{
              padding: 'var(--space-3)',
              background: 'var(--glass-bg)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
            }}>
              <div style={{ fontSize: 'var(--font-md)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                {type.label}
              </div>
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', margin: 0 }}>
                {type.hint}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
