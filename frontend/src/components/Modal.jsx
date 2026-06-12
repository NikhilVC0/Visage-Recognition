import { useEffect, useRef } from 'react';

export default function Modal({ isOpen, onClose, title, children, size = 'default' }) {
  const backdropRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  const maxWidth = size === 'lg' ? '720px' : size === 'sm' ? '400px' : '560px';

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onClick={handleBackdropClick}
      id="modal-backdrop"
    >
      <div className="modal" style={{ maxWidth }} role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose} id="btn-modal-close" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
