import { useMemo } from 'react';
import { Table, InputNumber, Typography, Empty } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { numericInputProps } from '../../../utils/inputHelpers';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const ReadOnlyText = ({ value }) => <Text style={{ fontSize: 13 }}>{value ?? '—'}</Text>;

const AccessoriesGRNItemTable = ({ items = [], onItemChange, readOnly = false }) => {
  // Flag rows where the entered Quantity exceeds the line-item balance.
  const overageByIdx = useMemo(() => {
    const out = new Map();
    items.forEach((r, i) => {
      const qty = Number(r.receivingQty);
      const balance = Number(r.balance);
      if (Number.isFinite(qty) && Number.isFinite(balance) && qty > balance) {
        out.set(i, { qty, balance, itemCode: r.itemCode, uom: r.uom });
      }
    });
    return out;
  }, [items]);

  // Build display rows: each item row + a synthetic error row directly below
  // when that item's quantity exceeds its balance.
  const dataSource = useMemo(() => {
    const out = [];
    items.forEach((r, i) => {
      out.push({ ...r, __type: 'data', __srcIdx: i });
      if (overageByIdx.has(i)) {
        out.push({ __type: 'error', __key: `err-${r.poLineItemId}-${i}`, __srcIdx: i });
      }
    });
    return out;
  }, [items, overageByIdx]);

  const totalCols = 8; // #, Item Code, Description, Color, Size, Rate, Quantity, Amount

  const columns = useMemo(
    () => [
      {
        title: '#',
        key: 'idx',
        align: 'center',
        width: 50,
        render: (_, row) => {
          if (row.__type === 'error') {
            const o = overageByIdx.get(row.__srcIdx);
            return {
              children: (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    background: 'color-mix(in srgb, var(--error-color) 18%, transparent)',
                    color: 'var(--error-color)',
                    fontSize: 12,
                    fontWeight: 500,
                    textAlign: 'left',
                    borderLeft: '3px solid var(--error-color)',
                  }}
                >
                  <ExclamationCircleOutlined />
                  <span>
                    Quantity ({formatNumber(o.qty, 2)} {o.uom || ''}) exceeds available balance ({formatNumber(o.balance, 2)} {o.uom || ''}) for {o.itemCode}
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
          if (row.__type === 'error') return { children: null, props: { colSpan: 0 } };
          return <Text style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{v ?? '—'}</Text>;
        },
      },
      {
        title: 'Description',
        dataIndex: 'description',
        align: 'center',
        ellipsis: true,
        render: (v, row) => {
          if (row.__type === 'error') return { children: null, props: { colSpan: 0 } };
          return <ReadOnlyText value={v} />;
        },
      },
      {
        title: 'Color',
        dataIndex: 'color',
        align: 'center',
        width: 100,
        render: (v, row) => {
          if (row.__type === 'error') return { children: null, props: { colSpan: 0 } };
          return <ReadOnlyText value={v} />;
        },
      },
      {
        title: 'Size',
        dataIndex: 'size',
        align: 'center',
        width: 80,
        render: (v, row) => {
          if (row.__type === 'error') return { children: null, props: { colSpan: 0 } };
          return <ReadOnlyText value={v} />;
        },
      },
      {
        title: 'Rate',
        dataIndex: 'rate',
        align: 'center',
        width: 100,
        render: (v, row) => {
          if (row.__type === 'error') return { children: null, props: { colSpan: 0 } };
          return <ReadOnlyText value={formatNumber(v, 2)} />;
        },
      },
      {
        title: 'Quantity',
        dataIndex: 'receivingQty',
        align: 'center',
        width: 170,
        render: (val, row) => {
          if (row.__type === 'error') return { children: null, props: { colSpan: 0 } };
          const hasOverage = overageByIdx.has(row.__srcIdx);
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
              status={hasOverage ? 'error' : (!val ? 'warning' : '')}
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
          if (row.__type === 'error') return { children: null, props: { colSpan: 0 } };
          const amount = (Number(row.receivingQty) || 0) * (Number(row.rate) || 0);
          return <ReadOnlyText value={formatNumber(amount, 2)} />;
        },
      },
    ],
    [onItemChange, readOnly, overageByIdx],
  );

  const totalQty = useMemo(() => items.reduce((s, r) => s + (Number(r.receivingQty) || 0), 0), [items]);
  const totalAmount = useMemo(
    () => items.reduce((s, r) => s + (Number(r.receivingQty) || 0) * (Number(r.rate) || 0), 0),
    [items],
  );

  return (
    <Table
      rowKey={(row) => (row.__type === 'error' ? row.__key : `row-${row.__srcIdx}`)}
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
