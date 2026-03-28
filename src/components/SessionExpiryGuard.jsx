import { useCallback } from 'react';
import { Modal, Typography, Button, Space, Progress, App } from 'antd';
import {
  ClockCircleOutlined,
  WarningOutlined,
  LoginOutlined,
  ReloadOutlined,
  CoffeeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { logoutUser } from '../services/authService';
import { useSession } from '../context/SessionContext';
import { getCurrentUser } from '../utils/permissions';

const { Text, Title } = Typography;

const SessionExpiryGuard = ({ children }) => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const {
    remainingSeconds,
    isExpired,
    showWarningModal,
    refreshing,
    dismissWarningModal,
    handleRefreshSession,
    resetSession,
    WARNING_THRESHOLD_SECONDS,
    // Idle timeout
    isIdleWarning,
    isIdleExpired,
    idleRemainingSeconds,
    resetIdle,
  } = useSession();

  const handleForceLogout = useCallback(async () => {
    resetSession();
    await logoutUser();
    navigate('/login', { replace: true });
  }, [navigate, resetSession]);

  const handleRefresh = useCallback(async () => {
    const success = await handleRefreshSession();
    if (success) {
      message.success('Session renewed successfully');
    } else {
      message.error('Session could not be renewed. Please log in again.');
    }
  }, [handleRefreshSession]);

  const formatTime = (secs) => {
    if (secs === null || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = remainingSeconds !== null
    ? Math.max(0, Math.round((remainingSeconds / WARNING_THRESHOLD_SECONDS) * 100))
    : 0;

  return (
    <>
      {children}

      {/* Warning Modal: Session about to expire */}
      <Modal
        open={showWarningModal}
        closable={true}
        onCancel={dismissWarningModal}
        maskClosable={true}
        keyboard={true}
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
            Your session will expire shortly. Please save your work or refresh your session.
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
            railColor="var(--border-color, #f0f0f0)"
          />
        </div>

        <Text type="secondary" style={{ fontSize: 13 }}>
          You can close this dialog to continue working. The timer will appear in the header.
        </Text>

        <div style={{ marginTop: 24 }}>
          <Space size="middle">
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={refreshing}
              size="large"
            >
              Refresh Session
            </Button>
            <Button
              danger
              icon={<LoginOutlined />}
              onClick={handleForceLogout}
              size="large"
            >
              Logout Now
            </Button>
          </Space>
        </div>
      </Modal>

      {/* Expired Modal: Session has expired (token) */}
      <Modal
        open={isExpired && !isIdleExpired}
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
            Your session has expired. Please log in again to continue.
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

      {/* Idle Warning Modal: User inactive */}
      <Modal
        open={isIdleWarning && !isIdleExpired}
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
          <CoffeeOutlined
            style={{
              fontSize: 48,
              color: '#fa8c16',
              marginBottom: 16,
            }}
          />
          <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
            Session Inactive
          </Title>
          <Text type="secondary">
            You&apos;ve been inactive for a while. Your session will end automatically to protect your data.
          </Text>
        </div>

        {/* Countdown */}
        <div style={{ margin: '24px 0' }}>
          <Progress
            type="circle"
            percent={Math.max(0, Math.round((idleRemainingSeconds / (getCurrentUser()?.idleWarningSeconds || 120)) * 100))}
            format={() => (
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'monospace' }}>
                  {formatTime(idleRemainingSeconds)}
                </div>
                <div style={{ fontSize: 11, color: '#8c8c8c' }}>before logout</div>
              </div>
            )}
            size={120}
            strokeColor={idleRemainingSeconds <= 30 ? '#ff4d4f' : idleRemainingSeconds <= 60 ? '#fa8c16' : '#1677ff'}
            railColor="var(--border-color, #f0f0f0)"
          />
        </div>

        <div style={{ marginTop: 24 }}>
          <Space size="middle">
            <Button
              type="primary"
              size="large"
              onClick={resetIdle}
            >
              Stay Logged In
            </Button>
            <Button
              danger
              icon={<LoginOutlined />}
              onClick={handleForceLogout}
              size="large"
            >
              Logout Now
            </Button>
          </Space>
        </div>
      </Modal>

      {/* Idle Expired Modal: Auto-logout */}
      <Modal
        open={isIdleExpired}
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
            Session Timed Out
          </Title>
          <Text type="secondary">
            You have been logged out due to inactivity. Please log in again to continue.
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
