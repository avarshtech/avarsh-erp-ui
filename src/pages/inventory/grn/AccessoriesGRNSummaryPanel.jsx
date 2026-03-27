import { useMemo } from 'react';
import { Card, Descriptions, Divider, Typography } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { formatNumber } from '../../../utils/formatters';

const { Title, Text } = Typography;

const AccessoriesGRNSummaryPanel = ({ selectedPO, items = [], cartons = [] }) => {
  const summary = useMemo(() => {
    const totalReceivingQty = items.reduce((sum, item) => sum + (item.receivingQty || 0), 0);
    const totalAmount = items.reduce((sum, item) => sum + (item.receivingQty || 0) * (item.rate || 0), 0);
    return { cartonCount: cartons.length, totalItems: items.length, totalReceivingQty, totalAmount };
  }, [items, cartons]);

  return (
    <Card style={{ marginBottom: 24, height: '100%' }}>
      <Title level={5} style={{ marginBottom: 16 }}>PO Information</Title>
      {selectedPO ? (
        <>
          <Descriptions size="small" column={1}>
            <Descriptions.Item label="PO Number">{selectedPO.poNumber}</Descriptions.Item>
            <Descriptions.Item label="Supplier">{selectedPO.supplier}</Descriptions.Item>
            <Descriptions.Item label="PO Date">{selectedPO.poDate}</Descriptions.Item>
            <Descriptions.Item label="Line Items">{selectedPO.items?.length || 0}</Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '16px 0' }} />

          <Title level={5} style={{ marginBottom: 12 }}>Receipt Summary</Title>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Carton Count</Text>
              <Text strong>{formatNumber(summary.cartonCount)}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Total Items</Text>
              <Text strong>{formatNumber(summary.totalItems)}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Total Receiving Qty</Text>
              <Text strong>{formatNumber(summary.totalReceivingQty)}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Total Amount</Text>
              <Text strong style={{ color: 'var(--success-color)' }}>{formatNumber(summary.totalAmount, 2)}</Text>
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

export default AccessoriesGRNSummaryPanel;
