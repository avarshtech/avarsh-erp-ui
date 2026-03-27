import { useMemo } from 'react';
import { Card, Descriptions, Divider, Progress, Typography, Alert } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { formatNumber } from '../../../utils/formatters';

const { Title, Text } = Typography;

const FabricIssueSummaryPanel = ({ productionOrder, selectedRolls = [], bomRequired = 0 }) => {
  const summary = useMemo(() => {
    const totalWeight = selectedRolls.reduce((sum, r) => sum + (r.weight || 0), 0);
    const variance = totalWeight - bomRequired;
    const variancePct = bomRequired > 0 ? (variance / bomRequired) * 100 : 0;
    const issuedPct = bomRequired > 0 ? Math.min((totalWeight / bomRequired) * 100, 100) : 0;
    return { rollCount: selectedRolls.length, totalWeight, variance, variancePct, issuedPct };
  }, [selectedRolls, bomRequired]);

  const varianceColor = Math.abs(summary.variancePct) <= 5 ? 'var(--success-color)' : 'var(--error-color)';

  return (
    <Card style={{ marginBottom: 24, height: '100%' }}>
      <Title level={5} style={{ marginBottom: 16 }}>Production Order</Title>
      {productionOrder ? (
        <>
          <Descriptions size="small" column={1}>
            <Descriptions.Item label="PO #">{productionOrder.poNumber}</Descriptions.Item>
            <Descriptions.Item label="Style">{productionOrder.style}</Descriptions.Item>
            <Descriptions.Item label="Buyer">{productionOrder.buyer}</Descriptions.Item>
            <Descriptions.Item label="Order Qty">{formatNumber(productionOrder.orderQty)}</Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '16px 0' }} />

          <Title level={5} style={{ marginBottom: 12 }}>Issue Summary</Title>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Rolls Selected</Text>
              <Text strong>{summary.rollCount}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Total Weight</Text>
              <Text strong>{formatNumber(summary.totalWeight, 1)} kg</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">BOM Required</Text>
              <Text strong>{formatNumber(bomRequired, 1)} kg</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Variance</Text>
              <Text strong style={{ color: varianceColor }}>{summary.variance >= 0 ? '+' : ''}{formatNumber(summary.variance, 1)} kg</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Variance %</Text>
              <Text strong style={{ color: varianceColor }}>{summary.variancePct >= 0 ? '+' : ''}{formatNumber(summary.variancePct, 1)}%</Text>
            </div>
          </div>

          <Progress percent={Number(summary.issuedPct.toFixed(1))} status={summary.issuedPct >= 100 ? 'success' : 'active'} style={{ marginTop: 16 }} />

          {summary.variance > 0 && Math.abs(summary.variancePct) > 5 && (
            <Alert type="warning" showIcon message="Over-issue detected" description="Issued weight exceeds BOM + 5% tolerance" style={{ marginTop: 12 }} />
          )}
          {summary.totalWeight > 0 && summary.variance < 0 && Math.abs(summary.variancePct) > 5 && (
            <Alert type="info" showIcon message="Under-issue" description="Issued weight is below BOM requirement" style={{ marginTop: 12 }} />
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)' }}>
          <InboxOutlined style={{ fontSize: 32, marginBottom: 8 }} />
          <br />
          <Text type="secondary">Select a Production Order</Text>
        </div>
      )}
    </Card>
  );
};

export default FabricIssueSummaryPanel;
