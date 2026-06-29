import { useMemo } from 'react';
import { Drawer, Descriptions, Table, Divider, Space, Tag, Typography, Row, Col } from 'antd';
import {
  AppstoreOutlined,
  CalendarOutlined,
  BgColorsOutlined,
  ColumnWidthOutlined,
  BarcodeOutlined,
} from '@ant-design/icons';
import { ActionButton } from '../../../components/buttons';
import { formatNumber, formatDate } from '../../../utils/formatters';

const { Text, Title } = Typography;

const CATEGORY_COLORS = {
  Buttons: 'blue',
  Zippers: 'purple',
  Labels: 'cyan',
  Thread: 'orange',
  Elastic: 'green',
  Interlining: 'magenta',
  Packaging: 'volcano',
};

const variantColumns = (uom) => [
  {
    title: 'Size',
    dataIndex: 'size',
    key: 'size',
    width: 120,
    align: 'center',
    render: (v) => <Space size={4}><ColumnWidthOutlined style={{ color: 'var(--text-secondary)' }} />{v}</Space>,
  },
  {
    title: 'Colour',
    dataIndex: 'color',
    key: 'color',
    width: 160,
    align: 'center',
    render: (v) => <Space size={4}><BgColorsOutlined style={{ color: 'var(--text-secondary)' }} />{v}</Space>,
  },
  {
    title: 'Qty',
    dataIndex: 'qty',
    key: 'qty',
    width: 140,
    align: 'center',
    render: (v) => (
      <span style={{ fontWeight: 600 }}>
        {formatNumber(v, 0)} <Text type="secondary" style={{ fontSize: 12 }}>{uom || ''}</Text>
      </span>
    ),
  },
];

// Flatten `sizeColorMatrix` into variant rows — only used when the record
// predates the service-layer `variants[]` shape (legacy mock passthrough).
const buildVariantsFromMatrix = (matrix) => {
  if (!matrix?.quantities) return [];
  return Object.entries(matrix.quantities).map(([key, qty], idx) => {
    const lastDash = key.lastIndexOf('-');
    const color = lastDash > 0 ? key.slice(0, lastDash) : key;
    const size = lastDash > 0 ? key.slice(lastDash + 1) : '';
    return { id: idx, color, size, qty };
  });
};

const AccessoriesStockViewDrawer = ({ open, onClose, record }) => {
  const variants = useMemo(() => {
    if (Array.isArray(record?.variants) && record.variants.length > 0) {
      return record.variants.map((v, idx) => ({ id: v.variantId ?? idx, ...v }));
    }
    return buildVariantsFromMatrix(record?.sizeColorMatrix);
  }, [record]);

  if (!record) return null;

  return (
    <Drawer
      title={null}
      open={open}
      onClose={onClose}
      width={720}
      closable
      styles={{
        body: { padding: 0, display: 'flex', flexDirection: 'column', overflowX: 'hidden' },
      }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <ActionButton action="close" text="Close" onClick={onClose} />
        </div>
      }
    >
      {/* ── HERO HEADER ─────────────────────────────────────────────── */}
      <div
        style={{
          padding: '24px 28px 20px',
          borderBottom: '2px solid var(--border-color, #f0f0f0)',
          borderLeft: `4px solid var(--primary-color)`,
        }}
      >
        <Space align="center" size={10} style={{ marginBottom: 8 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 6,
              background: 'var(--bg-secondary, rgba(99, 102, 241, 0.08))',
              border: '1px solid var(--border-color, rgba(99, 102, 241, 0.25))',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: 13.5,
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: 'var(--text-primary)',
              lineHeight: 1.3,
            }}
          >
            <BarcodeOutlined style={{ color: 'var(--text-secondary)', fontSize: 14 }} />
            {record.itemCode}
          </span>
          {record.category && (
            <Tag color={CATEGORY_COLORS[record.category] || 'default'} style={{ margin: 0 }}>
              {record.category}
            </Tag>
          )}
        </Space>
        <Title level={4} style={{ margin: 0, letterSpacing: '-0.01em' }}>
          {record.description}
        </Title>

        <Row gutter={24} style={{ marginTop: 16 }}>
          <Col xs={12} sm={8}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Qty
            </Text>
            <Text strong style={{ fontSize: 22, letterSpacing: '-0.02em' }}>
              {formatNumber(record.totalQty, 2)}{' '}
              <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>{record.uom || ''}</Text>
            </Text>
          </Col>
          <Col xs={12} sm={8}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Unit Cost
            </Text>
            <Text strong style={{ fontSize: 22, letterSpacing: '-0.02em' }}>
              ₹ {formatNumber(record.unitCost, 2)}
            </Text>
          </Col>
          <Col xs={24} sm={8}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Value (Excl. GST)
            </Text>
            <Text strong style={{ fontSize: 22, color: 'var(--warning-color)', letterSpacing: '-0.02em' }}>
              ₹ {formatNumber(record.poLineValue || 0, 2)}
            </Text>
          </Col>
        </Row>
      </div>

      {/* ── BODY ────────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 28px 28px', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <Descriptions
          size="small"
          column={2}
          bordered
          title={<Space><AppstoreOutlined style={{ color: 'var(--primary-color)' }} /><Text strong>Item Details</Text></Space>}
          labelStyle={{ width: 150, background: 'var(--bg-secondary)' }}
        >
          <Descriptions.Item label="Category">
            <Tag color={CATEGORY_COLORS[record.category] || 'default'}>{record.category}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Style">{record.style || '-'}</Descriptions.Item>
          <Descriptions.Item label="Order No">{record.orderRef || '-'}</Descriptions.Item>
          <Descriptions.Item label="GRN #">{record.grnNumber || '-'}</Descriptions.Item>
          <Descriptions.Item label="Supplier">{record.supplier || '-'}</Descriptions.Item>
          <Descriptions.Item label="UOM">{record.uom || '-'}</Descriptions.Item>
          <Descriptions.Item label="Last Received" span={2}>
            <Space size={6}>
              <CalendarOutlined style={{ color: 'var(--text-secondary)' }} />
              {formatDate(record.lastReceived)}
            </Space>
          </Descriptions.Item>
        </Descriptions>

        <Divider style={{ margin: '24px 0 16px' }} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <Space size={8}>
            <AppstoreOutlined style={{ color: 'var(--primary-color)' }} />
            <Text strong>Variants (Size × Colour)</Text>
          </Space>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 4,
              padding: '3px 10px',
              borderRadius: 999,
              background: 'var(--bg-secondary, #f5f5f7)',
              border: '1px solid var(--border-color, #e5e7eb)',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            <span style={{ fontSize: 14 }}>{variants.length}</span>
            <Text type="secondary" style={{ fontSize: 11.5, fontWeight: 500 }}>
              {variants.length === 1 ? 'variant' : 'variants'}
            </Text>
          </span>
        </div>

        {variants.length > 0 ? (
          <Table
            rowKey="id"
            columns={variantColumns(record.uom)}
            dataSource={variants}
            pagination={false}
            size="small"
          />
        ) : (
          <Text type="secondary">No variant breakdown available.</Text>
        )}
      </div>
    </Drawer>
  );
};

export default AccessoriesStockViewDrawer;
