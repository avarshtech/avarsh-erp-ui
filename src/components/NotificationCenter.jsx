import { useState, useEffect, useCallback, useMemo } from 'react';
import { Badge, Drawer, Popover, Segmented, Button, Space, Spin, Typography, App as AntdApp } from 'antd';
import { BellOutlined, CheckOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useResponsive from '../hooks/useResponsive';
import SwipeableNotificationItem from './SwipeableNotificationItem';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  deleteNotification,
  deleteAllRead,
} from '../services/core/notificationService';
import { getAccessToken } from '../services/auth/sessionStore';
import { USE_MOCK_EXPDOC_DATA } from '../services/expdoc/expDocEnv';
import {
  listExpDocNotifications,
  markExpDocNotificationRead,
  markExpDocNotificationUnread,
  deleteExpDocNotification,
  markAllExpDocNotificationsRead,
  deleteReadExpDocNotifications,
} from '../services/expdoc/expDocService';

const { Text } = Typography;

/*
 * Export Documentation raises its events into a mock store while its backend is
 * being built (PRD §23). They carry the API's own row shape and an id prefixed
 * `expdoc-`, which is how every handler below knows which service owns a row.
 * When the topics land on the server this whole seam is one flag away from gone.
 */
const isExpDoc = (row) => String(row?.id ?? '').startsWith('expdoc-');

const loadExpDoc = async () => {
  if (!USE_MOCK_EXPDOC_DATA) return [];
  try {
    const res = await listExpDocNotifications({ size: 50 });
    return res.content || [];
  } catch {
    return [];
  }
};

const NotificationCenter = () => {
  const navigate = useNavigate();
  const { isMobileOrTablet, isMobile } = useResponsive();
  const { message } = AntdApp.useApp();

  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('All');

  /*
   * One fetch, two services.
   *
   * Neither of these sets state: they return data, and every setState below happens
   * in a promise callback or a user event. An effect that calls a state-setting
   * function synchronously re-renders before it has anything new to show.
   */
  const fetchMerged = useCallback(async () => {
    let api = [];
    try {
      const data = await getNotifications(0, 50);
      api = data.content || data || [];
    } catch {
      // API not ready
    }
    const mock = await loadExpDoc();
    // One list, newest first, whichever service produced the row.
    return [...api, ...mock].sort(
      (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
    );
  }, []);

  const fetchCount = useCallback(async () => {
    if (!getAccessToken()) return 0; // Skip if logged out
    let apiCount = 0;
    try {
      const data = await getUnreadCount();
      apiCount = typeof data === 'number' ? data : data.count || 0;
    } catch {
      // Silently fail — API might not be ready yet
    }
    const mock = await loadExpDoc();
    return apiCount + mock.filter((n) => !n.isRead).length;
  }, []);

  useEffect(() => {
    let alive = true;
    fetchCount().then((n) => { if (alive) setUnreadCount(n); });
    return () => { alive = false; };
  }, [fetchCount]);

  // Listen for push notifications received while app is in foreground
  // (SW forwards them via postMessage instead of showing a system notification)
  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type === 'PUSH_RECEIVED') {
        // Increment count locally — no API call needed since the push IS the new notification
        setUnreadCount((prev) => prev + 1);
        if (open) fetchMerged().then(setNotifications);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, [open, fetchMerged]);

  // Fetch notifications when the panel opens. The spinner is raised by the click
  // that opened it, which is a user event rather than a render.
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    fetchMerged()
      .then((rows) => { if (alive) { setNotifications(rows); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, fetchMerged]);

  /** Opening the panel starts a load; closing it does not. */
  const toggleOpen = useCallback((next) => {
    if (next) setLoading(true);
    setOpen(next);
  }, []);

  const filteredNotifications = useMemo(() => {
    if (filter === 'Unread') return notifications.filter((n) => !n.isRead);
    if (filter === 'Approvals') return notifications.filter((n) => n.type?.includes('REQUEST'));
    return notifications;
  }, [notifications, filter]);

  const handleMarkAsRead = useCallback(async (id) => {
    try {
      await (isExpDoc({ id }) ? markExpDocNotificationRead(id) : markAsRead(id));
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      message.error('Failed to mark as read');
    }
  }, [message]);

  const handleMarkAsUnread = useCallback(async (id) => {
    try {
      await (isExpDoc({ id }) ? markExpDocNotificationUnread(id) : markAsUnread(id));
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: false } : n)));
      setUnreadCount((prev) => prev + 1);
    } catch {
      message.error('Failed to mark as unread');
    }
  }, [message]);

  const handleDelete = useCallback(async (id) => {
    try {
      const wasUnread = notifications.find((n) => n.id === id && !n.isRead);
      await (isExpDoc({ id }) ? deleteExpDocNotification(id) : deleteNotification(id));
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      message.error('Failed to delete notification');
    }
  }, [notifications, message]);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await Promise.all([markAllAsRead(), markAllExpDocNotificationsRead()]);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      message.error('Failed to mark all as read');
    }
  }, [message]);

  const handleClearRead = useCallback(async () => {
    try {
      await Promise.all([deleteAllRead(), deleteReadExpDocNotifications()]);
      setNotifications((prev) => prev.filter((n) => !n.isRead));
    } catch {
      message.error('Failed to clear notifications');
    }
  }, [message]);

  const handleClick = useCallback((notification) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
      setOpen(false);
    }
  }, [navigate, handleMarkAsRead]);

  const handleAction = useCallback((notification, actionKey) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }
    if (notification.actionUrl) {
      const separator = notification.actionUrl.includes('?') ? '&' : '?';
      navigate(`${notification.actionUrl}${separator}action=${actionKey}`);
      setOpen(false);
    }
  }, [navigate, handleMarkAsRead]);

  const panelContent = (
    <div style={{ width: isMobileOrTablet ? '100%' : 400, maxHeight: isMobileOrTablet ? '100%' : 520 }}>
      {/* Header */}
      <div className="notification-panel-header">
        <span className="notification-panel-header__title">
          Notifications {unreadCount > 0 && <Badge count={unreadCount} size="small" style={{ marginLeft: 6 }} />}
        </span>
        <Space size={4}>
          <Button type="text" size="small" icon={<CheckOutlined />} onClick={handleMarkAllAsRead} disabled={unreadCount === 0}>
            Mark all read
          </Button>
        </Space>
      </div>

      {/* Filter tabs */}
      <div style={{ padding: '8px 16px' }}>
        <Segmented
          className="notification-panel-tabs"
          value={filter}
          onChange={setFilter}
          options={['All', 'Unread', 'Approvals']}
          block
          size="small"
        />
      </div>

      {/* Notification list */}
      <div style={{ overflowY: 'auto', maxHeight: isMobileOrTablet ? 'calc(100vh - 180px)' : 360 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="notification-panel-empty">
            <BellOutlined />
            <Text type="secondary">No {filter === 'All' ? '' : filter.toLowerCase()} notifications</Text>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <SwipeableNotificationItem
              key={notification.id}
              notification={notification}
              onDelete={handleDelete}
              onMarkRead={handleMarkAsRead}
              onMarkUnread={handleMarkAsUnread}
              onClick={handleClick}
              onAction={handleAction}
              isMobileOrTablet={isMobileOrTablet}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="notification-panel-footer">
          <Text type="secondary" style={{ fontSize: 12 }}>
            {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
          </Text>
          <Button type="link" size="small" icon={<DeleteOutlined />} onClick={handleClearRead} danger>
            Clear read
          </Button>
        </div>
      )}
    </div>
  );

  const bellButton = (
    <button className="toolbar-icon-btn" onClick={() => toggleOpen(!open)}>
      <Badge
        count={unreadCount}
        size="small"
        offset={[-2, 2]}
        style={{
          background: 'var(--notification-badge-bg)',
          boxShadow: 'var(--notification-badge-shadow)',
          fontSize: 10,
          minWidth: 18,
          height: 18,
        }}
      >
        <BellOutlined style={{ fontSize: 20 }} />
      </Badge>
    </button>
  );

  // Mobile/Tablet: Drawer
  if (isMobileOrTablet) {
    return (
      <>
        {bellButton}
        <Drawer
          open={open}
          onClose={() => setOpen(false)}
          placement="right"
          width={isMobile ? '100%' : 400}
          closable
          title={null}
          styles={{ body: { padding: 0 } }}
        >
          {panelContent}
        </Drawer>
      </>
    );
  }

  // Desktop: Popover
  return (
    <Popover
      open={open}
      onOpenChange={toggleOpen}
      content={panelContent}
      trigger="click"
      placement="bottomRight"
      arrow={false}
      styles={{ root: { padding: 0 }, container: { padding: 0, borderRadius: 12, overflow: 'hidden' } }}
    >
      {bellButton}
    </Popover>
  );
};

export default NotificationCenter;
