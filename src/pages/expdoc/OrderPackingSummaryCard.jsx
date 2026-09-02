import { useState, useEffect, useMemo } from 'react';
import { Card, Progress, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { hasModuleAccess } from '../../utils/permissions';
import { EXPDOC_MODULE } from '../../utils/expDocConstants';
import { packingStatusReport } from '../../services/expdoc/expDocService';

const { Text } = Typography;

const int = (v) => (Number(v) || 0).toLocaleString('en-IN');

/**
 * Packing completion on the Order detail (PRD §7.5, §11.1 "receives back").
 *
 * The integration map is bidirectional: the packing list reads the order, and the
 * order should be able to see what has been packed against it without anyone leaving
 * the screen.
 *
 * Renders NOTHING when the module is inaccessible or the order has no packing, so
 * OrderView is unchanged for everyone else — the same contract OrderSrSummaryCard
 * already keeps.
 */
const OrderPackingSummaryCard = ({ orderNo }) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const enabled = hasModuleAccess(EXPDOC_MODULE.PACKING_LIST);

  useEffect(() => {
    if (!enabled || !orderNo) return;
    packingStatusReport({ orderNo, size: 500 })
      .then((r) => setRows(r.content || []))
      .catch(() => setRows([]));
  }, [enabled, orderNo]);

  const summary = useMemo(() => {
    if (!rows?.length) return null;
    const ordered = rows.reduce((s, r) => s + (Number(r.orderQty) || 0), 0);
    const packed = rows.reduce((s, r) => s + (Number(r.packedQty) || 0), 0);
    const shipped = rows.reduce((s, r) => s + (Number(r.shippedQty) || 0), 0);
    return {
      ordered,
      packed,
      shipped,
      // §7.5's four states. "Over-packed" is called out rather than shown as 100%,
      // because more than ordered is a problem, not completion.
      state: shipped === 0 ? 'Not started'
        : (shipped > ordered ? 'Over-packed'
          : (shipped === ordered ? 'Fully packed' : 'Partially packed')),
      pct: ordered ? Math.min(100, Math.round((shipped / ordered) * 100)) : 0,
      overBy: shipped > ordered ? shipped - ordered : 0,
    };
  }, [rows]);

  if (!enabled || rows === null || !rows.length) return null;

  const colour = {
    'Not started': 'default',
    'Partially packed': 'processing',
    'Fully packed': 'green',
    'Over-packed': 'warning',
  }[summary.state];

  return (
    <Card
      size="small"
      title={(
        <Space size={8} wrap>
          <Text strong>Packing &amp; export documents</Text>
          <Tag color={colour}>{summary.state}</Tag>
          {summary.overBy > 0 && <Tag color="warning">{`+${int(summary.overBy)} pcs over order`}</Tag>}
        </Space>
      )}
      extra={(
        <Text
          style={{ color: 'var(--primary-color)', cursor: 'pointer' }}
          onClick={() => navigate('/export-docs/packing-lists/list')}
        >
          Packing lists
        </Text>
      )}
      style={{ marginTop: 16 }}
    >
      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
        <Space size={20} wrap>
          <Text type="secondary">{`Ordered ${int(summary.ordered)}`}</Text>
          <Tooltip title="Packed on any live packing list, including drafts.">
            <Text type="secondary">{`Packed ${int(summary.packed)}`}</Text>
          </Tooltip>
          <Tooltip title="Packed on an APPROVED packing list — a draft can still change.">
            <Text strong>{`Shipped ${int(summary.shipped)}`}</Text>
          </Tooltip>
        </Space>
        <Progress percent={summary.pct} size="small" status={summary.overBy ? 'exception' : undefined} />
        <Table
          size="small"
          rowKey="id"
          pagination={rows.length > 6 ? { pageSize: 6, size: 'small' } : false}
          dataSource={rows}
          scroll={{ x: 640 }}
          columns={[
            { title: 'Style', dataIndex: 'styleNo', width: 130 },
            { title: 'Colour', dataIndex: 'colorName', width: 160, ellipsis: true },
            { title: 'Size', dataIndex: 'size', width: 70, align: 'center' },
            { title: 'Ordered', dataIndex: 'orderQty', width: 90, align: 'right', render: int },
            { title: 'Shipped', dataIndex: 'shippedQty', width: 90, align: 'right', render: int },
            {
              title: 'Balance',
              dataIndex: 'balance',
              width: 100,
              align: 'right',
              render: (v) => (v === 0
                ? <Text type="success">0</Text>
                : <Text type={v > 0 ? 'secondary' : 'warning'}>{v > 0 ? int(v) : `+${int(-v)}`}</Text>),
            },
          ]}
        />
      </Space>
    </Card>
  );
};

export default OrderPackingSummaryCard;
