import { useState } from 'react';
import { App, Card, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import { InfoCircleOutlined, MessageOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useLiveActivityFeed } from '../../context/LiveActivityFeedContext';

dayjs.extend(relativeTime);

const { Text, Title } = Typography;

const LiveActivityFeedEnableCard = () => {
  const { message } = App.useApp();
  const { settings, setEnabled, status, isAdmin } = useLiveActivityFeed();
  const [saving, setSaving] = useState(false);

  if (!isAdmin) return null;

  const enabled = settings?.enabled !== false;
  const updatedBy = settings?.updatedBy || '—';
  const updatedAt = settings?.updatedAt ? dayjs(settings.updatedAt) : null;

  const handleToggle = async (next) => {
    setSaving(true);
    try {
      await setEnabled(next);
      message.success(`Live activity feed ${next ? 'enabled' : 'disabled'}`);
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to update live feed setting');
    } finally {
      setSaving(false);
    }
  };

  const statusTag = enabled
    ? <Tag color={status === 'connected' ? 'green' : 'blue'}>{status === 'connected' ? 'Live' : 'Enabled'}</Tag>
    : <Tag color="default">Disabled</Tag>;

  return (
    <Card
      size="small"
      className="live-feed-enable-card"
      styles={{ body: { padding: 16 } }}
    >
      <div className="live-feed-enable-card__row">
        <div className="live-feed-enable-card__left">
          <div className="live-feed-enable-card__icon">
            <MessageOutlined />
          </div>
          <div>
            <Title level={5} style={{ margin: 0 }}>
              Live Activity Feed {statusTag}
            </Title>
            <Text type="secondary">
              Broadcasts user actions (PO, GRN, QC, Stock, Orders, Logins…) to admin screens in real time.
            </Text>
            <div style={{ marginTop: 6 }}>
              <Space size={4} wrap>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Last changed: <Text strong>{updatedBy}</Text>
                  {updatedAt ? ` · ${updatedAt.fromNow()}` : ''}
                </Text>
                <Tooltip title="When disabled, no new events are captured or broadcast. Existing data stays in the table until archival.">
                  <InfoCircleOutlined style={{ color: 'var(--text-muted, #888)' }} />
                </Tooltip>
              </Space>
            </div>
          </div>
        </div>
        <Switch
          checked={enabled}
          loading={saving}
          onChange={handleToggle}
          checkedChildren="ON"
          unCheckedChildren="OFF"
        />
      </div>
    </Card>
  );
};

export default LiveActivityFeedEnableCard;
