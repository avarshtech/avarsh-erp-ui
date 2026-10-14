import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { endSession, getTokenExpirySeconds, isAuthenticated, refreshSession as refreshSessionService } from '../services/auth/authService';
import { clearAll, hasSessionActiveFlag, onLogoutElsewhere } from '../services/auth/sessionStore';
import { getCurrentUser } from '../utils/permissions';
import useIdleTimeout from '../hooks/useIdleTimeout';
import useIsPwa from '../hooks/useIsPwa';

const SessionContext = createContext(null);

const WARNING_THRESHOLD_SECONDS = 120;
const CHECK_INTERVAL_MS = 15000;
// PWA: refresh token every 10 minutes to keep session alive indefinitely
const PWA_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

export const SessionProvider = ({ children }) => {
  const { isPwa } = useIsPwa();

  // ── Idle timeout (reads config from JWT claims cached in currentUser) ──
  // In PWA mode, idle timeout is disabled — use a very large value so the hook never fires
  const user = getCurrentUser();
  const idleTimeoutMs = isPwa ? Number.MAX_SAFE_INTEGER : (user?.idleTimeoutMinutes || 30) * 60 * 1000;
  const idleWarningSeconds = isPwa ? 0 : (user?.idleWarningSeconds || 120);
  const {
    isIdle: isIdleExpired,
    isWarning: isIdleWarning,
    remainingSeconds: idleRemainingSeconds,
    resetIdle,
  } = useIdleTimeout(idleTimeoutMs, idleWarningSeconds);

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

  // A token that ran out while the refresh cookie may still be good (a laptop that slept): one
  // silent refresh is tried before the session is declared expired. 'pending' while it runs.
  const expiryRefreshRef = useRef(null);

  // Periodic check — attempts proactive silent refresh before showing warning modal
  const checkSession = useCallback(() => {
    if (isExpiredRef.current) return;

    const secondsLeft = getTokenExpirySeconds();
    if (!isAuthenticated() || (secondsLeft !== null && secondsLeft <= 0)) {
      if (expiryRefreshRef.current === 'pending') return;
      // No session flag means the session was ended on purpose (logout, idle timeout): nothing to renew
      if (expiryRefreshRef.current !== 'failed' && hasSessionActiveFlag()) {
        expiryRefreshRef.current = 'pending';
        refreshSessionService().then((success) => {
          expiryRefreshRef.current = success ? null : 'failed';
          if (success) resetWarningState();
          else markExpired();
        });
        return;
      }
      markExpired();
      return;
    }

    if (secondsLeft === null) return;

    if (secondsLeft <= WARNING_THRESHOLD_SECONDS && !proactiveRefreshAttemptedRef.current) {
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
    // A tab that comes back (the laptop woke, the user switched back) is checked at once
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkSession();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisible);
      clearCountdown();
    };
  }, [checkSession, clearCountdown]);

  // The idle timeout really ends the session when it says so: the refresh token is revoked and
  // nothing of the session stays in the browser, so F5 or a new tab lands on the login page. The
  // 'Session Timed Out' dialog stays up until the user leaves it.
  const idleEndedRef = useRef(false);
  useEffect(() => {
    if (!isIdleExpired || idleEndedRef.current) return;
    idleEndedRef.current = true;
    endSession();
  }, [isIdleExpired]);

  // A logout in another tab of this browser ends the session in this one too
  const navigate = useNavigate();
  useEffect(() => onLogoutElsewhere(() => {
    clearAll();
    window.dispatchEvent(new Event('authChange'));
    navigate('/login', { replace: true });
  }), [navigate]);

  // ── PWA: Proactive periodic refresh to keep session alive (no idle logout) ──
  useEffect(() => {
    if (!isPwa) return;

    const refreshInterval = setInterval(() => {
      // Silently refresh the token in the background to extend the session
      refreshSessionService().then((success) => {
        if (success) resetWarningState();
      });
    }, PWA_REFRESH_INTERVAL_MS);

    return () => clearInterval(refreshInterval);
  }, [isPwa, resetWarningState]);

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
    // Idle timeout state
    isIdleWarning,
    isIdleExpired,
    idleRemainingSeconds,
    resetIdle,
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
    isIdleWarning,
    isIdleExpired,
    idleRemainingSeconds,
    resetIdle,
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
