import { memo, useMemo } from 'react';
import { Card, Divider, Alert, Button, Input, Space, Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { ADJUSTMENT_STATUS } from '../../../utils/inventoryConstants';
import { formatNumber } from '../../../utils/formatters';

const { Text, Title } = Typography;
const { TextArea } = Input;

const VARIANCE_THRESHOLD = 10;

const AdjustmentApprovalPanel = memo(function AdjustmentApprovalPanel({
  items = [],
  status,
  approver,
  approvalRemarks,
  onApprove,
  onReject,
  readOnly = false,
}) {
  const summary = useMemo(() => {
    const withVariance = items.filter((i) => {
      const v = (i.physicalCount ?? 0) - (i.systemQty ?? 0);
      return v !== 0;
    });
    const netVariance = items.reduce((s, i) => s + ((i.physicalCount ?? 0) - (i.systemQty ?? 0)), 0);
    const maxPct = items.reduce((max, i) => {
      const sys = i.systemQty || 0;
      const pct = sys === 0 ? (i.physicalCount ? 100 : 0) : Math.abs(((i.physicalCount ?? 0) - sys) / sys) * 100;
      return Math.max(max, pct);
    }, 0);
    return { total: items.length, withVariance: withVariance.length, netVariance, maxPct };
  }, [items]);

  const isPending = status === ADJUSTMENT_STATUS.PENDING_APPROVAL;
  const isDecided = status === ADJUSTMENT_STATUS.APPROVED || status === ADJUSTMENT_STATUS.REJECTED;

  return (
    <Card title="Approval" size="small" style={{ height: '100%' }}>
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">Total Items</Text>
          <Text strong>{summary.total}</Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">Items with Variance</Text>
          <Text strong>{summary.withVariance}</Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">Net Variance</Text>
          <Text strong style={{ color: summary.netVariance < 0 ? 'var(--error-color)' : summary.netVariance > 0 ? 'var(--success-color)' : undefined }}>
            {formatNumber(summary.netVariance, 2)}
          </Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">Max Variance %</Text>
          <Text strong style={{ color: summary.maxPct > VARIANCE_THRESHOLD ? 'var(--error-color)' : 'var(--success-color)' }}>
            {formatNumber(summary.maxPct, 1)}%
          </Text>
        </div>
      </Space>

      <Divider style={{ margin: '16px 0' }} />

      {summary.maxPct > VARIANCE_THRESHOLD && (
        <Alert type="warning" showIcon message="Requires supervisor approval" description={`Maximum variance ${formatNumber(summary.maxPct, 1)}% exceeds ${VARIANCE_THRESHOLD}% threshold.`} style={{ marginBottom: 16 }} />
      )}

      {isPending && !readOnly && (
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <TextArea rows={3} placeholder="Approval remarks..." id="approval-remarks" />
          <Space>
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={onApprove}>Approve</Button>
            <Button danger icon={<CloseCircleOutlined />} onClick={onReject}>Reject</Button>
          </Space>
        </Space>
      )}

      {isDecided && (
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <div><Text type="secondary">Decided by:</Text> <Text strong>{approver || '\u2014'}</Text></div>
          <div><Text type="secondary">Remarks:</Text> <Text>{approvalRemarks || '\u2014'}</Text></div>
        </Space>
      )}
    </Card>
  );
});

export default AdjustmentApprovalPanel;
