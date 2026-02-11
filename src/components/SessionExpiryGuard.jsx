import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Typography, Button, Space, Progress } from 'antd';
import {
  ClockCircleOutlined,
  WarningOutlined,
  LoginOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getTokenExpirySeconds, logoutUser, isAuthenticated } from '../services/authService';

const { Text, Title } = Typography;

/**
 * SessionExpiryGuard
 *
 * Monitors JWT token expiry and:
 * 1. When token expires → forces re-login with a blocking modal
 * 2. 2 minutes before expiry → shows a warning banner with countdown timer
 *
 * Checks every 30 seconds. Warning threshold is 120 seconds (2 minutes).
 */
const WARNING_THRESHOLD_SECONDS = 120; // Show warning 2 minutes before expiry
const CHECK_INTERVAL_MS = 15000; // Check every 15 seconds

const SessionExpiryGuard = ({ children }) => {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [showExpired, setShowExpired] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);

  // Force logout and redirect
  const handleForceLogout = useCallback(() => {
    setShowWarning(false);
    setShowExpired(false);
    logoutUser();
    navigate('/login', { replace: true });
  }, [navigate]);

  // Start the 1-second countdown when warning is active
  const startCountdown = useCallback((seconds) => {
    if (countdownRef.current) clearInterval(countdownRef.current);

    setRemainingSeconds(seconds);
    countdownRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          // Token has expired
          setShowWarning(false);
          setShowExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Periodic check for token expiry
  const checkSession = useCallback(() => {
    if (!isAuthenticated()) {
      // Token already expired or removed
      setShowWarning(false);
      setShowExpired(true);
      return;
    }

    const secondsLeft = getTokenExpirySeconds();
    if (secondsLeft === null) return; // No exp claim, skip

    if (secondsLeft <= 0) {
      // Expired
      setShowWarning(false);
      setShowExpired(true);
    } else if (secondsLeft <= WARNING_THRESHOLD_SECONDS) {
      // About to expire — show warning with countdown
      if (!showWarning && !showExpired) {
        setShowWarning(true);
        startCountdown(secondsLeft);
      }
    }
  }, [showWarning, showExpired, startCountdown]);

  // Set up the periodic check
  useEffect(() => {
    // Initial check
    checkSession();

    timerRef.current = setInterval(checkSession, CHECK_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [checkSession]);

  // Format seconds as MM:SS
  const formatTime = (secs) => {
    if (secs === null || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage (out of WARNING_THRESHOLD_SECONDS)
  const progressPercent = remainingSeconds !== null
    ? Math.max(0, Math.round((remainingSeconds / WARNING_THRESHOLD_SECONDS) * 100))
    : 0;

  return (
    <>
      {children}

      {/* ── Warning Modal: Session about to expire ── */}
      <Modal
        open={showWarning}
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={null}
        centered
        width={440}
        styles={{
          body: { textAlign: 'center', padding: '32px 24px' },
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <ClockCircleOutlined
            style={{
              fontSize: 48,
              color: '#fa8c16',
              marginBottom: 16,
            }}
          />
          <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
            Session Expiring Soon
          </Title>
          <Text type="secondary">
            Your session will expire shortly. Please save your work.
          </Text>
        </div>

        {/* Countdown */}
        <div style={{ margin: '24px 0' }}>
          <Progress
            type="circle"
            percent={progressPercent}
            format={() => (
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'monospace' }}>
                  {formatTime(remainingSeconds)}
                </div>
                <div style={{ fontSize: 11, color: '#8c8c8c' }}>remaining</div>
              </div>
            )}
            size={120}
            strokeColor={remainingSeconds <= 30 ? '#ff4d4f' : remainingSeconds <= 60 ? '#fa8c16' : '#1677ff'}
            trailColor="var(--border-color, #f0f0f0)"
          />
        </div>

        <Text type="secondary" style={{ fontSize: 13 }}>
          You will be logged out when the timer reaches zero.
        </Text>

        <div style={{ marginTop: 24 }}>
          <Button
            type="primary"
            danger
            icon={<LoginOutlined />}
            onClick={handleForceLogout}
            size="large"
          >
            Logout Now
          </Button>
        </div>
      </Modal>

      {/* ── Expired Modal: Session has expired ── */}
      <Modal
        open={showExpired}
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={null}
        centered
        width={440}
        styles={{
          body: { textAlign: 'center', padding: '32px 24px' },
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <WarningOutlined
            style={{
              fontSize: 48,
              color: '#ff4d4f',
              marginBottom: 16,
            }}
          />
          <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
            Session Expired
          </Title>
          <Text type="secondary">
            Your session has expired due to inactivity. Please log in again to continue.
          </Text>
        </div>

        <div style={{ marginTop: 24 }}>
          <Button
            type="primary"
            icon={<LoginOutlined />}
            onClick={handleForceLogout}
            size="large"
            block
          >
            Go to Login
          </Button>
        </div>
      </Modal>
    </>
  );
};

export default SessionExpiryGuard;
