import { useMemo } from 'react';
import { Card, Descriptions, Divider, Typography } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { formatNumber } from '../../../utils/formatters';

const { Title, Text } = Typography;

const FabricGRNSummaryPanel = ({ selectedPO, rolls = [], status }) => {
  const summary = useMemo(() => {
    const totalRolls = rolls.length;
    const totalWeight = rolls.reduce((sum, r) => sum + (r.weight || 0), 0);
    const shadeLots = new Set(rolls.map((r) => r.shadeLot).filter(Boolean));
    return { totalRolls, totalWeight, shadeLotCount: shadeLots.size };
  }, [rolls]);

  return (
    <Card style={{ marginBottom: 24, height: '100%' }}>
      <Title level={5} style={{ marginBottom: 16 }}>PO Information</Title>
      {selectedPO ? (
        <>
          <Descriptions size="small" column={1}>
            <Descriptions.Item label="PO Number">{selectedPO.poNumber}</Descriptions.Item>
            <Descriptions.Item label="Supplier">{selectedPO.supplier}</Descriptions.Item>
            <Descriptions.Item label="PO Date">{selectedPO.poDate}</Descriptions.Item>
            <Descriptions.Item label="Items">{selectedPO.items?.length || 0}</Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '16px 0' }} />

          <Title level={5} style={{ marginBottom: 12 }}>Receipt Summary</Title>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Total Rolls</Text>
              <Text strong>{formatNumber(summary.totalRolls)}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Total Weight</Text>
              <Text strong>{formatNumber(summary.totalWeight, 1)} kg</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Shade Lots</Text>
              <Text strong>{formatNumber(summary.shadeLotCount)}</Text>
            </div>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)' }}>
          <InboxOutlined style={{ fontSize: 32, marginBottom: 8 }} />
          <br />
          <Text type="secondary">Select a Purchase Order</Text>
        </div>
      )}
    </Card>
  );
};

export default FabricGRNSummaryPanel;
