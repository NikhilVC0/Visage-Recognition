import { useState, useEffect, useRef, useCallback } from 'react';
import Camera from '../components/Camera';
import api from '../api/client';
import swishSound from '../sound/swish.wav';

const getConfidenceClass = (c) => c >= 95 ? 'high' : c >= 85 ? 'medium' : 'low';

const playBeep = () => {
  try {
    const audio = new Audio(swishSound);
    audio.play();
  } catch (e) {
    console.warn("Audio play blocked", e);
  }
};

export default function LiveMonitor() {
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionId, setSessionId] = useState(null); 
  const [detections, setDetections] = useState([]);
  const [sessionName, setSessionName] = useState('Morning Attendance');
  const [totalDetected, setTotalDetected] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [engineReady, setEngineReady] = useState(null);
  
  const [cameras, setCameras] = useState([]);
  const [selectedCameras, setSelectedCameras] = useState(['webcam']); // Array of selected camera IDs
  
  const timerRef = useRef(null);
  const captureIntervalRef = useRef(null);
  const cameraRef = useRef(null); // Reference for local webcam
  
  // Debounce dictionary: { studentId: timestamp }
  const recentDetections = useRef(new Map());

  useEffect(() => {
    const init = async () => {
      try {
        const status = await api.get('/recognition/status');
        setEngineReady(status.ready);
      } catch {
        setEngineReady(false);
      }
      try {
        const cams = await api.get('/cameras');
        setCameras(cams || []);
      } catch {
        // API not available
      }
    };
    init();
  }, []);

  const toggleCameraSelection = (cameraId) => {
    setSelectedCameras(prev => 
      prev.includes(cameraId) 
        ? prev.filter(id => id !== cameraId)
        : [...prev, cameraId]
    );
  };

  const startSession = useCallback(async () => {
    if (selectedCameras.length === 0) {
      alert("Please select at least one camera.");
      return;
    }

    let realSessionId = null;
    try {
      // Create session for the first selected camera as primary
      const sessionRes = await api.post('/attendance/sessions', {
        session_name: sessionName,
        camera_id: selectedCameras[0], 
      });
      realSessionId = sessionRes.id;
      setSessionId(realSessionId);
    } catch (err) {
      console.warn('Could not create session:', err);
    }

    setSessionActive(true);
    setDetections([]);
    setTotalDetected(0);
    setElapsedTime(0);
    recentDetections.current.clear();

    timerRef.current = setInterval(() => {
      setElapsedTime(t => t + 1);
    }, 1000);

    captureIntervalRef.current = setInterval(async () => {
      // Loop over all selected cameras and process frames concurrently
      const capturePromises = selectedCameras.map(async (camId) => {
        let image = null;
        let eventType = 'entry'; // Default

        if (camId === 'webcam') {
          if (cameraRef.current) {
            image = cameraRef.current.capture();
          }
        } else {
          // Find camera info to get its role
          const camInfo = cameras.find(c => c.id === camId);
          if (camInfo && camInfo.role) {
            eventType = camInfo.role === 'both' ? 'entry' : camInfo.role;
          }
          try {
            const snap = await api.get(`/cameras/${camId}/snapshot`);
            image = snap?.image;
          } catch {
            // Camera offline
          }
        }

        if (image) {
          try {
            const res = await api.post('/recognition/identify', { 
              image, 
              session_id: realSessionId,
              event_type: eventType
            });
            
            if (res && res.success && res.student_id) {
              const studentId = res.student_code || res.student_id;
              const now = Date.now();
              const lastDetected = recentDetections.current.get(studentId) || 0;
              
              // 10-second debounce per student
              if (now - lastDetected > 10000) {
                playBeep();
                recentDetections.current.set(studentId, now);
                
                const det = {
                  id: now + Math.random(),
                  name: res.student_name,
                  studentId: studentId,
                  confidence: (res.confidence || 0) * 100,
                  time: new Date().toLocaleTimeString(),
                  action: eventType === 'entry' ? '🟢 Present' : '🔴 Left',
                  source: camId === 'webcam' ? 'Webcam' : cameras.find(c => c.id === camId)?.name || 'Camera'
                };
                setDetections(prev => [det, ...prev].slice(0, 15));
                setTotalDetected(t => t + 1);
              }
            }
          } catch (error) {
            console.error('Recognition error:', error);
          }
        }
      });

      await Promise.all(capturePromises);
    }, 1500);
  }, [sessionName, selectedCameras, cameras]);

  const stopSession = useCallback(async () => {
    setSessionActive(false);
    clearInterval(timerRef.current);
    clearInterval(captureIntervalRef.current);
    
    if (sessionId) {
      try {
        await api.post(`/attendance/sessions/${sessionId}/end`, {});
      } catch {
        // Non-critical
      }
    }
    setSessionId(null);
  }, [sessionId]);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearInterval(captureIntervalRef.current);
    };
  }, []);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const initials = (name) => name.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2>Live Monitor</h2>
          <p>Multi-camera real-time face recognition</p>
        </div>
        <div className="page-header-right">
          <input
            type="text"
            className="form-input"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="Session name"
            disabled={sessionActive}
            style={{ width: 250 }}
          />
          {!sessionActive ? (
            <button className="btn btn-success btn-lg" onClick={startSession}>
              ▶ Start Session
            </button>
          ) : (
            <button className="btn btn-danger btn-lg" onClick={stopSession}>
              ⏹ Stop Session
            </button>
          )}
        </div>
      </div>

      {engineReady === false && (
        <div style={{
          background: 'rgba(255, 107, 53, 0.15)',
          border: '1px solid rgba(255, 107, 53, 0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
          fontSize: 'var(--font-sm)',
          color: 'var(--text-secondary)',
        }}>
          ⚠️ Face recognition engine is not ready.
        </div>
      )}

      {/* Pre-session Camera Selection */}
      {!sessionActive && (
        <div className="glass-card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
          <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
            Select Active Cameras
          </h3>
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={selectedCameras.includes('webcam')} 
                onChange={() => toggleCameraSelection('webcam')}
                style={{ width: 18, height: 18 }}
              />
              <span>🎥 Local Webcam <small>(Entry)</small></span>
            </label>
            {cameras.map(cam => (
              <label key={cam.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={selectedCameras.includes(cam.id)} 
                  onChange={() => toggleCameraSelection(cam.id)}
                  style={{ width: 18, height: 18 }}
                />
                <span>
                  📹 {cam.name} 
                  <small style={{ color: cam.role === 'entry' ? 'var(--primary-light)' : 'var(--warning)', marginLeft: 4 }}>
                    ({cam.role === 'entry' ? 'Entry' : cam.role === 'exit' ? 'Exit' : 'Both'})
                  </small>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="live-monitor-layout">
        {/* Camera Feeds Grid */}
        <div className="live-feed-wrapper">
          <div className="live-feed-header">
            <div className="live-status-indicators">
              <div className="live-status-item">
                <span className={`live-status-dot ${sessionActive ? 'active' : 'inactive'}`} />
                {sessionActive ? 'Monitoring' : 'Standby'}
              </div>
              {sessionActive && (
                <div className="live-status-item" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  ⏱ {formatTime(elapsedTime)}
                </div>
              )}
            </div>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: selectedCameras.length > 1 ? 'repeat(auto-fit, minmax(300px, 1fr))' : '1fr', 
            gap: 'var(--space-3)',
            marginTop: 'var(--space-3)'
          }}>
            {selectedCameras.length === 0 && !sessionActive && (
              <div className="glass-card text-center" style={{ padding: 'var(--space-6)' }}>
                Please select at least one camera above to begin.
              </div>
            )}
            
            {selectedCameras.map(camId => {
              if (camId === 'webcam') {
                return (
                  <div key="webcam" style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
                      🎥 Webcam (Entry)
                    </div>
                    <Camera ref={cameraRef} autoStart={sessionActive} showGuide={false} mode="continuous" onCapture={() => {}} />
                  </div>
                );
              } else {
                const cam = cameras.find(c => c.id === camId);
                return (
                  <div key={camId} className="camera-container" style={{ 
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    minHeight: selectedCameras.length > 1 ? 250 : 400, 
                    background: 'var(--glass-bg)', borderRadius: 'var(--radius-xl)', position: 'relative'
                  }}>
                    <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
                      📹 {cam?.name} ({cam?.role})
                    </div>
                    {sessionActive ? (
                      <img 
                        src={`http://localhost:8000/api/v1/cameras/${camId}/stream`} 
                        alt={cam?.name} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-xl)' }} 
                        onError={(e) => {
                          // Fallback to polling text if stream fails (since we use snapshot for logic anyway)
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : (
                      <div className="text-center" style={{ color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>📹</div>
                        <p>{cam?.name}</p>
                      </div>
                    )}
                    <div className="text-center" style={{ color: 'var(--text-muted)', display: 'none', position: 'absolute' }}>
                       <p>Stream not available. Processing frames in background.</p>
                    </div>
                  </div>
                );
              }
            })}
          </div>

          {/* Session Stats */}
          {sessionActive && (
            <div className="flex gap-4" style={{ marginTop: 'var(--space-4)' }}>
              <div className="glass-card" style={{ flex: 1, padding: 'var(--space-4)', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, color: 'var(--primary)' }}>
                  {totalDetected}
                </div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Events Logged</div>
              </div>
              <div className="glass-card" style={{ flex: 1, padding: 'var(--space-4)', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, color: 'var(--success)' }}>
                  {detections.filter(d => d.confidence >= 90).length}
                </div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>High Confidence</div>
              </div>
              <div className="glass-card" style={{ flex: 1, padding: 'var(--space-4)', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, color: 'var(--warning)' }}>
                  {detections.length > 0 ? (detections.reduce((s, d) => s + d.confidence, 0) / detections.length).toFixed(1) : '—'}%
                </div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Avg Conf.</div>
              </div>
            </div>
          )}
        </div>

        {/* Detection Panel */}
        <div className="live-detections-panel">
          <div className="glass-card" style={{ padding: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
              🎯 Live Activity
            </h3>

            {detections.length === 0 ? (
              <div className="text-center" style={{ padding: 'var(--space-8) 0', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)', opacity: 0.3 }}>👤</div>
                <p style={{ fontSize: 'var(--font-sm)' }}>
                  {sessionActive ? 'Waiting for detections...' : 'Start a session to begin'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {detections.map(det => (
                  <div className="detection-card" key={det.id}>
                    <div className="detection-avatar">{initials(det.name)}</div>
                    <div className="detection-info">
                      <div className="detection-name">{det.name}</div>
                      <div className="detection-meta">{det.studentId} · {det.time}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{det.source}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>{det.action}</div>
                      <div className={`detection-confidence ${getConfidenceClass(det.confidence)}`}>
                        {det.confidence.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
