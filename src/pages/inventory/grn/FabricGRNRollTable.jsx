import { useMemo } from 'react';
import { Table, Input, InputNumber, Typography, Empty, Button, Space, Tooltip } from 'antd';
import { InfoCircleOutlined, WarningOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const ReadOnlyText = ({ value }) => <Text style={{ fontSize: 13 }}>{value ?? '—'}</Text>;

const FabricGRNRollTable = ({ rolls = [], onRollChange, onAddRoll, onRemoveRoll, readOnly = false }) => {
  // Per line item: extras (sum > balance) show as info, shortages (sum < balance) as warning.
  // Business rule: supplier may send a few units more or less vs the PO balance.
  const noticesByLineId = useMemo(() => {
    const totals = new Map();
    rolls.forEach((r) => {
      if (r.poLineItemId == null) return;
      totals.set(r.poLineItemId, (totals.get(r.poLineItemId) || 0) + (Number(r.receivingQty) || 0));
    });
    const out = new Map();
    totals.forEach((total, lineId) => {
      const sample = rolls.find((r) => r.poLineItemId === lineId);
      const balance = Number(sample?.balance);
      if (!sample || !Number.isFinite(balance) || balance <= 0 || total <= 0) return;
      const allowance = Number.isFinite(Number(sample.defaultAllowance)) ? Number(sample.defaultAllowance) : null;
      if (total > balance) {
        out.set(lineId, { kind: 'extra', total, balance, pct: ((total - balance) / balance) * 100, itemCode: sample.itemCode, uom: sample.uom, allowance });
      } else if (total < balance) {
        out.set(lineId, { kind: 'short', total, balance, pct: ((balance - total) / balance) * 100, itemCode: sample.itemCode, uom: sample.uom, allowance });
      }
    });
    return out;
  }, [rolls]);

  const dataSource = useMemo(() => {
    const out = [];
    rolls.forEach((r, i) => {
      out.push({ ...r, __type: 'data', __srcIdx: i });
      const next = rolls[i + 1];
      const isLastOfGroup = !next || next.poLineItemId !== r.poLineItemId;
      if (isLastOfGroup && noticesByLineId.has(r.poLineItemId)) {
        out.push({ __type: 'notice', __key: `notice-${r.poLineItemId}`, poLineItemId: r.poLineItemId });
      }
    });
    return out;
  }, [rolls, noticesByLineId]);

  // Rolls per line — the last roll of a line cannot be removed (deselect the line instead).
  const rollCountByLineId = useMemo(() => {
    const counts = new Map();
    rolls.forEach((r) => counts.set(r.poLineItemId, (counts.get(r.poLineItemId) || 0) + 1));
    return counts;
  }, [rolls]);

  const totalCols = 11; // #, Roll Number, Item Code, Variant, Description, Width, GSM, Rate, Quantity, Shade Lot, Amount, Rolls

  const columns = useMemo(
    () => [
      {
        title: '#',
        key: 'idx',
        align: 'center',
        width: 50,
        render: (_, row) => {
          if (row.__type === 'notice') {
            const o = noticesByLineId.get(row.poLineItemId);
            const isExtra = o.kind === 'extra';
            const accent = isExtra ? 'var(--primary-color)' : 'var(--warning-color)';
            return {
              children: (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    background: `color-mix(in srgb, ${accent} 12%, transparent)`,
                    color: accent,
                    fontSize: 12,
                    fontWeight: 500,
                    textAlign: 'left',
                    borderLeft: `3px solid ${accent}`,
                  }}
                >
                  {isExtra ? <InfoCircleOutlined /> : <WarningOutlined />}
                  <span>
                    {isExtra
                      ? `Supplier sent ${formatNumber(o.pct, 2)}% extra for ${o.itemCode} (received ${formatNumber(o.total, 2)} ${o.uom || ''}, PO balance ${formatNumber(o.balance, 2)} ${o.uom || ''})`
                      : `Short by ${formatNumber(o.pct, 2)}% from PO balance for ${o.itemCode} (received ${formatNumber(o.total, 2)} ${o.uom || ''}, PO balance ${formatNumber(o.balance, 2)} ${o.uom || ''})`}
                    {o.allowance != null && ` • Item allowance: ${formatNumber(o.allowance, 2)}%`}
                  </span>
                </div>
              ),
              props: { colSpan: totalCols },
            };
          }
          return row.__srcIdx + 1;
        },
      },
      {
        title: 'Roll Number',
        dataIndex: 'rollNumber',
        align: 'center',
        width: 120,
        render: (val, row) => {
          if (row.__type === 'notice') return { children: null, props: { colSpan: 0 } };
          return (
            <Input
              size="small"
              value={val}
              placeholder="e.g. R001"
              disabled={readOnly}
              status={!val ? 'warning' : ''}
              onChange={(e) => onRollChange(row.__srcIdx, 'rollNumber', e.target.value)}
            />
          );
        },
      },
      {
        title: 'Item Code',
        dataIndex: 'itemCode',
        align: 'center',
        width: 140,
        render: (v, row) => {
          if (row.__type === 'notice') return { children: null, props: { colSpan: 0 } };
          return <ReadOnlyText value={row.variantCode} />;
        },
      },
      {
        title: 'Variant',
        dataIndex: 'variantName',
        align: 'center',
        width: 180,
        ellipsis: true,
        render: (v, row) => {
          if (row.__type === 'notice') return { children: null, props: { colSpan: 0 } };
          return <ReadOnlyText value={v || row.variantCode} />;
        },
      },
      {
        title: 'Description',
        dataIndex: 'description',
        align: 'center',
        ellipsis: true,
        render: (v, row) => {
          if (row.__type === 'notice') return { children: null, props: { colSpan: 0 } };
          return <ReadOnlyText value={v} />;
        },
      },
      {
        title: 'Width',
        dataIndex: 'width',
        align: 'center',
        width: 80,
        render: (v, row) => {
          if (row.__type === 'notice') return { children: null, props: { colSpan: 0 } };
          return <ReadOnlyText value={v} />;
        },
      },
      {
        title: 'GSM',
        dataIndex: 'gsm',
        align: 'center',
        width: 80,
        render: (v, row) => {
          if (row.__type === 'notice') return { children: null, props: { colSpan: 0 } };
          return <ReadOnlyText value={v} />;
        },
      },
      {
        title: 'Rate',
        dataIndex: 'rate',
        align: 'center',
        width: 100,
        render: (v, row) => {
          if (row.__type === 'notice') return { children: null, props: { colSpan: 0 } };
          return <ReadOnlyText value={formatNumber(v, 2)} />;
        },
      },
      {
        title: 'Quantity',
        dataIndex: 'receivingQty',
        align: 'center',
        width: 160,
        render: (val, row) => {
          if (row.__type === 'notice') return { children: null, props: { colSpan: 0 } };
          return (
            <InputNumber
              size="small"
              min={0}
              // Quantities are numeric(15,3) everywhere — and a purchase quantity derived
              // from a UOM conversion genuinely lands on 3 decimals (6,090 MTR / 3.2 =
              // 1,903.125 KG). Rounding to 2 here pushed the receipt ABOVE the PO balance,
              // so such a line could never be received in full.
              precision={3}
              value={val}
              placeholder="Qty"
              controls={false}
              addonAfter={row.uom || ''}
              style={{ width: '100%' }}
              disabled={readOnly}
              status={!val ? 'warning' : ''}
              onChange={(v) => onRollChange(row.__srcIdx, 'receivingQty', v)}
            />
          );
        },
      },
      {
        title: 'Shade Lot',
        dataIndex: 'shadeLot',
        align: 'center',
        width: 120,
        render: (val, row) => {
          if (row.__type === 'notice') return { children: null, props: { colSpan: 0 } };
          return (
            <Input
              size="small"
              value={val}
              placeholder="SL-001"
              disabled={readOnly}
              status={!val ? 'warning' : ''}
              onChange={(e) => onRollChange(row.__srcIdx, 'shadeLot', e.target.value)}
            />
          );
        },
      },
      {
        title: 'Amount',
        key: 'amount',
        align: 'center',
        width: 120,
        render: (_, row) => {
          if (row.__type === 'notice') return { children: null, props: { colSpan: 0 } };
          const amount = (Number(row.receivingQty) || 0) * (Number(row.rate) || 0);
          return <ReadOnlyText value={formatNumber(amount, 2)} />;
        },
      },
      {
        title: 'Rolls',
        key: 'rollActions',
        align: 'center',
        width: 80,
        render: (_, row) => {
          if (row.__type === 'notice') return { children: null, props: { colSpan: 0 } };
          if (readOnly) return null;
          const next = rolls[row.__srcIdx + 1];
          const isLastOfGroup = !next || next.poLineItemId !== row.poLineItemId;
          const removable = (rollCountByLineId.get(row.poLineItemId) || 0) > 1;
          return (
            <Space size={2}>
              <Tooltip title={removable ? 'Remove this roll' : 'Last roll — deselect the line item to drop it'}>
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={!removable}
                  onClick={() => onRemoveRoll?.(row.__srcIdx)}
                />
              </Tooltip>
              {isLastOfGroup && (
                <Tooltip title={`Add another roll for ${row.itemCode || 'this item'}`}>
                  <Button
                    size="small"
                    type="text"
                    icon={<PlusOutlined />}
                    onClick={() => onAddRoll?.(row.poLineItemId)}
                  />
                </Tooltip>
              )}
            </Space>
          );
        },
      },
    ],
    [onRollChange, onAddRoll, onRemoveRoll, readOnly, noticesByLineId, rolls, rollCountByLineId],
  );

  const totalReceiving = useMemo(() => rolls.reduce((s, r) => s + (Number(r.receivingQty) || 0), 0), [rolls]);
  const totalAmount = useMemo(
    () => rolls.reduce((s, r) => s + (Number(r.receivingQty) || 0) * (Number(r.rate) || 0), 0),
    [rolls],
  );

  return (
    <Table
      rowKey={(row) => (row.__type === 'notice' ? row.__key : `roll-${row.__srcIdx}`)}
      columns={columns}
      dataSource={dataSource}
      pagination={false}
      scroll={{ x: 1260 }}
      size="small"
      locale={{ emptyText: <Empty description="Select PO line items above to populate rolls." /> }}
      summary={() => rolls.length > 0 ? (
        <Table.Summary fixed>
          <Table.Summary.Row style={{ background: 'var(--bg-secondary)' }}>
            <Table.Summary.Cell index={0} colSpan={7} align="right"><Text strong>Totals:</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="center"><Text strong style={{ color: 'var(--primary-color)' }}>{formatNumber(totalReceiving, 2)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={2} />
            <Table.Summary.Cell index={3} align="center"><Text strong style={{ color: 'var(--success-color)' }}>{formatNumber(totalAmount, 2)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={4} />
          </Table.Summary.Row>
        </Table.Summary>
      ) : null}
    />
  );
};

export default FabricGRNRollTable;
