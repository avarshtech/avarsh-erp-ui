import { useState, useEffect } from 'react';

/**
 * Detects if the user is on a tablet device (iPad, Android tablet, etc.)
 * Uses a combination of viewport width and touch capability.
 * Tablet range: 600px–1194px width with touch support, or iPad user agent.
 */
const useIsTablet = () => {
  const [isTablet, setIsTablet] = useState(() => checkIsTablet());

  useEffect(() => {
    const handleResize = () => setIsTablet(checkIsTablet());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isTablet;
};

function checkIsTablet() {
  const w = window.innerWidth;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const ua = navigator.userAgent.toLowerCase();
  const isIPad = ua.includes('ipad') || (ua.includes('macintosh') && hasTouch);
  const isAndroidTablet = ua.includes('android') && !ua.includes('mobile');

  // iPad or Android tablet
  if (isIPad || isAndroidTablet) return true;

  // Touch device in tablet width range
  if (hasTouch && w >= 600 && w <= 1194) return true;

  return false;
}

export default useIsTablet;
