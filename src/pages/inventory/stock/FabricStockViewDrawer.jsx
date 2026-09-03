import { useMemo } from 'react';
import { Drawer, Descriptions, Table, Divider, Space, Tag, Typography, Row, Col } from 'antd';
import {
  NumberOutlined,
  CalendarOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  BarcodeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import { formatNumber, formatDate } from '../../../utils/formatters';

const { Text, Title } = Typography;

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
          borderLeft: `4px solid ${accent}`,
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
            {record.variantCode}
          </span>
          {record.subCategory && (
            <Tag color={SUB_CATEGORY_COLORS[record.subCategory] || 'default'} style={{ margin: 0 }}>
              {record.subCategory}
            </Tag>
          )}
        </Space>
        <Title level={4} style={{ margin: 0, letterSpacing: '-0.01em' }}>
          {record.fabricDescription}
        </Title>

        <Row gutter={24} style={{ marginTop: 16 }}>
          <Col xs={12} sm={12}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Qty
            </Text>
            <Text strong style={{ fontSize: 22, letterSpacing: '-0.02em' }}>
              {formatNumber(record.totalQty, 2)}{' '}
              <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>{record.uom || 'kg'}</Text>
            </Text>
          </Col>
          <Col xs={12} sm={12}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Age
            </Text>
            <Text strong style={{ fontSize: 22, color: getAgeColor(ageDays), letterSpacing: '-0.02em' }}>
              {ageDays != null ? `${ageDays}` : '-'}
              <Text type="secondary" style={{ fontSize: 13, marginLeft: 4 }}>days</Text>
            </Text>
          </Col>
          <Col xs={24} style={{ marginTop: 14 }}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
              QC Summary
            </Text>
            <Space size={8} wrap>
              <Tag icon={<CheckCircleOutlined />} color="green">{summary.pass} Pass</Tag>
              {summary.cond > 0 && <Tag color="cyan">{summary.cond} Conditional Pass</Tag>}
              {summary.backup > 0 && (
                <Tag icon={<WarningOutlined />} color="volcano">{summary.backup} Back-up</Tag>
              )}
            </Space>
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
          labelStyle={{ width: 140, background: 'var(--bg-secondary)' }}
        >
          <Descriptions.Item label="Style">{record.style || '-'}</Descriptions.Item>
          <Descriptions.Item label="Order No">{record.orderRef || '-'}</Descriptions.Item>
          <Descriptions.Item label="Supplier">{record.supplier || '-'}</Descriptions.Item>
          <Descriptions.Item label="GRN #">{record.grnNumber || '-'}</Descriptions.Item>
          <Descriptions.Item label="GRN Date">
            <Space size={6}>
              <CalendarOutlined style={{ color: 'var(--text-secondary)' }} />
              {formatDate(record.grnDate)}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Sub Category">
            {record.subCategory
              ? <Tag color={SUB_CATEGORY_COLORS[record.subCategory] || 'default'}>{record.subCategory}</Tag>
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Composition">{record.composition || '-'}</Descriptions.Item>
          <Descriptions.Item label="Colour">{record.color || '-'}</Descriptions.Item>
          <Descriptions.Item label="Std Width">{record.width ? `${record.width} in` : '-'}</Descriptions.Item>
          <Descriptions.Item label="Std GSM">{record.gsm || '-'}</Descriptions.Item>
          <Descriptions.Item label="Total Value (Excl. GST)" span={2}>
            <Text strong>{record.poLineValue != null ? `₹ ${formatNumber(record.poLineValue, 2)}` : '-'}</Text>
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
            <NumberOutlined style={{ color: 'var(--primary-color)' }} />
            <Text strong>Rolls</Text>
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
            <span style={{ fontSize: 14 }}>{record.rolls?.length || 0}</span>
            <Text type="secondary" style={{ fontSize: 11.5, fontWeight: 500 }}>
              {record.rolls?.length === 1 ? 'roll' : 'rolls'}
            </Text>
          </span>
        </div>

        <Table
          rowKey={(r) => r.id || r.rollId || r.rollNumber}
          columns={rollColumns}
          dataSource={record.rolls || []}
          pagination={false}
          size="small"
        />
      </div>
    </Drawer>
  );
};

export default FabricStockViewDrawer;
