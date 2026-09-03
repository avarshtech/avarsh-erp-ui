import { useRef, useCallback } from 'react';
import { Typography } from 'antd';
import {
  ShoppingOutlined,
  RollbackOutlined,
  CloseCircleOutlined,
  AuditOutlined,
  FileProtectOutlined,
  DollarOutlined,
  ToolOutlined,
  InboxOutlined,
  NotificationOutlined,
  DeleteOutlined,
  CheckOutlined,
  ContainerOutlined,
  FileDoneOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  NumberOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

const NOTIFICATION_TYPE_CONFIG = {
  ORDER_STATUS: { icon: <ShoppingOutlined />, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
  ORDER_REFER_BACK_REQUEST: { icon: <RollbackOutlined />, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  ORDER_CANCEL_REQUEST: { icon: <CloseCircleOutlined />, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  PO_APPROVAL_REQUEST: { icon: <AuditOutlined />, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  PO_UPDATE: { icon: <FileProtectOutlined />, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
  COSTING_APPROVAL_REQUEST: { icon: <DollarOutlined />, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
  COSTING_UPDATE: { icon: <DollarOutlined />, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
  BOM_UPDATE: { icon: <ToolOutlined />, color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.1)' },
  GRN_UPDATE: { icon: <InboxOutlined />, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
  // Export Documentation (PRD §23). Without these the rows fall back to
  // GENERAL_ALERT — a legible icon, but every export event would look alike.
  EXPDOC_PL_SUBMITTED: { icon: <ContainerOutlined />, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  EXPDOC_PL_APPROVED: { icon: <FileDoneOutlined />, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
  EXPDOC_PL_SENT_BACK: { icon: <RollbackOutlined />, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  EXPDOC_PL_CANCELLED: { icon: <CloseCircleOutlined />, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  EXPDOC_PL_REVISED: { icon: <RollbackOutlined />, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
  EXPDOC_DOC_RELEASED: { icon: <FileDoneOutlined />, color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.1)' },
  EXPDOC_INVOICE_SUBMITTED: { icon: <DollarOutlined />, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  EXPDOC_INVOICE_APPROVED: { icon: <DollarOutlined />, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
  EXPDOC_INVOICE_SENT_BACK: { icon: <RollbackOutlined />, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  EXPDOC_SOURCE_STALE: { icon: <WarningOutlined />, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  EXPDOC_SERIES_EXHAUSTED: { icon: <NumberOutlined />, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  EXPDOC_ETD_APPROACHING: { icon: <ClockCircleOutlined />, color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)' },
  GENERAL_ALERT: { icon: <NotificationOutlined />, color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)' },
};

const ACTION_CONFIGS = {
  PO_APPROVAL_REQUEST: [
    { key: 'approve', label: 'Approve', className: 'notification-action-chip--approve' },
    { key: 'refer_back', label: 'Refer Back', className: 'notification-action-chip--refer-back' },
  ],
  ORDER_REFER_BACK_REQUEST: [
    { key: 'approve', label: 'Approve', className: 'notification-action-chip--approve' },
    { key: 'reject', label: 'Reject', className: 'notification-action-chip--reject' },
  ],
  ORDER_CANCEL_REQUEST: [
    { key: 'approve', label: 'Approve', className: 'notification-action-chip--approve' },
    { key: 'reject', label: 'Reject', className: 'notification-action-chip--reject' },
  ],
  COSTING_APPROVAL_REQUEST: [
    { key: 'approve', label: 'Approve', className: 'notification-action-chip--approve' },
    { key: 'revise', label: 'Revise', className: 'notification-action-chip--revise' },
  ],
};

const SWIPE_THRESHOLD = 0.35;
const VELOCITY_THRESHOLD = 0.5;

const SwipeableNotificationItem = ({
  notification,
  onDelete,
  onMarkRead,
  onMarkUnread,
  onClick,
  onAction,
  isMobileOrTablet,
}) => {
  const itemRef = useRef(null);
  const startX = useRef(0);
  const startTime = useRef(0);
  const currentX = useRef(0);
  const isDragging = useRef(false);

  const typeConfig = NOTIFICATION_TYPE_CONFIG[notification.type] || NOTIFICATION_TYPE_CONFIG.GENERAL_ALERT;
  const actionButtons = ACTION_CONFIGS[notification.type];
  const isUnread = !notification.isRead;

  const handleTouchStart = useCallback((e) => {
    if (!isMobileOrTablet) return;
    startX.current = e.touches[0].clientX;
    startTime.current = Date.now();
    currentX.current = 0;
    isDragging.current = false;
  }, [isMobileOrTablet]);

  const handleTouchMove = useCallback((e) => {
    if (!isMobileOrTablet) return;
    const deltaX = e.touches[0].clientX - startX.current;
    if (Math.abs(deltaX) > 10) {
      isDragging.current = true;
    }
    if (!isDragging.current) return;

    currentX.current = deltaX;
    const el = itemRef.current;
    if (el) {
      el.style.transform = `translateX(${deltaX}px)`;
      el.style.transition = 'none';
    }
  }, [isMobileOrTablet]);

  const handleTouchEnd = useCallback(() => {
    if (!isMobileOrTablet || !isDragging.current) return;

    const el = itemRef.current;
    if (!el) return;

    const width = el.offsetWidth;
    const ratio = Math.abs(currentX.current) / width;
    const elapsed = Date.now() - startTime.current;
    const velocity = Math.abs(currentX.current) / elapsed;
    const triggered = ratio > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD;

    if (triggered && currentX.current < 0) {
      // Swipe left — delete
      el.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
      el.style.transform = `translateX(-${width}px)`;
      el.style.opacity = '0';
      setTimeout(() => onDelete?.(notification.id), 300);
    } else if (triggered && currentX.current > 0) {
      // Swipe right — toggle read
      el.style.transition = 'transform 0.3s ease';
      el.style.transform = 'translateX(0)';
      if (isUnread) {
        onMarkRead?.(notification.id);
      } else {
        onMarkUnread?.(notification.id);
      }
    } else {
      // Snap back
      el.style.transition = 'transform 0.2s ease';
      el.style.transform = 'translateX(0)';
    }

    isDragging.current = false;
  }, [isMobileOrTablet, notification.id, isUnread, onDelete, onMarkRead, onMarkUnread]);

  const handleClick = useCallback((e) => {
    if (isDragging.current) return;
    onClick?.(notification);
  }, [notification, onClick]);

  const handleActionClick = useCallback((e, actionKey) => {
    e.stopPropagation();
    onAction?.(notification, actionKey);
  }, [notification, onAction]);

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Swipe reveal backgrounds */}
      {isMobileOrTablet && (
        <>
          <div
            className="notification-swipe-bg--read"
            style={{ position: 'absolute', inset: 0, zIndex: 0 }}
          >
            <CheckOutlined /> {isUnread ? 'Read' : 'Unread'}
          </div>
          <div
            className="notification-swipe-bg--delete"
            style={{ position: 'absolute', inset: 0, zIndex: 0 }}
          >
            <DeleteOutlined /> Delete
          </div>
        </>
      )}

      {/* Notification content */}
      <div
        ref={itemRef}
        className={`notification-item ${isUnread ? 'notification-item--unread' : ''}`}
        style={{ position: 'relative', zIndex: 1, background: 'var(--card-bg)' }}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="notification-item__header">
          {/* Type icon */}
          <div
            className="notification-item__icon"
            style={{ background: typeConfig.bg, color: typeConfig.color }}
          >
            {typeConfig.icon}
          </div>

          {/* Content */}
          <div className="notification-item__content">
            <div className="notification-item__title">{notification.title}</div>
            <div className="notification-item__body">{notification.body}</div>
            <div className="notification-item__time">
              {dayjs(notification.createdAt).fromNow()}
            </div>
          </div>

          {/* Unread dot */}
          {isUnread && <div className="notification-item__dot" />}
        </div>

        {/* Action chips for approval-type notifications */}
        {actionButtons && (
          <div className="notification-item__actions">
            {actionButtons.map((action) => (
              <span
                key={action.key}
                className={`notification-action-chip ${action.className}`}
                onClick={(e) => handleActionClick(e, action.key)}
              >
                {action.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SwipeableNotificationItem;
