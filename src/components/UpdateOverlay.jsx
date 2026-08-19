import { useState, useEffect } from 'react';
import { UPDATE_CANCELLED_EVENT } from '../utils/swRegistration';

/**
 * Full-screen overlay shown while the app is updating to a new version.
 * Listens for the 'pwa-updating' custom event dispatched by useServiceWorker
 * when the user clicks "Restart Now".
 */
const UpdateOverlay = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = () => setVisible(true);
    // The reload can be refused by an unsaved-changes prompt. This overlay
    // covers the whole screen and has no close control, so it must come back
    // down when that happens or the user is trapped behind it.
    const hide = () => setVisible(false);
    window.addEventListener('pwa-updating', show);
    window.addEventListener(UPDATE_CANCELLED_EVENT, hide);
    return () => {
      window.removeEventListener('pwa-updating', show);
      window.removeEventListener(UPDATE_CANCELLED_EVENT, hide);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="update-overlay">
      <div className="update-overlay-card">
        {/* Animated spinner ring */}
        <div className="update-spinner">
          <div className="update-spinner-ring" />
          <div className="update-spinner-ring update-spinner-ring-inner" />
          <svg
            className="update-spinner-icon"
            viewBox="0 0 24 24"
            width="28"
            height="28"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </div>

        <h2 className="update-overlay-title">Updating Avarsh ERP</h2>
        <p className="update-overlay-desc">
          Installing the latest version. This will only take a moment.
        </p>

        {/* Animated progress bar */}
        <div className="update-progress-track">
          <div className="update-progress-bar" />
        </div>

        <p className="update-overlay-hint">
          Please do not close the application
        </p>
      </div>
    </div>
  );
};

export default UpdateOverlay;
