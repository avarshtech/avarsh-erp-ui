import { useState, useEffect } from 'react';

/**
 * Detects whether the app is running as an installed PWA (standalone mode).
 * Listens for display-mode changes so the value updates if the user installs mid-session.
 *
 * @returns {boolean} True if running as installed PWA
 */
const useIsPwa = () => {
  const [isPwa, setIsPwa] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
  );

  useEffect(() => {
    const mql = window.matchMedia('(display-mode: standalone)');
    const handler = (e) => setIsPwa(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isPwa;
};

export default useIsPwa;
