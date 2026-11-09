import { useMemo } from 'react';
import { Form, InputNumber, Table, Typography } from 'antd';
import { balanceOf, poKey, totalOf } from './shipmentPos';

const { Text } = Typography;

/**
 * The pieces one ticked buyer PO sends on this shipment, colour × size (user decision 2026-11-09): each cell is
 * capped at what packing completed less what other shipments take, so one PO can be split without shipping twice.
 * A PO booked before its packing ends has no grid yet; the server fills its pieces as the shipment closes.
 * Values live in the form under shipQty → order → PO key → colour → size.
 */
const ShipPoQtyGrid = ({ orderId, po }) => {
  const form = Form.useFormInstance();
  const path = useMemo(() => ['shipQty', String(orderId), poKey(po)], [orderId, po]);
  const sending = Form.useWatch(path, form);
  const balance = useMemo(() => balanceOf(po), [po]);

  const colours = useMemo(() => [...new Set([...Object.keys(po.packed || {}), ...Object.keys(po.colorQty || {})])], [po]);
  const sizes = useMemo(() => [...new Set(colours.flatMap((c) => [
    ...Object.keys(po.packed?.[c] || {}), ...Object.keys(po.colorQty?.[c] || {})]))], [colours, po]);

  const columns = useMemo(() => [
    { title: 'Colour', dataIndex: 'colour', width: 140, render: (v) => v || '—' },
    ...sizes.map((size) => ({
      title: size,
      dataIndex: size,
      width: 90,
      align: 'right',
      render: (_, row) => {
        const max = Number(balance[row.colour]?.[size]) || 0;
        return (
          <Form.Item name={[...path, row.colour, size]} noStyle>
            <InputNumber name={`ship-${row.colour}-${size}`} aria-label={`${row.colour} ${size} pieces`} size="small"
              min={0} max={max} precision={0} style={{ width: 72 }} disabled={max === 0} />
          </Form.Item>
        );
      },
    })),
  ], [sizes, balance, path]);

  if (!colours.length) {
    return (
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
        Nothing of {po.buyerPoNo} is packed yet: it is booked on this shipment, and what is packed by the time the
        shipment closes goes with it.
      </Text>
    );
  }
  return (
    <div style={{ margin: '4px 0 12px' }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {po.buyerPoNo}: packed {totalOf(po.packed)} · on other shipments {totalOf(po.shippedElsewhere)} ·
        {' '}<Text strong>this shipment {totalOf(sending)}</Text> pcs
      </Text>
      <Table size="small" bordered pagination={false} rowKey="colour" columns={columns}
        dataSource={colours.map((colour) => ({ colour }))} style={{ marginTop: 4 }} />
    </div>
  );
};

export default ShipPoQtyGrid;
