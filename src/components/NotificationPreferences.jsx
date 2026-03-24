import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Switch, Typography, Spin, Space, message, Divider } from 'antd';
import {
  BellOutlined,
  ShoppingOutlined,
  FileProtectOutlined,
  AuditOutlined,
  DollarOutlined,
  ToolOutlined,
  InboxOutlined,
  NotificationOutlined,
} from '@ant-design/icons';
import { hasPermission } from '../utils/permissions';
import { getPreferences, updatePreferences } from '../services/notificationService';
import usePushNotification from '../hooks/usePushNotification';

const { Title, Text } = Typography;

const NOTIFICATION_TYPES = [
  {
    key: 'orderStatus',
    label: 'Order Updates',
    description: 'Status changes, submissions, approvals',
    icon: <ShoppingOutlined />,
    color: '#6366f1',
    module: 'orders',
  },
  {
    key: 'poUpdates',
    label: 'Purchase Order Updates',
    description: 'PO approvals, rejections, refer backs',
    icon: <FileProtectOutlined />,
    color: '#22c55e',
    module: 'purchase-orders',
  },
  {
    key: 'approvalRequests',
    label: 'Approval Requests',
    description: 'Items pending your approval',
    icon: <AuditOutlined />,
    color: '#3b82f6',
    module: null, // Show if user has any approval permissions
  },
  {
    key: 'costingUpdates',
    label: 'Costing Updates',
    description: 'Cost sheet status changes',
    icon: <DollarOutlined />,
    color: '#8b5cf6',
    module: 'costing',
  },
  {
    key: 'bomUpdates',
    label: 'BOM Updates',
    description: 'Bill of materials changes',
    icon: <ToolOutlined />,
    color: '#14b8a6',
    module: 'bom',
  },
  {
    key: 'grnUpdates',
    label: 'GRN Updates',
    description: 'Goods receipt notifications',
    icon: <InboxOutlined />,
    color: '#06b6d4',
    module: 'grn',
  },
  {
    key: 'generalAlerts',
    label: 'General Alerts',
    description: 'System announcements and reminders',
    icon: <NotificationOutlined />,
    color: '#64748b',
    module: null, // Always shown
  },
];

const NotificationPreferences = () => {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef(null);
  const { isSupported, permission, isSubscribed, requestPermission, unsubscribe, loading: pushLoading } = usePushNotification();

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const data = await getPreferences();
      setPreferences(data);
    } catch {
      // Use defaults if API not ready
      setPreferences({
        pushEnabled: true,
        orderStatus: true,
        poUpdates: true,
        approvalRequests: true,
        costingUpdates: true,
        bomUpdates: true,
        grnUpdates: true,
        generalAlerts: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = useCallback(async (updatedPrefs) => {
    // Debounce save
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await updatePreferences(updatedPrefs);
      } catch {
        message.error('Failed to save preferences');
      } finally {
        setSaving(false);
      }
    }, 500);
  }, []);

  const handleToggle = useCallback((key, value) => {
    setPreferences((prev) => {
      const updated = { ...prev, [key]: value };
      savePreferences(updated);
      return updated;
    });
  }, [savePreferences]);

  const handlePushToggle = useCallback(async (enabled) => {
    if (enabled) {
      if (permission === 'denied') {
        message.warning('Notifications are blocked by your browser. Please enable them in browser settings.');
        return;
      }
      const granted = await requestPermission();
      if (!granted) return;
    } else {
      await unsubscribe();
    }
    handleToggle('pushEnabled', enabled);
  }, [permission, requestPermission, unsubscribe, handleToggle]);

  // Filter notification types based on user's role permissions
  const visibleTypes = NOTIFICATION_TYPES.filter((type) => {
    if (!type.module) return true; // Always show general alerts and approval requests
    return hasPermission(type.module, 'view');
  });

  if (loading) {
    return (
      <Card
        title={<span><BellOutlined style={{ marginRight: 8 }} />Notification Preferences</span>}
        style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spin />
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={
        <span>
          <BellOutlined style={{ marginRight: 8 }} />
          Notification Preferences
          {saving && (
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 12, fontWeight: 400 }}>
              Saving...
            </Text>
          )}
        </span>
      }
      style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
    >
      {/* Master push toggle */}
      {isSupported && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
            <div>
              <Text strong style={{ fontSize: 15, color: 'var(--text-primary)' }}>
                Push Notifications
              </Text>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                Receive push notifications on this device
              </div>
            </div>
            <Switch
              checked={preferences?.pushEnabled && isSubscribed}
              onChange={handlePushToggle}
              loading={pushLoading}
              checkedChildren="On"
              unCheckedChildren="Off"
            />
          </div>
          <Divider style={{ margin: '16px 0' }} />
        </>
      )}

      {/* Per-type toggles */}
      <Text strong style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Notification Categories
      </Text>

      <div style={{ marginTop: 12 }}>
        {visibleTypes.map((type, index) => (
          <div
            key={type.key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 0',
              borderBottom: index < visibleTypes.length - 1 ? '1px solid var(--border-color)' : 'none',
            }}
          >
            <Space size={12}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: `${type.color}15`,
                  color: type.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                }}
              >
                {type.icon}
              </div>
              <div>
                <Text strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                  {type.label}
                </Text>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{type.description}</div>
              </div>
            </Space>
            <Switch
              checked={preferences?.[type.key] ?? true}
              onChange={(val) => handleToggle(type.key, val)}
              size="small"
            />
          </div>
        ))}
      </div>
    </Card>
  );
};

export default NotificationPreferences;
