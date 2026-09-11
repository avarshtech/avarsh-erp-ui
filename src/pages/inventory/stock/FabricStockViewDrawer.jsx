import { useId, useMemo } from 'react';
import { Drawer, Table, Space, Tag, Typography, Row, Col } from 'antd';
import {
  CalendarOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import DetailCard from '../../../components/DetailCard';
import { formatNumber, formatDate } from '../../../utils/formatters';
import { StockDrawerHero, Stat } from './StockDrawerLayout';
import { FIELD_SPAN, SECTION_HEADING } from './stockDrawerStyles';

const { Text } = Typography;

const QC_TAG = {
  Pass:              { color: 'green',   label: 'Pass' },
  Conditional_Pass:  { color: 'cyan',    label: 'Conditional Pass' },
  Back_up:           { color: 'volcano', label: 'Back-up' },
};

const SUB_CATEGORY_COLORS = {
  Knit: 'blue',
  Woven: 'geekblue',
  Denim: 'purple',
  Lining: 'cyan',
};

const getAgeColor = (days) => {
  if (days == null) return 'var(--text-secondary)';
  if (days <= 90) return 'var(--success-color)';
  if (days <= 180) return 'var(--warning-color)';
  return 'var(--error-color)';
};

const rollColumns = [
  {
    title: 'Roll #',
    dataIndex: 'rollNumber',
    key: 'rollNumber',
    width: 120,
    align: 'center',
  },
  {
    title: 'Width (in)',
    dataIndex: 'width',
    key: 'width',
    width: 110,
    align: 'center',
    render: (v) => formatNumber(v, 0),
  },
  {
    title: 'GSM',
    dataIndex: 'gsm',
    key: 'gsm',
    width: 90,
    align: 'center',
  },
  {
    title: 'Status',
    dataIndex: 'qcStatus',
    key: 'qcStatus',
    width: 150,
    align: 'center',
    render: (s) => {
      const cfg = QC_TAG[s] || { color: 'default', label: s || '-' };
      return <Tag color={cfg.color}>{cfg.label}</Tag>;
    },
  },
];

const FabricStockViewDrawer = ({ open, onClose, record }) => {
  const titleId = useId();
  const summary = useMemo(() => {
    if (!record?.rolls) return { pass: 0, cond: 0, backup: 0 };
    return record.rolls.reduce(
      (acc, r) => {
        if (r.qcStatus === 'Pass') acc.pass += 1;
        else if (r.qcStatus === 'Conditional_Pass') acc.cond += 1;
        else if (r.qcStatus === 'Back_up') acc.backup += 1;
        return acc;
      },
      { pass: 0, cond: 0, backup: 0 },
    );
  }, [record]);

  if (!record) return null;

  const ageDays = record.grnDate ? dayjs().diff(dayjs(record.grnDate), 'day') : null;
  const accent = summary.backup > 0 ? 'var(--warning-color)' : 'var(--primary-color)';
  const rolls = record.rolls || [];
  // Opening balance rows carry their batch number in `grnNumber` — the register's column is
  // headed "GRN # / Batch" for the same reason. Here the row's source is known, so name it.
  const fromOpening = record.sourceType === 'OPENING_BALANCE';
  // `fabricDescription` is the item's derived "Category - Sub-Category", which reads the same
  // for every colour of one fabric. The variant is what is actually on the rack.
  const heading = record.variantName || record.fabricDescription || 'Fabric';

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
        accent={accent}
        tag={record.subCategory && (
          <Tag color={SUB_CATEGORY_COLORS[record.subCategory] || 'default'} style={{ margin: 0 }}>
            {record.subCategory}
          </Tag>
        )}
      >
        <Row gutter={[24, 16]} style={{ marginTop: 16 }}>
          <Col xs={12} sm={8}>
            <Stat label="Total Qty" value={formatNumber(record.totalQty, 2)} suffix={record.uom || 'kg'} />
          </Col>
          <Col xs={12} sm={8}>
            <Stat
              label="Value (Excl. GST)"
              value={record.poLineValue != null ? `₹ ${formatNumber(record.poLineValue, 2)}` : '—'}
            />
          </Col>
          <Col xs={12} sm={8}>
            <Stat
              label="Age"
              value={ageDays != null ? ageDays : '—'}
              suffix={ageDays != null ? 'days' : null}
              color={getAgeColor(ageDays)}
            />
          </Col>
          <Col xs={24}>
            <Space size={8} wrap>
              <Tag icon={<CheckCircleOutlined />} color="green">{summary.pass} Pass</Tag>
              {summary.cond > 0 && <Tag color="cyan">{summary.cond} Conditional Pass</Tag>}
              {summary.backup > 0 && (
                <Tag icon={<WarningOutlined />} color="volcano">{summary.backup} Back-up</Tag>
              )}
            </Space>
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
          <DetailCard.Field
            {...FIELD_SPAN}
            label={fromOpening ? 'Opening Date' : 'GRN Date'}
            icon={<CalendarOutlined style={{ color: 'var(--text-secondary)' }} />}
            value={record.grnDate ? formatDate(record.grnDate) : null}
          />
          <DetailCard.Field {...FIELD_SPAN} label="Composition" value={record.composition} />
          <DetailCard.Field {...FIELD_SPAN} label="Colour" value={record.color} />
          <DetailCard.Field
            {...FIELD_SPAN}
            label="Std Width"
            value={record.width ? `${formatNumber(record.width, 0)} in` : null}
          />
          <DetailCard.Field {...FIELD_SPAN} label="Std GSM" value={record.gsm} />
        </DetailCard>

        <div style={SECTION_HEADING}>{`Rolls (${rolls.length})`}</div>
        <Table
          rowKey={(r) => r.id || r.rollId || r.rollNumber}
          columns={rollColumns}
          dataSource={rolls}
          pagination={false}
          size="small"
          locale={{ emptyText: <Text type="secondary">No rolls recorded against this receipt.</Text> }}
        />
      </div>
    </Drawer>
  );
};

export default FabricStockViewDrawer;
