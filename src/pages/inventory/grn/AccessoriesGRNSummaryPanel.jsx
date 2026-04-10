import { useMemo } from 'react';
import { Card, Descriptions, Divider, Typography, Statistic, Row, Col } from 'antd';
import {
  InboxOutlined,
  UserOutlined,
  DollarOutlined,
  AppstoreOutlined,
  GoldOutlined,
  ColumnHeightOutlined,
} from '@ant-design/icons';
import { formatNumber } from '../../../utils/formatters';

const { Title, Text } = Typography;

const miniStatStyle = {
  background: 'var(--bg-secondary)',
  borderRadius: 'var(--radius-md)',
  padding: '12px 14px',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  height: '100%',
};

const MiniStat = ({ icon, label, value, valueColor }) => (
  <div style={miniStatStyle}>
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-tertiary, rgba(99, 102, 241, 0.1))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: valueColor || 'var(--primary-color)',
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
    <div style={{ minWidth: 0, flex: 1 }}>
      <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </Text>
      <Text strong style={{ fontSize: 16, color: valueColor }}>{value}</Text>
    </div>
  </div>
);

const AccessoriesGRNSummaryPanel = ({ selectedPO, items = [], cartons = [], createdBy }) => {
  const summary = useMemo(() => {
    const totalReceivingQty = items.reduce((sum, item) => sum + (Number(item.receivingQty) || 0), 0);
    const totalAmount = items.reduce((sum, item) => sum + (Number(item.receivingQty) || 0) * (Number(item.rate) || 0), 0);
    const totalCartonQty = cartons.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);
    return {
      cartonCount: cartons.length,
      totalItems: items.length,
      totalReceivingQty,
      totalAmount,
      totalCartonQty,
    };
  }, [items, cartons]);

  return (
    <Card style={{ marginBottom: 24, height: '100%', display: 'flex', flexDirection: 'column' }} styles={{ body: { display: 'flex', flexDirection: 'column', flex: 1 } }}>
      <Title level={5} style={{ marginBottom: 16, marginTop: 0 }}>PO Information</Title>
      {selectedPO ? (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <Descriptions size="small" column={1} colon={false} labelStyle={{ color: 'var(--text-secondary)', fontSize: 12 }} contentStyle={{ fontSize: 13, fontWeight: 500 }}>
            <Descriptions.Item label="PO Number">{selectedPO.poNumber}</Descriptions.Item>
            <Descriptions.Item label="Supplier">{selectedPO.supplier}</Descriptions.Item>
            <Descriptions.Item label="Buyer">{selectedPO.buyerName || '—'}</Descriptions.Item>
            <Descriptions.Item label="Style">{selectedPO.styleNumber || '—'}</Descriptions.Item>
            <Descriptions.Item label="PO Date">{selectedPO.poDate}</Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '16px 0 12px' }} />

          <Title level={5} style={{ marginBottom: 12, marginTop: 0 }}>Receipt Summary</Title>

          {/* Hero callout */}
          <Card
            size="small"
            style={{
              background: 'var(--bg-secondary)',
              borderColor: 'var(--primary-color)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 12,
            }}
            styles={{ body: { padding: '14px 16px' } }}
          >
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 12 }}>Total Receiving Qty</Text>}
              value={formatNumber(summary.totalReceivingQty)}
              prefix={<ColumnHeightOutlined />}
              valueStyle={{ color: 'var(--primary-color)', fontSize: 26, fontWeight: 700 }}
            />
          </Card>

          {/* 2x2 mini-stat grid */}
          <Row gutter={[10, 10]} style={{ flex: 1 }}>
            <Col span={12}>
              <MiniStat icon={<AppstoreOutlined />} label="Items" value={formatNumber(summary.totalItems)} />
            </Col>
            <Col span={12}>
              <MiniStat icon={<InboxOutlined />} label="Cartons" value={formatNumber(summary.cartonCount)} />
            </Col>
            <Col span={12}>
              <MiniStat icon={<GoldOutlined />} label="Carton Qty" value={formatNumber(summary.totalCartonQty)} />
            </Col>
            <Col span={12}>
              <MiniStat
                icon={<DollarOutlined />}
                label="Receipt Value"
                value={formatNumber(summary.totalAmount, 2)}
                valueColor="var(--success-color)"
              />
            </Col>
          </Row>

          {createdBy && (
            <>
              <Divider style={{ margin: '16px 0 12px' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--primary-color)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                  }}
                >
                  <UserOutlined />
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Created by</Text>
                  <Text strong style={{ fontSize: 13 }}>{createdBy}</Text>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <InboxOutlined style={{ fontSize: 48, marginBottom: 12, color: 'var(--text-tertiary, var(--text-secondary))' }} />
          <Text type="secondary" style={{ fontSize: 14 }}>Select a Purchase Order</Text>
          <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>to begin receipt entry</Text>
        </div>
      )}
    </Card>
  );
};

export default AccessoriesGRNSummaryPanel;
