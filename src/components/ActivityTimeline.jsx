import React, { useState, useCallback } from 'react';
import { Timeline, Input, Button, Empty } from 'antd';
import { SettingOutlined, UserOutlined, SendOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { TextArea } = Input;

const TYPE_CONFIG = {
  system: { color: 'blue', icon: <SettingOutlined /> },
  user: { color: 'green', icon: <UserOutlined /> },
};

const DefaultActivityContent = React.memo(({ activity }) => (
  <div>
    <div style={{ fontSize: 13 }}>
      <strong>{activity.user}</strong>{' '}
      <span style={{ color: 'var(--text-secondary)' }}>{activity.action}</span>
    </div>
    {activity.details && (
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
        {activity.details}
      </div>
    )}
    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
      {dayjs(activity.timestamp).format('DD MMM YYYY, hh:mm A')}
    </div>
  </div>
));

DefaultActivityContent.displayName = 'DefaultActivityContent';

const ActivityTimeline = React.memo(({
  activities = [],
  maxHeight = 320,
  renderComment,
  onAddNote,
  canAddNote = false,
  noteLoading = false,
  emptyText = 'No activity yet',
  className,
  style,
  ...restProps
}) => {
  const [noteText, setNoteText] = useState('');

  const handleAddNote = useCallback(() => {
    if (!noteText.trim() || !onAddNote) return;
    onAddNote(noteText.trim());
    setNoteText('');
  }, [noteText, onAddNote]);

  const timelineItems = activities.map((activity) => {
    const config = TYPE_CONFIG[activity.type] || TYPE_CONFIG.system;
    return {
      key: activity.id,
      color: config.color,
      dot: config.icon,
      children: renderComment
        ? renderComment(activity)
        : <DefaultActivityContent activity={activity} />,
    };
  });

  return (
    <div className={className} style={style} {...restProps}>
      {/* Add note section */}
      {canAddNote && onAddNote && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <TextArea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note..."
            autoSize={{ minRows: 1, maxRows: 3 }}
            style={{ flex: 1 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleAddNote();
              }
            }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleAddNote}
            loading={noteLoading}
            disabled={!noteText.trim()}
          >
            Send
          </Button>
        </div>
      )}

      {/* Timeline */}
      <div style={{ maxHeight, overflowY: 'auto' }}>
        {activities.length > 0 ? (
          <Timeline items={timelineItems} />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={emptyText}
          />
        )}
      </div>
    </div>
  );
});

ActivityTimeline.displayName = 'ActivityTimeline';

export default ActivityTimeline;
