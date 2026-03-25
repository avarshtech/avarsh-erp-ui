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
} from '../services/notificationService';
import { getAccessToken } from '../services/sessionStore';

const { Text } = Typography;

const NotificationCenter = () => {
  const navigate = useNavigate();
  const { isMobileOrTablet, isMobile } = useResponsive();
  const { message } = AntdApp.useApp();

  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('All');

  // Fetch unread count periodically (only when authenticated)
  const fetchCount = useCallback(async () => {
    if (!getAccessToken()) return; // Skip if logged out
    try {
      const data = await getUnreadCount();
      setUnreadCount(typeof data === 'number' ? data : data.count || 0);
    } catch {
      // Silently fail — API might not be ready yet
    }
  }, []);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // Listen for push notifications received while app is in foreground
  // (SW forwards them via postMessage instead of showing a system notification)
  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type === 'PUSH_RECEIVED') {
        fetchCount();
        if (open) loadNotifications();
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, [fetchCount, open]);

  // Fetch notifications when panel opens
  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await getNotifications(0, 50);
      setNotifications(data.content || data || []);
    } catch {
      // API not ready
    } finally {
      setLoading(false);
    }
  };

  const filteredNotifications = useMemo(() => {
    if (filter === 'Unread') return notifications.filter((n) => !n.isRead);
    if (filter === 'Approvals') return notifications.filter((n) => n.type?.includes('REQUEST'));
    return notifications;
  }, [notifications, filter]);

  const handleMarkAsRead = useCallback(async (id) => {
    try {
      await markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      message.error('Failed to mark as read');
    }
  }, [message]);

  const handleMarkAsUnread = useCallback(async (id) => {
    try {
      await markAsUnread(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: false } : n)));
      setUnreadCount((prev) => prev + 1);
    } catch {
      message.error('Failed to mark as unread');
    }
  }, [message]);

  const handleDelete = useCallback(async (id) => {
    try {
      const wasUnread = notifications.find((n) => n.id === id && !n.isRead);
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      message.error('Failed to delete notification');
    }
  }, [notifications, message]);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      message.error('Failed to mark all as read');
    }
  }, [message]);

  const handleClearRead = useCallback(async () => {
    try {
      await deleteAllRead();
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
    <button className="toolbar-icon-btn" onClick={() => setOpen(!open)}>
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
      onOpenChange={setOpen}
      content={panelContent}
      trigger="click"
      placement="bottomRight"
      arrow={false}
      overlayStyle={{ padding: 0 }}
      overlayInnerStyle={{ padding: 0, borderRadius: 12, overflow: 'hidden' }}
    >
      {bellButton}
    </Popover>
  );
};

export default NotificationCenter;
