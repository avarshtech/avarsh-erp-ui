import { useState, useEffect } from 'react';
import { Modal, Button, Space, Typography } from 'antd';
import { BellOutlined, CheckCircleOutlined } from '@ant-design/icons';
import usePushNotification from '../hooks/usePushNotification';

const { Title, Text } = Typography;

const PROMPT_DISMISS_KEY = 'avarsh-notif-prompt-dismissed';
const DISMISS_DURATION_DAYS = 7;

const NotificationPermissionPrompt = () => {
  const [visible, setVisible] = useState(false);
  const { isSupported, permission, isSubscribed, loading, requestPermission } = usePushNotification();

  useEffect(() => {
    // Don't show if: not supported, already granted/denied, already subscribed
    if (!isSupported || permission !== 'default' || isSubscribed) return;

    // Don't show if dismissed recently
    const dismissedAt = localStorage.getItem(PROMPT_DISMISS_KEY);
    if (dismissedAt) {
      const daysSince = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (daysSince < DISMISS_DURATION_DAYS) return;
    }

    // Show after a brief delay (let the app load first)
    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, [isSupported, permission, isSubscribed]);

  const handleEnable = async () => {
    await requestPermission();
    setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(PROMPT_DISMISS_KEY, Date.now().toString());
    setVisible(false);
  };

  return (
    <Modal
      open={visible}
      onCancel={handleDismiss}
      footer={null}
      centered
      width={420}
      closable={false}
    >
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: 'rgba(99, 102, 241, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <BellOutlined style={{ fontSize: 32, color: '#6366f1' }} />
        </div>

        <Title level={4} style={{ marginBottom: 8 }}>
          Stay Updated on Your ERP
        </Title>

        <Text type="secondary" style={{ fontSize: 14 }}>
          Get notified about:
        </Text>

        <div
          style={{
            textAlign: 'left',
            margin: '16px auto',
            maxWidth: 260,
            fontSize: 13,
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ padding: '4px 0' }}>
            <CheckCircleOutlined style={{ color: '#22c55e', marginRight: 8 }} />
            Order approvals & status changes
          </div>
          <div style={{ padding: '4px 0' }}>
            <CheckCircleOutlined style={{ color: '#22c55e', marginRight: 8 }} />
            PO approvals & rejections
          </div>
          <div style={{ padding: '4px 0' }}>
            <CheckCircleOutlined style={{ color: '#22c55e', marginRight: 8 }} />
            Items needing your attention
          </div>
        </div>

        <Space size={12} style={{ marginTop: 16 }}>
          <Button size="large" onClick={handleDismiss}>
            Not Now
          </Button>
          <Button type="primary" size="large" loading={loading} onClick={handleEnable}>
            Enable Notifications
          </Button>
        </Space>

        <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
          You can change this later in Profile → Notification Preferences
        </div>
      </div>
    </Modal>
  );
};

export default NotificationPermissionPrompt;
