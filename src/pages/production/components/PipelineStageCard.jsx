import { Card, Typography, Tag, Button, Space, Skeleton, Grid } from 'antd';
import { ArrowRightOutlined, PlusOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * One stage of the Cutting → Sewing → Finishing pipeline on the Production hub.
 * Shows status counts and quick create / list actions for the PO type.
 */
const PipelineStageCard = ({ meta, icon, stats, loading, onView, onCreate, showConnector }) => {
  const screens = Grid.useBreakpoint();
  const s = stats || { total: 0, draft: 0, pending: 0, approved: 0 };

  return (
    <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 220 }}>
      <Card
        style={{ borderRadius: 'var(--radius-lg)', borderTop: `3px solid ${meta.accent}`, flex: 1, overflow: 'hidden' }}
        styles={{ body: { padding: 18 } }}
      >
        <Space align="center" style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 22, color: meta.accent }}>{icon}</span>
          <div>
            <Text strong style={{ fontSize: 15 }}>{meta.label}</Text>
            <div><Text type="secondary" style={{ fontSize: 12 }}>{meta.stage} stage</Text></div>
          </div>
        </Space>

        {loading ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <Text style={{ fontSize: 30, fontWeight: 700, color: meta.accent }}>{s.total}</Text>
              <Text type="secondary">total POs</Text>
            </div>
            <Space size={6} wrap style={{ marginBottom: 16 }}>
              <Tag>{s.draft} Draft</Tag>
              <Tag color="processing">{s.pending} Pending</Tag>
              <Tag color="green">{s.approved} Approved</Tag>
            </Space>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Button type="link" style={{ padding: 0 }} onClick={onView}>View all</Button>
              <Button type="primary" size="small" icon={<PlusOutlined />} style={{ background: meta.accent, borderColor: meta.accent }} onClick={onCreate}>
                New
              </Button>
            </Space>
          </>
        )}
      </Card>
      {showConnector && screens.lg && (
        <ArrowRightOutlined style={{ fontSize: 22, color: 'var(--text-secondary)', margin: '0 10px', flexShrink: 0 }} />
      )}
    </div>
  );
};

export default PipelineStageCard;
