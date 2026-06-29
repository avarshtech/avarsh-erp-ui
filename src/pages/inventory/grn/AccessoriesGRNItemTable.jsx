import { useMemo } from 'react';
import { Table, InputNumber, Typography, Empty } from 'antd';
import { InfoCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { numericInputProps } from '../../../utils/inputHelpers';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const ReadOnlyText = ({ value }) => <Text style={{ fontSize: 13 }}>{value ?? '—'}</Text>;

const AccessoriesGRNItemTable = ({ items = [], onItemChange, readOnly = false }) => {
  // Flag rows that deviate from the PO balance in either direction.
  // Extras (qty > balance) show as info — supplier mutually sends a bit extra.
  // Shortages (qty < balance) show as warning — partial delivery vs pending qty.
  const noticesByIdx = useMemo(() => {
    const out = new Map();
    items.forEach((r, i) => {
      const qty = Number(r.receivingQty);
      const balance = Number(r.balance);
      if (!Number.isFinite(qty) || !Number.isFinite(balance) || qty <= 0 || balance <= 0) return;
      const allowance = Number.isFinite(Number(r.defaultAllowance)) ? Number(r.defaultAllowance) : null;
      if (qty > balance) {
        out.set(i, { kind: 'extra', qty, balance, pct: ((qty - balance) / balance) * 100, itemCode: r.itemCode, uom: r.uom, allowance });
      } else if (qty < balance) {
        out.set(i, { kind: 'short', qty, balance, pct: ((balance - qty) / balance) * 100, itemCode: r.itemCode, uom: r.uom, allowance });
      }
    });
    return out;
  }, [items]);

  const dataSource = useMemo(() => {
    const out = [];
    items.forEach((r, i) => {
      out.push({ ...r, __type: 'data', __srcIdx: i });
      if (noticesByIdx.has(i)) {
        out.push({ __type: 'notice', __key: `notice-${r.poLineItemId}-${i}`, __srcIdx: i });
      }
    });
    return out;
  }, [items, noticesByIdx]);

  const totalCols = 8; // #, Item Code, Description, Color, Size, Rate, Quantity, Amount

  const columns = useMemo(
    () => [
      {
        title: '#',
        key: 'idx',
        align: 'center',
        width: 50,
        render: (_, row) => {
          if (row.__type === 'notice') {
            const o = noticesByIdx.get(row.__srcIdx);
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
                      ? `Supplier sent ${formatNumber(o.pct, 2)}% extra for ${o.itemCode} (received ${formatNumber(o.qty, 2)} ${o.uom || ''}, PO balance ${formatNumber(o.balance, 2)} ${o.uom || ''})`
                      : `Short by ${formatNumber(o.pct, 2)}% from PO balance for ${o.itemCode} (received ${formatNumber(o.qty, 2)} ${o.uom || ''}, PO balance ${formatNumber(o.balance, 2)} ${o.uom || ''})`}
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
        title: 'Item Code',
        dataIndex: 'itemCode',
        align: 'center',
        width: 170,
        render: (v, row) => {
          if (row.__type === 'notice') return { children: null, props: { colSpan: 0 } };
          return <Text style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{v ?? '—'}</Text>;
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
        title: 'Color',
        dataIndex: 'color',
        align: 'center',
        width: 100,
        render: (v, row) => {
          if (row.__type === 'notice') return { children: null, props: { colSpan: 0 } };
          return <ReadOnlyText value={v} />;
        },
      },
      {
        title: 'Size',
        dataIndex: 'size',
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
        width: 170,
        render: (val, row) => {
          if (row.__type === 'notice') return { children: null, props: { colSpan: 0 } };
          return (
            <InputNumber
              size="small"
              min={0}
              value={val}
              placeholder="Qty"
              controls={false}
              addonAfter={row.uom || ''}
              style={{ width: '100%' }}
              disabled={readOnly}
              status={!val ? 'warning' : ''}
              onChange={(v) => onItemChange?.(row.__srcIdx, 'receivingQty', v)}
              {...numericInputProps}
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
    ],
    [onItemChange, readOnly, noticesByIdx],
  );

  const totalQty = useMemo(() => items.reduce((s, r) => s + (Number(r.receivingQty) || 0), 0), [items]);
  const totalAmount = useMemo(
    () => items.reduce((s, r) => s + (Number(r.receivingQty) || 0) * (Number(r.rate) || 0), 0),
    [items],
  );

  return (
    <Table
      rowKey={(row) => (row.__type === 'notice' ? row.__key : `row-${row.__srcIdx}`)}
      columns={columns}
      dataSource={dataSource}
      pagination={false}
      scroll={{ x: 1040 }}
      size="small"
      locale={{ emptyText: <Empty description="Select PO line items above to populate items." /> }}
      summary={() => items.length > 0 ? (
        <Table.Summary fixed>
          <Table.Summary.Row style={{ background: 'var(--bg-secondary)' }}>
            <Table.Summary.Cell index={0} colSpan={6} align="right"><Text strong>Totals:</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="center"><Text strong style={{ color: 'var(--primary-color)' }}>{formatNumber(totalQty, 2)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="center"><Text strong style={{ color: 'var(--success-color)' }}>{formatNumber(totalAmount, 2)}</Text></Table.Summary.Cell>
          </Table.Summary.Row>
        </Table.Summary>
      ) : null}
    />
  );
};

export default AccessoriesGRNItemTable;
