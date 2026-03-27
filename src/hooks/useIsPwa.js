import { useState, useEffect } from 'react';

/**
 * Detects whether the app is running as an installed PWA (standalone mode)
 * and whether Window Controls Overlay (WCO) is active.
 *
 * WCO mode = desktop standalone PWA with no browser toolbar,
 * only OS window controls (close/minimize/maximize) overlaid on content.
 *
 * @returns {{ isPwa: boolean, isWco: boolean }}
 */
const useIsPwa = () => {
  const [isPwa, setIsPwa] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: window-controls-overlay)').matches
      || navigator.standalone === true,
  );

  const [isWco, setIsWco] = useState(() => {
    // Check both CSS media query and JS API
    const mediaMatch = window.matchMedia('(display-mode: window-controls-overlay)').matches;
    const apiAvailable = 'windowControlsOverlay' in navigator && navigator.windowControlsOverlay.visible;
    return mediaMatch || apiAvailable;
  });

  useEffect(() => {
    // Listen for standalone display mode changes
    const standaloneMql = window.matchMedia('(display-mode: standalone)');
    const wcoMql = window.matchMedia('(display-mode: window-controls-overlay)');

    const updatePwa = () => {
      setIsPwa(standaloneMql.matches || wcoMql.matches || navigator.standalone === true);
    };

    const updateWco = () => {
      const mediaMatch = wcoMql.matches;
      const apiAvailable = 'windowControlsOverlay' in navigator && navigator.windowControlsOverlay.visible;
      setIsWco(mediaMatch || apiAvailable);
    };

    standaloneMql.addEventListener('change', updatePwa);
    wcoMql.addEventListener('change', (e) => {
      updatePwa();
      updateWco();
    });

    // Also listen to the WCO JS API for geometry changes
    if ('windowControlsOverlay' in navigator) {
      navigator.windowControlsOverlay.addEventListener('geometrychange', updateWco);
    }

    return () => {
      standaloneMql.removeEventListener('change', updatePwa);
      wcoMql.removeEventListener('change', updateWco);
      if ('windowControlsOverlay' in navigator) {
        navigator.windowControlsOverlay.removeEventListener('geometrychange', updateWco);
      }
    };
  }, []);

  return { isPwa, isWco };
};

export default useIsPwa;
