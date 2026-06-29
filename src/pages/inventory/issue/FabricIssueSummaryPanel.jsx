import { useMemo } from 'react';
import { Card, Descriptions, Divider, Typography } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { formatNumber } from '../../../utils/formatters';

const { Title, Text } = Typography;

const SummaryRow = ({ label, value, strong = true }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
    <Text type="secondary">{label}</Text>
    <Text strong={strong}>{value}</Text>
  </div>
);

const FabricIssueSummaryPanel = ({ cuttingPO, cuttingPOLine, selectedRolls = [], bomRequired = 0, uom = 'kg' }) => {
  const totalWeight = useMemo(
    () => selectedRolls.reduce((sum, r) => sum + (Number(r.weight) || 0), 0),
    [selectedRolls],
  );

  return (
    <Card style={{ marginBottom: 24, height: '100%' }}>
      <Title level={5} style={{ marginBottom: 16 }}>Cutting Order</Title>
      {cuttingPO ? (
        <>
          <Descriptions size="small" column={1}>
            <Descriptions.Item label="Cutting PO">{cuttingPO.cuttingPONumber}</Descriptions.Item>
            <Descriptions.Item label="Style">{cuttingPOLine?.style || cuttingPO.style}</Descriptions.Item>
            <Descriptions.Item label="Buyer">{cuttingPO.buyer}</Descriptions.Item>
            <Descriptions.Item label="Order Qty">{formatNumber(cuttingPO.orderQty)}</Descriptions.Item>
            <Descriptions.Item label="Production Unit">{cuttingPO.productionUnit || '—'}</Descriptions.Item>
            {cuttingPOLine && (
              <>
                <Descriptions.Item label="PO Line">{cuttingPOLine.orderNumber}</Descriptions.Item>
                <Descriptions.Item label="Fabric">{cuttingPOLine.fabric}</Descriptions.Item>
              </>
            )}
          </Descriptions>

          <Divider style={{ margin: '16px 0' }} />

          <Title level={5} style={{ marginBottom: 12 }}>Issue Summary</Title>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SummaryRow label="Rolls Selected" value={selectedRolls.length} />
            <SummaryRow label={`Total ${uom === 'kg' ? 'Weight' : 'Qty'}`} value={`${formatNumber(totalWeight, 1)} ${uom}`} />
            <SummaryRow label="BOM Required" value={`${formatNumber(bomRequired, 1)} ${uom}`} />
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)' }}>
          <InboxOutlined style={{ fontSize: 32, marginBottom: 8 }} />
          <br />
          <Text type="secondary">Select a Cutting PO</Text>
        </div>
      )}
    </Card>
  );
};

export default FabricIssueSummaryPanel;
