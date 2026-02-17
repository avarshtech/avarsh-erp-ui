import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getTokenExpirySeconds, isAuthenticated, refreshSession as refreshSessionService } from '../services/authService';

const SessionContext = createContext(null);

const WARNING_THRESHOLD_SECONDS = 120;
const CHECK_INTERVAL_MS = 15000;

export const SessionProvider = ({ children }) => {
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [isWarning, setIsWarning] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showHeaderTimer, setShowHeaderTimer] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Use refs so the periodic checkSession never needs to re-create itself
  const isWarningRef = useRef(false);
  const isExpiredRef = useRef(false);
  const countdownRef = useRef(null);
  const timerRef = useRef(null);
  // Tracks whether a proactive silent refresh has been attempted for this token cycle
  const proactiveRefreshAttemptedRef = useRef(false);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // Reset all warning/countdown/expiry state (used after successful refresh)
  const resetWarningState = useCallback(() => {
    clearCountdown();
    isWarningRef.current = false;
    isExpiredRef.current = false;
    proactiveRefreshAttemptedRef.current = false;
    setIsWarning(false);
    setIsExpired(false);
    setShowWarningModal(false);
    setShowHeaderTimer(false);
    setRemainingSeconds(null);
  }, [clearCountdown]);

  const markExpired = useCallback(() => {
    clearCountdown();
    isWarningRef.current = false;
    isExpiredRef.current = true;
    setIsWarning(false);
    setIsExpired(true);
    setShowWarningModal(false);
    setShowHeaderTimer(false);
    setRemainingSeconds(0);
  }, [clearCountdown]);

  const startCountdown = useCallback((seconds) => {
    clearCountdown();
    setRemainingSeconds(seconds);

    countdownRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 1) {
          markExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearCountdown, markExpired]);

  // Periodic check — attempts proactive silent refresh before showing warning modal
  const checkSession = useCallback(() => {
    if (isExpiredRef.current) return;

    if (!isAuthenticated()) {
      markExpired();
      return;
    }

    const secondsLeft = getTokenExpirySeconds();
    if (secondsLeft === null) return;

    if (secondsLeft <= 0) {
      markExpired();
    } else if (secondsLeft <= WARNING_THRESHOLD_SECONDS && !proactiveRefreshAttemptedRef.current) {
      // Attempt a proactive silent refresh in the background.
      // If it succeeds, the user never sees the warning modal.
      proactiveRefreshAttemptedRef.current = true;

      refreshSessionService().then((success) => {
        if (success) {
          // Token refreshed silently — reset everything
          resetWarningState();
        } else {
          // Proactive refresh failed — fall through to warning modal
          if (!isWarningRef.current) {
            const currentSecondsLeft = getTokenExpirySeconds();
            if (currentSecondsLeft !== null && currentSecondsLeft > 0) {
              isWarningRef.current = true;
              setIsWarning(true);
              setShowWarningModal(true);
              startCountdown(currentSecondsLeft);
            } else {
              markExpired();
            }
          }
        }
      });
    }
  }, [markExpired, startCountdown, resetWarningState]);

  // Single effect — stable deps, never tears down the countdown
  useEffect(() => {
    checkSession();
    timerRef.current = setInterval(checkSession, CHECK_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      clearCountdown();
    };
  }, [checkSession, clearCountdown]);

  const dismissWarningModal = useCallback(() => {
    setShowWarningModal(false);
    setShowHeaderTimer(true);
  }, []);

  const handleRefreshSession = useCallback(async () => {
    setRefreshing(true);
    try {
      const success = await refreshSessionService();
      if (success) {
        resetWarningState();
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setRefreshing(false);
    }
  }, [resetWarningState]);

  const resetSession = useCallback(() => {
    resetWarningState();
  }, [resetWarningState]);

  const value = useMemo(() => ({
    remainingSeconds,
    isWarning,
    isExpired,
    showWarningModal,
    showHeaderTimer,
    refreshing,
    dismissWarningModal,
    handleRefreshSession,
    resetSession,
    WARNING_THRESHOLD_SECONDS,
  }), [
    remainingSeconds,
    isWarning,
    isExpired,
    showWarningModal,
    showHeaderTimer,
    refreshing,
    dismissWarningModal,
    handleRefreshSession,
    resetSession,
  ]);

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

export default SessionContext;
