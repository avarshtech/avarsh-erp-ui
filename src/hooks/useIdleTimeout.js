import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Tracks user activity and detects idle periods.
 *
 * Listens for mouse, keyboard, scroll, and touch events (throttled to 1 Hz)
 * and compares the last activity timestamp against a configurable timeout.
 *
 * @param {number} idleTimeoutMs   — total idle time (ms) before auto-logout
 * @param {number} warningSeconds  — seconds of warning countdown before logout
 * @returns {{ isIdle: boolean, isWarning: boolean, remainingSeconds: number, resetIdle: () => void }}
 */
const useIdleTimeout = (idleTimeoutMs, warningSeconds) => {
  const lastActivityRef = useRef(Date.now());
  const throttleRef = useRef(0);
  const [isWarning, setIsWarning] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(warningSeconds);

  const warningMs = warningSeconds * 1000;

  // Reset idle timer (called on user activity or "Stay Logged In" click)
  const resetIdle = useCallback(() => {
    lastActivityRef.current = Date.now();
    setIsWarning(false);
    setIsIdle(false);
    setRemainingSeconds(warningSeconds);
  }, [warningSeconds]);

  // Throttled activity handler — updates lastActivity at most once per second
  useEffect(() => {
    const handleActivity = () => {
      const now = Date.now();
      if (now - throttleRef.current < 1000) return;
      throttleRef.current = now;
      lastActivityRef.current = now;

      // If we're in warning state, any activity dismisses it
      setIsWarning((prev) => {
        if (prev) {
          setRemainingSeconds(warningSeconds);
          return false;
        }
        return prev;
      });
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => document.addEventListener(e, handleActivity, { passive: true }));
    return () => events.forEach((e) => document.removeEventListener(e, handleActivity));
  }, [warningSeconds]);

  // Check idle state every second
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= idleTimeoutMs) {
        // Fully idle — trigger logout
        setIsIdle(true);
        setIsWarning(false);
        setRemainingSeconds(0);
      } else if (elapsed >= idleTimeoutMs - warningMs) {
        // In warning zone
        const left = Math.ceil((idleTimeoutMs - elapsed) / 1000);
        setIsWarning(true);
        setRemainingSeconds(Math.max(0, left));
      } else {
        setIsWarning(false);
        setRemainingSeconds(warningSeconds);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [idleTimeoutMs, warningMs, warningSeconds]);

  return { isIdle, isWarning, remainingSeconds, resetIdle };
};

export default useIdleTimeout;
