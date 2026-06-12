import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';

const Camera = forwardRef(({ onCapture, onError, autoStart = true, showGuide = true, mode = 'single', sourceUrl = null }, ref) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);
  const [captured, setCaptured] = useState(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      
      if (sourceUrl) {
        // Remote camera — use an img element or fetch snapshots
        // For MJPEG streams, we can set the video src directly
        if (videoRef.current) {
          videoRef.current.src = sourceUrl;
          try {
            await videoRef.current.play();
          } catch {
            // MJPEG streams might not support play()
          }
        }
        setIsActive(true);
        return;
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
      } catch (err) {
        const msg = (err.message || '').toLowerCase();
        if (err.name === 'NotReadableError' || msg.includes('timeout') || msg.includes('hardware') || msg.includes('source')) {
          console.warn(`Camera lock/timeout detected (${err.message}). Retrying in 2 seconds...`);
          await new Promise(r => setTimeout(r, 2000));
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
            audio: false,
          });
        } else {
          throw err;
        }
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Retry logic for the play() DOMException
        let attempts = 0;
        const tryPlay = () => new Promise((resolve, reject) => {
          const attempt = async () => {
            try {
              if (videoRef.current) {
                await videoRef.current.play();
              }
              resolve();
            } catch (e) {
              const msg = (e.message || '').toLowerCase();
              if (e.name === 'AbortError' || e.name === 'NotReadableError' || msg.includes('interrupted') || msg.includes('timeout') || msg.includes('hardware')) {
                attempts++;
                if (attempts < 5) {
                  console.warn(`Camera play() failed (${e.message}). Retrying in 1s (Attempt ${attempts}/5)...`);
                  setTimeout(attempt, 1000); // Retry after 1s
                } else {
                  console.warn('Camera play() repeatedly failed. It may load automatically later.', e);
                  resolve(); // resolve anyway, so we don't crash the UI completely
                }
              } else {
                reject(e); // Re-throw other unexpected errors
              }
            }
          };
          attempt();
        });
        await tryPlay();
      }
      setIsActive(true);
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Camera access denied. Please enable camera permissions.'
        : err.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : `Failed to access camera: ${err.message}`;
      setError(msg);
      onError?.(msg);
    }
  }, [onError, sourceUrl]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.9);
    
    if (mode === 'single') {
      setCaptured(base64);
    }
    onCapture?.(base64);
    return base64;
  }, [onCapture, mode]);

  useImperativeHandle(ref, () => ({
    capture,
    startCamera,
    stopCamera
  }));

  const retake = useCallback(() => {
    setCaptured(null);
  }, []);

  useEffect(() => {
    if (autoStart) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [autoStart, startCamera, stopCamera]);

  if (error) {
    return (
      <div className="camera-container">
        <div className="camera-error">
          <div className="camera-error-icon">📷</div>
          <p style={{ fontWeight: 600, fontSize: 'var(--font-md)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
            Camera Unavailable
          </p>
          <p style={{ fontSize: 'var(--font-sm)', marginBottom: 'var(--space-4)' }}>
            {error}
          </p>
          <button className="btn btn-primary" onClick={startCamera} id="btn-retry-camera">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="camera-container">
      <video 
        ref={videoRef} 
        className="camera-video" 
        muted 
        playsInline 
        style={{ display: captured && mode === 'single' ? 'none' : 'block' }}
      />
      
      {captured && mode === 'single' && (
        <>
          <img
            src={captured}
            alt="Captured"
            style={{ width: '100%', borderRadius: 'var(--radius-xl)', transform: 'scaleX(-1)' }}
          />
          <div className="camera-controls">
            <button className="btn btn-secondary" onClick={retake} id="btn-retake">
              ↺ Retake
            </button>
          </div>
        </>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {showGuide && (!captured || mode !== 'single') && (
        <div className="camera-overlay">
          <div className="camera-face-guide" />
        </div>
      )}

      {(!captured || mode !== 'single') && (
        <div className="camera-status">
          <span className={`camera-status-dot ${isActive ? '' : 'inactive'}`} />
          {isActive ? 'Camera Active' : 'Starting...'}
        </div>
      )}

      {mode === 'single' && !captured && (
        <div className="camera-controls">
          <button
            className="camera-capture-btn"
            onClick={capture}
            disabled={!isActive}
            title="Capture photo"
            id="btn-capture"
          />
        </div>
      )}
    </div>
  );
});

export default Camera;
