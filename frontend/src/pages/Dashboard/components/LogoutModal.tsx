import React, { useState, useEffect } from 'react';

interface LogoutModalProps {
  isOpen: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

const LogoutModal: React.FC<LogoutModalProps> = ({ isOpen, onConfirm, onCancel }) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  const handleConfirm = async () => {
    setIsLoggingOut(true);
    setFadeOut(false);

    // Show "Logging out..." for 1.2s
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Start fade-out animation
    setFadeOut(true);

    // Wait for fade animation (400ms)
    await new Promise(resolve => setTimeout(resolve, 400));

    // Actually log out
    await onConfirm();
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
      
      if (scrollY) {
        const savedScrollY = parseInt(scrollY.replace('px', '') || '0') * -1;
        window.scrollTo(0, savedScrollY);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={`logout-confirmation-overlay ${fadeOut ? 'fade-out' : ''}`}
      onClick={onCancel}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
      }}
    >
      <div
        className={`logout-confirmation-modal ${fadeOut ? 'fade-out' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {!isLoggingOut ? (
          <>
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to logout? Your session data will be cleared.</p>
            <div className="logout-confirmation-buttons">
              <button onClick={onCancel} className="logout-cancel-btn">
                Cancel
              </button>
              <button onClick={handleConfirm} className="logout-confirm-btn">
                Logout
              </button>
            </div>
          </>
        ) : (
          <div className="logging-out">
            <div className="spinner"></div>
            <p>Logging out...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogoutModal;