import { memo, useMemo } from 'react';
import { InputNumber, Table, Typography } from 'antd';
import ColorDot from '../shared/ColorDot';
import { gprLineTotals } from '../../../utils/garmentProcessCalc';

const { Text } = Typography;
const n = (v) => Number(v || 0).toLocaleString('en-IN');
const tint = (v, orderQty) => {
  if (v < 0) return { background: 'color-mix(in srgb, var(--error-color, #ff4d4f) 14%, transparent)', status: 'error' };
  if (v > orderQty) return { background: 'color-mix(in srgb, var(--warning-color, #faad14) 18%, transparent)', status: 'warning' };
  return { background: undefined, status: undefined };
};

/**
 * Colour x size grid of the active line (PRD §10): each cell shows the order qty (small,
 * read-only) above the editable process qty. Amber above the order qty, red when negative.
 * Row keys and column keys are stable, so typing never remounts an input (keeps focus).
 */
const GprQtyGrid = memo(function GprQtyGrid({ line, order, editable, onQty }) {
  const colors = useMemo(() => order.colors.filter((c) => line.colors.includes(c.name)), [order, line.colors]);
  const sizes = useMemo(() => order.sizes.filter((s) => line.sizes.includes(s)), [order, line.sizes]);
  const totals = useMemo(() => gprLineTotals(line, order), [line, order]);

  const columns = useMemo(() => [
    {
      title: 'Colour', key: 'colour', width: 130, fixed: 'left',
      render: (_, c) => <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ColorDot hex={c.hex} name={c.name} />{c.name}</span>,
    },
    ...sizes.map((size) => ({
      title: size, key: size, width: 100, align: 'right',
      render: (_, c) => {
        const orderQty = order.qtyMatrix[c.name]?.[size] || 0;
        const v = line.qty[c.name]?.[size];
        const { background, status } = tint(Number(v), orderQty);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>{n(orderQty)}</Text>
            {editable
              ? <InputNumber size="small" name={`gpr-${line.key}-${c.name}-${size}`} aria-label={`${c.name} ${size} process quantity`} precision={0} controls={false}
                  status={status} value={v} onChange={(val) => onQty(c.name, size, val ?? 0)} style={{ width: 84, background }} />
              : <span style={{ background, padding: '0 4px' }}>{n(v)}</span>}
          </div>
        );
      },
    })),
    { title: 'Colour total', key: 'rowTotal', width: 110, align: 'right', render: (_, c) => <strong>{n(totals.rows[c.name])}</strong> },
  ], [sizes, order, line, editable, onQty, totals]);

  if (!colors.length || !sizes.length) {
    return <Text type="secondary">Select at least one colour and one size to see the quantity grid.</Text>;
  }

  return (
    <Table
      size="small"
      bordered
      rowKey="name"
      columns={columns}
      dataSource={colors}
      pagination={false}
      scroll={{ x: 240 + sizes.length * 100 }}
      summary={() => (
        <Table.Summary>
          <Table.Summary.Row>
            <Table.Summary.Cell index={0}><strong>Size total</strong></Table.Summary.Cell>
            {sizes.map((s, i) => <Table.Summary.Cell key={s} index={i + 1} align="right"><strong>{n(totals.cols[s])}</strong></Table.Summary.Cell>)}
            <Table.Summary.Cell index={sizes.length + 1} align="right"><strong>{n(totals.total)}</strong></Table.Summary.Cell>
          </Table.Summary.Row>
        </Table.Summary>
      )}
    />
  );
});

export default GprQtyGrid;
