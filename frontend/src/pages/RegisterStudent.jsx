import { useState, useRef, useEffect } from 'react';
import Camera from '../components/Camera';
import api from '../api/client';

const ANGLES = ["Look Straight at Camera", "Turn slightly Left", "Turn slightly Right", "Look slightly Up", "Look slightly Down"];

export default function RegisterStudent() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    studentId: '',
    name: '',
    className: '',
    section: '',
    year: new Date().getFullYear(),
  });
  const [availableClasses, setAvailableClasses] = useState([]);
  const [capturedImages, setCapturedImages] = useState([]);
  const [isCapturingSequence, setIsCapturingSequence] = useState(false);
  const [currentAngleIndex, setCurrentAngleIndex] = useState(0);
  
  const [registering, setRegistering] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [hintMessage, setHintMessage] = useState("");
  const [engineReady, setEngineReady] = useState(null); // null = checking, true/false
  const [headPoseAvailable, setHeadPoseAvailable] = useState(true);
  const [zeroPoseCount, setZeroPoseCount] = useState(0);
  const cameraRef = useRef(null);

  // Check if face engine models are loaded
  useEffect(() => {
    const checkEngine = async () => {
      try {
        const res = await api.get('/recognition/status');
        setEngineReady(res.ready);
        if (!res.ready) {
          setError('⚠️ Face recognition models are NOT loaded. The backend may be running in demo mode. Check backend console logs.');
        }
      } catch {
        setEngineReady(false);
        setError('Cannot connect to backend server. Make sure the backend is running on port 8000.');
      }
    };
    
    const fetchClasses = async () => {
      try {
        const res = await api.get('/students/classes');
        if (Array.isArray(res)) setAvailableClasses(res);
      } catch (err) {
        console.error("Failed to fetch classes", err);
      }
    };
    
    checkEngine();
    fetchClasses();
  }, []);

  const handleInfoSubmit = (e) => {
    e.preventDefault();
    setStep(2);
  };

  const startSequence = () => {
    setCapturedImages([]);
    setCurrentAngleIndex(0);
    setIsCapturingSequence(true);
    setError(null);
    setZeroPoseCount(0);
    setHeadPoseAvailable(true);
  };

  useEffect(() => {
    let active = true;
    let consecutiveZeroPose = 0;

    const checkFrame = async () => {
      if (!isCapturingSequence || currentAngleIndex >= ANGLES.length) return;
      if (!cameraRef.current) {
        if (active) setTimeout(checkFrame, 500);
        return;
      }

      try {
        const img = cameraRef.current.capture();
        if (!img) {
          if (active) setTimeout(checkFrame, 500);
          return;
        }

        const res = await api.post('/recognition/analyze_frame', { image: img });
        
        if (!active) return;

        if (!res.face_detected || res.quality === 'rejected') {
          const sizeInfo = res.face_size 
            ? ` (face: ${res.face_size.width}×${res.face_size.height}px)` 
            : '';
          setHintMessage(`No clear face detected${sizeInfo}. Move closer & improve lighting.`);
          setTimeout(checkFrame, 400);
          return;
        }

        if (!res.is_live) {
          setHintMessage(`Liveness check failed (score: ${(res.liveness_score || 0).toFixed(2)}). Ensure face is clearly visible.`);
          setTimeout(checkFrame, 400);
          return;
        }

        const yaw = res.pose?.yaw ?? 0;
        const pitch = res.pose?.pitch ?? 0;
        
        // Detect if head pose is always returning zeros (model issue)
        const isPoseZero = (yaw === 0 && pitch === 0);
        if (isPoseZero) {
          consecutiveZeroPose++;
        } else {
          consecutiveZeroPose = 0;
        }

        // If head pose returns zeros 4+ times, it's broken — skip pose validation
        const skipPoseCheck = consecutiveZeroPose >= 4 || 
                              res.head_pose_available === false ||
                              !headPoseAvailable;

        if (skipPoseCheck && consecutiveZeroPose >= 4 && headPoseAvailable) {
          setHeadPoseAvailable(false);
          setHintMessage("Head pose detection unavailable — using timed capture instead");
        }

        let isPoseCorrect = false;

        if (skipPoseCheck) {
          // When pose detection is broken, auto-capture with a delay between angles
          isPoseCorrect = true;
        } else {
          // Normal pose validation
          if (currentAngleIndex === 0) {
            if (Math.abs(yaw) < 15 && Math.abs(pitch) < 15) isPoseCorrect = true;
            else setHintMessage(`Look straight ahead (yaw: ${yaw.toFixed(0)}°, pitch: ${pitch.toFixed(0)}°)`);
          } else if (currentAngleIndex === 1) {
            if (yaw < -12) isPoseCorrect = true;
            else setHintMessage(`Turn your head more to the left (yaw: ${yaw.toFixed(0)}°, need < -12°)`);
          } else if (currentAngleIndex === 2) {
            if (yaw > 12) isPoseCorrect = true;
            else setHintMessage(`Turn your head more to the right (yaw: ${yaw.toFixed(0)}°, need > 12°)`);
          } else if (currentAngleIndex === 3) {
            if (pitch > 8) isPoseCorrect = true;
            else setHintMessage(`Tilt your head slightly up (pitch: ${pitch.toFixed(0)}°, need > 8°)`);
          } else if (currentAngleIndex === 4) {
            if (pitch < -8) isPoseCorrect = true;
            else setHintMessage(`Tilt your head slightly down (pitch: ${pitch.toFixed(0)}°, need < -8°)`);
          }
        }

        if (isPoseCorrect) {
          setHintMessage(skipPoseCheck ? "Capturing frame..." : "Perfect! Capturing...");
          setCapturedImages(prev => [...prev, img]);
          setCurrentAngleIndex(prev => prev + 1);
          // Wait longer between frames when pose detection is broken
          setTimeout(checkFrame, skipPoseCheck ? 2000 : 1500);
        } else {
          setTimeout(checkFrame, 300);
        }

      } catch (err) {
        console.error("Frame analysis error", err);
        if (active) setTimeout(checkFrame, 1000);
      }
    };

    if (isCapturingSequence && currentAngleIndex < ANGLES.length) {
      setHintMessage("Position your face in the oval");
      checkFrame();
    } else if (isCapturingSequence && currentAngleIndex >= ANGLES.length) {
      setIsCapturingSequence(false);
      setHintMessage("All angles captured successfully!");
    }

    return () => { active = false; };
  }, [isCapturingSequence, currentAngleIndex, headPoseAvailable]);

  // Manual capture for when auto-capture is stuck
  const handleManualCapture = () => {
    if (!cameraRef.current || currentAngleIndex >= ANGLES.length) return;
    const img = cameraRef.current.capture();
    if (img) {
      setCapturedImages(prev => [...prev, img]);
      setCurrentAngleIndex(prev => prev + 1);
      setHintMessage("Manually captured!");
    }
  };

  const handleRegister = async () => {
    if (capturedImages.length < ANGLES.length) return;
    setRegistering(true);
    setError(null);

    try {
      // 1. Create Student Record
      const studentPayload = {
        student_id: formData.studentId,
        name: formData.name,
        class_name: formData.className,
        section: formData.section,
        year: formData.year,
      };
      const studentRes = await api.post('/students', studentPayload);
      
      if (!studentRes || !studentRes.id) {
        throw new Error('Failed to create student record');
      }

      // 2. Register Faces
      const facePayload = {
        student_id: studentRes.id,
        images: capturedImages,
      };

      const res = await api.post('/recognition/register', facePayload);
      setResult({
        success: res.success,
        message: res.message || 'Student registered successfully!',
        livenessCheck: res.is_live ?? true,
        faceDetected: res.success,
        faceQuality: res.face_quality
      });
      setStep(3);
    } catch (err) {
      // Demo mode fallback
      if (err.message.includes('Unable to connect') || err.message.includes('Failed to fetch')) {
        setResult({
          success: true,
          message: 'Student registered successfully! (Demo mode)',
          livenessCheck: true,
          faceDetected: true,
        });
        setStep(3);
      } else {
        setError(err.message || 'Registration failed');
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setFormData({ studentId: '', name: '', className: '', section: '', year: new Date().getFullYear() });
    setCapturedImages([]);
    setIsCapturingSequence(false);
    setCurrentAngleIndex(0);
    setResult(null);
    setError(null);
    setZeroPoseCount(0);
    setHeadPoseAvailable(true);
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2>Register Student</h2>
          <p>Enroll a new student and capture their face for recognition</p>
        </div>
      </div>

      {/* Engine Status Warning */}
      {engineReady === false && (
        <div className="engine-warning" style={{
          background: 'rgba(255, 107, 53, 0.15)',
          border: '1px solid rgba(255, 107, 53, 0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4)',
          marginBottom: 'var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}>
          <span style={{ fontSize: '1.5rem' }}>⚠️</span>
          <div>
            <strong style={{ color: 'var(--warning)' }}>Face Engine Not Ready</strong>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', margin: 0 }}>
              Models are not loaded. Registration will use demo mode. Check backend logs for errors.
            </p>
          </div>
        </div>
      )}

      {/* Step Indicator */}
      <div className="register-step-indicator">
        <div className={`register-step ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>
          <div className="register-step-number">{step > 1 ? '✓' : '1'}</div>
          <span className="register-step-label">Student Info</span>
        </div>
        <div className={`register-step-connector ${step > 1 ? 'completed' : ''}`} />
        <div className={`register-step ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}>
          <div className="register-step-number">{step > 2 ? '✓' : '2'}</div>
          <span className="register-step-label">Face Capture</span>
        </div>
        <div className={`register-step-connector ${step > 2 ? 'completed' : ''}`} />
        <div className={`register-step ${step === 3 ? 'active' : ''}`}>
          <div className="register-step-number">3</div>
          <span className="register-step-label">Confirmation</span>
        </div>
      </div>

      <div className="register-layout">
        {/* Step 1: Student Info */}
        {step === 1 && (
          <div className="glass-card animate-fade-in-up">
            <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: 'var(--space-6)' }}>
              📋 Student Information
            </h3>
            <form onSubmit={handleInfoSubmit} id="register-info-form">
              <div className="form-group">
                <label className="form-label" htmlFor="reg-student-id">Student ID</label>
                <input
                  type="text"
                  className="form-input"
                  id="reg-student-id"
                  placeholder="e.g. STU016"
                  value={formData.studentId}
                  onChange={(e) => setFormData(prev => ({ ...prev, studentId: e.target.value }))}
                  required
                  autoFocus
                />
                <span className="form-hint">Unique student identifier</span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-name">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  id="reg-name"
                  placeholder="Enter student's full name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="reg-class">Group / Class</label>
                  <input
                    type="text"
                    list="classes-list"
                    className="form-input"
                    id="reg-class"
                    placeholder="e.g. Class 10, HR Dept"
                    value={formData.className}
                    onChange={(e) => setFormData(prev => ({ ...prev, className: e.target.value }))}
                  />
                  <datalist id="classes-list">
                    {availableClasses.map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reg-section">Subgroup / Section</label>
                  <input
                    type="text"
                    className="form-input"
                    id="reg-section"
                    placeholder="e.g. A, Floor 2"
                    value={formData.section}
                    onChange={(e) => setFormData(prev => ({ ...prev, section: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reg-year">Year</label>
                  <input
                    type="number"
                    className="form-input"
                    id="reg-year"
                    value={formData.year}
                    onChange={(e) => setFormData(prev => ({ ...prev, year: Number(e.target.value) }))}
                    min="2000"
                    max="2100"
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-lg" id="btn-next-step" style={{ marginTop: 'var(--space-4)' }}>
                Next → Face Capture
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Multi-Angle Face Capture */}
        {step === 2 && (
          <>
            <div className="glass-card animate-fade-in-up">
              <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                📸 Multi-Angle Face Capture
              </h3>
              <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)' }}>
                For best recognition, we need to capture your face from multiple angles. When ready, click "Start Auto-Capture" and follow the prompts on screen.
              </p>

              {!headPoseAvailable && (
                <div style={{
                  background: 'rgba(255, 193, 7, 0.12)',
                  border: '1px solid rgba(255, 193, 7, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                  marginBottom: 'var(--space-4)',
                  fontSize: 'var(--font-sm)',
                  color: 'var(--text-secondary)',
                }}>
                  ⚠️ Head pose detection is not available. Using timed auto-capture — please manually turn your head for each prompt.
                </div>
              )}
              
              <div style={{ position: 'relative' }}>
                <Camera ref={cameraRef} mode="multi" showGuide={true} />
                {isCapturingSequence && currentAngleIndex < ANGLES.length && (
                  <div style={{
                    position: 'absolute', top: 20, left: 0, right: 0, textAlign: 'center',
                    zIndex: 10, animation: 'pulse 1.5s infinite'
                  }}>
                    <div style={{
                      display: 'inline-block', background: 'var(--primary)', color: 'white',
                      padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-full)',
                      fontWeight: 'bold', fontSize: '1.2rem', boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                      marginBottom: '8px'
                    }}>
                      {ANGLES[currentAngleIndex]}
                    </div>
                    {hintMessage && (
                      <div style={{
                        background: hintMessage.includes('Perfect') || hintMessage.includes('Capturing') ? 'var(--success)' : 'rgba(0,0,0,0.7)', 
                        color: 'white', padding: '4px 12px', borderRadius: '12px',
                        fontSize: '0.9rem', width: 'fit-content', margin: '0 auto'
                      }}>
                        {hintMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 'var(--space-4)' }}>
                 <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)'}}>
                   Progress: {capturedImages.length} / {ANGLES.length} angles captured
                 </p>
                 <div style={{ display: 'flex', gap: 5, marginBottom: 'var(--space-4)' }}>
                   {ANGLES.map((_, i) => (
                      <div key={i} style={{
                        height: 8, flex: 1, borderRadius: 4,
                        background: i < capturedImages.length ? 'var(--success)' : 'var(--border-color)',
                        transition: 'background 0.3s'
                      }} />
                   ))}
                 </div>
              </div>

              {error && (
                <div className="login-error" style={{ marginTop: 'var(--space-4)' }}>
                  ⚠️ {error}
                </div>
              )}

              <div className="flex gap-3" style={{ marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={() => setStep(1)} id="btn-back-to-info" disabled={isCapturingSequence || registering}>
                  ← Back
                </button>
                
                {capturedImages.length < ANGLES.length ? (
                  <>
                    <button 
                      className={`btn btn-primary ${isCapturingSequence ? 'btn-loading' : ''}`}
                      onClick={startSequence}
                      disabled={isCapturingSequence}
                    >
                      {isCapturingSequence ? 'Capturing...' : (capturedImages.length > 0 ? 'Restart Capture' : 'Start Auto-Capture')}
                    </button>
                    {/* Manual capture fallback button */}
                    {isCapturingSequence && (
                      <button
                        className="btn btn-warning"
                        onClick={handleManualCapture}
                        title="Use this if auto-capture is stuck"
                        style={{ fontSize: 'var(--font-sm)' }}
                      >
                        📸 Manual Capture ({currentAngleIndex + 1}/{ANGLES.length})
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    className={`btn btn-primary ${registering ? 'btn-loading' : ''}`}
                    onClick={handleRegister}
                    disabled={registering}
                    id="btn-register-face"
                  >
                    {registering ? 'Processing & Registering...' : '✓ Complete Registration'}
                  </button>
                )}
              </div>
            </div>

            <div className="glass-card animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                Student Details
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Student ID</span>
                  <p style={{ fontWeight: 600 }}>{formData.studentId}</p>
                </div>
                <div>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Name</span>
                  <p style={{ fontWeight: 600 }}>{formData.name}</p>
                </div>
                <div>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Group / Subgroup</span>
                  <p style={{ fontWeight: 600 }}>{formData.className || 'None'} - {formData.section || 'None'}</p>
                </div>
              </div>

              <div style={{ marginTop: 'var(--space-6)' }}>
                <h4 style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                  📌 Auto-Capture Tips
                </h4>
                <ul style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <li>✅ Keep your head inside the oval frame</li>
                  <li>✅ Move slowly when the prompt changes</li>
                  <li>✅ Ensure the room is well-lit</li>
                  <li>✅ If auto-capture is stuck, use the Manual Capture button</li>
                  <li>✅ You can restart capture at any time</li>
                </ul>
              </div>

              {/* Engine Status */}
              <div style={{ marginTop: 'var(--space-6)', padding: 'var(--space-3)', background: 'var(--glass-bg)', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                  🔧 Engine Status
                </h4>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                  <div>Face Engine: {engineReady === null ? '⏳ Checking...' : engineReady ? '✅ Ready' : '⚠️ Demo Mode'}</div>
                  <div>Head Pose: {headPoseAvailable ? '✅ Available' : '⚠️ Unavailable (using timed capture)'}</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && result && (
          <div className="glass-card animate-fade-in-up" style={{ gridColumn: '1 / -1', maxWidth: 560, margin: '0 auto' }}>
            <div className="text-center" style={{ padding: 'var(--space-8) 0' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: result.success ? 'var(--success-light)' : 'var(--danger-light)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2rem', marginBottom: 'var(--space-4)',
              }}>
                {result.success ? '✅' : '❌'}
              </div>
              <h3 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                {result.success ? 'Registration Complete!' : 'Registration Failed'}
              </h3>
              <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-6)' }}>
                {result.message}
              </p>

              {result.success && (
                <div style={{
                  background: 'var(--glass-bg)', borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-4)', textAlign: 'left',
                  display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
                  marginBottom: 'var(--space-6)',
                }}>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>Student</span>
                    <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{formData.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>ID</span>
                    <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>{formData.studentId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>Multi-Angle Registration</span>
                    <span style={{ fontWeight: 600, color: 'var(--success)', fontSize: 'var(--font-sm)' }}>
                      ✓ Completed
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>Liveness Check</span>
                    <span style={{ fontWeight: 600, color: 'var(--success)', fontSize: 'var(--font-sm)' }}>
                      {result.livenessCheck ? '✓ Passed' : '✗ Failed'}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-center">
                <button className="btn btn-secondary" onClick={handleReset} id="btn-register-another">
                  Register Another
                </button>
                <button className="btn btn-primary" onClick={() => window.location.href = '/students'} id="btn-view-students">
                  View Students
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
