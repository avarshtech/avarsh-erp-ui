import { useId, useMemo } from 'react';
import { Drawer, Table, Space, Tag, Typography, Row, Col } from 'antd';
import {
  AppstoreOutlined,
  CalendarOutlined,
  BgColorsOutlined,
  ColumnWidthOutlined,
} from '@ant-design/icons';
import { ActionButton } from '../../../components/buttons';
import DetailCard from '../../../components/DetailCard';
import { formatNumber, formatDate } from '../../../utils/formatters';
import { StockDrawerHero, Stat } from './StockDrawerLayout';
import { FIELD_SPAN, SECTION_HEADING } from './stockDrawerStyles';

const { Text } = Typography;

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
    title: 'Variant',
    key: 'variantIdentity',
    width: 200,
    ellipsis: true,
    render: (_, v) => v.variantName || v.variantCode || '—',
  },
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
  const titleId = useId();
  const variants = useMemo(() => {
    if (Array.isArray(record?.variants) && record.variants.length > 0) {
      return record.variants.map((v, idx) => ({ id: v.variantId ?? idx, ...v }));
    }
    return buildVariantsFromMatrix(record?.sizeColorMatrix);
  }, [record]);

  if (!record) return null;

  // Opening balance rows carry their batch number in `grnNumber` — the register's column is
  // headed "GRN # / Batch" for the same reason. Here the row's source is known, so name it.
  const fromOpening = record.sourceType === 'OPENING_BALANCE';
  // `description` is the item's derived "Category - Sub-Category", identical for every
  // variant of one item. The variant is what is actually on the rack.
  const heading = record.variantName || record.description || 'Accessory';

  return (
    <Drawer
      title={null}
      open={open}
      onClose={onClose}
      size={720}
      // No header: Close sits in the footer, and a second X above it was one button too many.
      closable={false}
      aria-labelledby={titleId}
      styles={{
        body: { padding: 0, display: 'flex', flexDirection: 'column', overflowX: 'hidden' },
      }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <ActionButton action="close" text="Close" onClick={onClose} />
        </div>
      }
    >
      <StockDrawerHero
        code={record.variantCode}
        title={heading}
        titleId={titleId}
        tag={record.category && (
          <Tag color={CATEGORY_COLORS[record.category] || 'default'} style={{ margin: 0 }}>
            {record.category}
          </Tag>
        )}
      >
        <Row gutter={[24, 16]} style={{ marginTop: 16 }}>
          <Col xs={12} sm={8}>
            <Stat label="Total Qty" value={formatNumber(record.totalQty, 2)} suffix={record.uom || ''} />
          </Col>
          <Col xs={12} sm={8}>
            <Stat label="Unit Cost" value={`₹ ${formatNumber(record.unitCost, 2)}`} />
          </Col>
          <Col xs={12} sm={8}>
            <Stat
              label="Value (Excl. GST)"
              value={record.poLineValue != null ? `₹ ${formatNumber(record.poLineValue, 2)}` : '—'}
            />
          </Col>
        </Row>
      </StockDrawerHero>

      <div style={{ padding: '20px 28px 28px', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <DetailCard title="Item Details" icon={<AppstoreOutlined />}>
          <DetailCard.Field {...FIELD_SPAN} label="Style" value={record.style} />
          <DetailCard.Field {...FIELD_SPAN} label="Order No" value={record.orderRef} />
          <DetailCard.Field {...FIELD_SPAN} label="Supplier" value={record.supplier} />
          <DetailCard.Field
            {...FIELD_SPAN}
            label={fromOpening ? 'Opening Batch' : 'GRN #'}
            value={record.grnNumber}
          />
          <DetailCard.Field {...FIELD_SPAN} label="UOM" value={record.uom} />
          <DetailCard.Field
            {...FIELD_SPAN}
            label="Last Received"
            icon={<CalendarOutlined style={{ color: 'var(--text-secondary)' }} />}
            value={record.lastReceived ? formatDate(record.lastReceived) : null}
          />
        </DetailCard>

        {/* The columns already name size and colour, so the heading does not repeat them. */}
        <div style={SECTION_HEADING}>{`Variants (${variants.length})`}</div>
        <Table
          rowKey="id"
          columns={variantColumns(record.uom)}
          dataSource={variants}
          pagination={false}
          size="small"
          locale={{ emptyText: <Text type="secondary">No variant breakdown available.</Text> }}
        />
      </div>
    </Drawer>
  );
};

export default AccessoriesStockViewDrawer;
