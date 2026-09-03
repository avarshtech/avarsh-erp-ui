import { useMemo } from 'react';
import { Empty, Table, Tag, Tooltip, Typography } from 'antd';

const { Text } = Typography;

const num = (v) => (Number(v) || 0).toLocaleString('en-IN');

/**
 * Order quantity vs shipped quantity, per style / colour / size (PRD §7.4).
 *
 * This block is typed by hand in every buyer template today; here it is computed.
 * Ordered quantity always comes from the order and never from packed data, which is
 * why a combination that was packed but never ordered still appears — with an
 * ordered quantity of zero — rather than being quietly dropped.
 */
const PlOrderVsPackedPanel = ({ rows = [], tolerancePercent = 0 }) => {
  const totals = useMemo(() => rows.reduce((acc, r) => ({
    orderQty: acc.orderQty + (Number(r.orderQty) || 0),
    shippedQty: acc.shippedQty + (Number(r.shippedQty) || 0),
    variance: acc.variance + (Number(r.variance) || 0),
  }), { orderQty: 0, shippedQty: 0, variance: 0 }), [rows]);

  if (!rows.length) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={(
          <Text type="secondary">
            No ordered breakdown was captured for this packing list, so there is nothing to compare against.
          </Text>
        )}
      />
    );
  }

  const columns = [
    { title: 'Style', dataIndex: 'styleNo', width: 150, ellipsis: true },
    { title: 'Colour', dataIndex: 'colorName', width: 200, ellipsis: true },
    { title: 'Size', dataIndex: 'size', width: 90 },
    { title: 'Order qty', dataIndex: 'orderQty', width: 110, align: 'right', render: (v) => num(v) },
    { title: 'Shipped qty', dataIndex: 'shippedQty', width: 118, align: 'right', render: (v) => num(v) },
    {
      title: 'Excess / shortage',
      dataIndex: 'variance',
      width: 150,
      align: 'right',
      render: (v, r) => {
        if (!v) return <Text type="secondary">—</Text>;
        const colour = v > 0 ? 'var(--warning-color)' : 'var(--error-color)';
        return (
          <Text strong style={{ color: r.withinTolerance ? 'var(--text-secondary)' : colour }}>
            {v > 0 ? `+${num(v)}` : num(v)}
          </Text>
        );
      },
    },
    {
      title: '%',
      dataIndex: 'variancePercent',
      width: 92,
      align: 'right',
      render: (v) => (v ? `${v > 0 ? '+' : ''}${v}%` : <Text type="secondary">—</Text>),
    },
    {
      title: 'Status',
      key: 'status',
      width: 150,
      render: (_, r) => {
        if (r.orderQty === 0) {
          return <Tooltip title="Packed but not on the order"><Tag color="red">Not ordered</Tag></Tooltip>;
        }
        if (r.status === 'MATCH') return <Tag color="green">Match</Tag>;
        const label = r.status === 'SHORT' ? 'Short' : 'Excess';
        return r.withinTolerance
          ? <Tooltip title={`Inside the ${tolerancePercent}% buyer tolerance`}><Tag>{`${label} (in tolerance)`}</Tag></Tooltip>
          : <Tag color={r.status === 'SHORT' ? 'red' : 'orange'}>{`${label} — outside tolerance`}</Tag>;
      },
    },
  ];

  return (
    <>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
        {`Ordered quantities come from the order, never from packed data. Buyer tolerance ${tolerancePercent}%.`}
      </Text>
      <Table
        columns={columns}
        dataSource={rows}
        rowKey={(r) => `${r.styleNo}|${r.colorName}|${r.size}`}
        size="small"
        bordered
        pagination={false}
        scroll={{ x: 1060, y: 360 }}
        rowClassName={(r) => (!r.withinTolerance && r.variance !== 0 ? 'expdoc-row-warn' : '')}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row style={{ background: 'var(--bg-secondary)' }}>
              <Table.Summary.Cell index={0} colSpan={3}><Text strong>Total</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right"><Text strong>{num(totals.orderQty)}</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right"><Text strong>{num(totals.shippedQty)}</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">
                <Text strong>{totals.variance > 0 ? `+${num(totals.variance)}` : num(totals.variance)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} colSpan={2} />
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    </>
  );
};

export default PlOrderVsPackedPanel;
