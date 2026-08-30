import { memo } from 'react';
import { Avatar, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import {
  getModuleConfig,
  SEVERITY_ACCENT,
  buildEntityRoute,
} from '../../utils/liveFeedModuleConfig';

const { Text } = Typography;

const initials = (name) => {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const second = parts[1]?.[0] || '';
  return (first + second).toUpperCase() || name[0]?.toUpperCase() || '?';
};

const avatarColorFor = (seed) => {
  const palette = ['#6366f1', '#0891b2', '#db2777', '#16a34a', '#d97706', '#7c3aed', '#0d9488', '#dc2626'];
  let h = 0;
  const s = String(seed || 'x');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
};

const LiveActivityFeedItem = ({ event, density = 'compact' }) => {
  const navigate = useNavigate();
  const cfg = getModuleConfig(event.module);
  const Icon = cfg.icon;
  const accent = SEVERITY_ACCENT[event.severity] || SEVERITY_ACCENT.INFO;
  const route = buildEntityRoute(event.module, event.entityId);

  const handleClick = () => {
    if (route) navigate(route);
  };

  const timestamp = event.timestamp ? dayjs(event.timestamp) : null;
  const isToday = timestamp && timestamp.isSame(dayjs(), 'day');
  const displayTime = timestamp
    ? (isToday ? timestamp.format('HH:mm:ss') : timestamp.format('DD MMM HH:mm'))
    : '';

  const actor = event.actorUsername || 'system';

  return (
    <div
      className={`live-feed-item live-feed-item--${density}`}
      onClick={handleClick}
      role={route ? 'button' : undefined}
      tabIndex={route ? 0 : undefined}
      onKeyDown={(e) => {
        if (route && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleClick();
        }
      }}
      style={{
        borderLeftColor: cfg.color,
        backgroundColor: cfg.bg,
        cursor: route ? 'pointer' : 'default',
      }}
    >
      <div className="live-feed-item__accent" style={{ backgroundColor: accent }} />
      <div className="live-feed-item__icon" style={{ color: cfg.color }}>
        <Icon />
      </div>
      <div className="live-feed-item__body">
        <div className="live-feed-item__line">
          <Avatar
            size={density === 'expanded' ? 28 : 22}
            style={{ backgroundColor: avatarColorFor(actor), flexShrink: 0 }}
          >
            {initials(actor)}
          </Avatar>
          <Text strong className="live-feed-item__actor">{actor}</Text>
          <Text className="live-feed-item__action">{(event.action || '').toLowerCase()}</Text>
          {event.entityLabel && (
            <Tag color={cfg.color} style={{ margin: 0 }}>{event.entityLabel}</Tag>
          )}
        </div>
        {density === 'expanded' && event.summary && (
          <Text type="secondary" className="live-feed-item__summary">{event.summary}</Text>
        )}
      </div>
      <span className="live-feed-item__time">{displayTime}</span>
    </div>
  );
};

export default memo(LiveActivityFeedItem);
