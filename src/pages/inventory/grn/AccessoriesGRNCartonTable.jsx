import { useMemo } from 'react';
import { Table, Input, InputNumber, Typography, Empty } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const ReadOnlyText = ({ value }) => <Text style={{ fontSize: 13 }}>{value ?? '—'}</Text>;

const AccessoriesGRNCartonTable = ({ cartons = [], items = [], onCartonChange, readOnly = false }) => {
  // Per-line-item received quantity (from the Accessories Details table) —
  // cartons for the same line item collectively cannot exceed this allowance.
  const allowanceByLineId = useMemo(() => {
    const out = new Map();
    items.forEach((it) => {
      if (it.poLineItemId != null) out.set(it.poLineItemId, Number(it.receivingQty) || 0);
    });
    return out;
  }, [items]);

  // Sum carton qty per line item so we can flag groups that overshoot the allowance.
  const overageByLineId = useMemo(() => {
    const totals = new Map();
    cartons.forEach((c) => {
      if (c.poLineItemId == null) return;
      totals.set(c.poLineItemId, (totals.get(c.poLineItemId) || 0) + (Number(c.quantity) || 0));
    });
    const out = new Map();
    totals.forEach((total, lineId) => {
      const allowance = allowanceByLineId.get(lineId);
      if (Number.isFinite(allowance) && allowance > 0 && total > allowance) {
        const sample = cartons.find((c) => c.poLineItemId === lineId);
        out.set(lineId, { total, allowance, itemCode: sample?.itemCode, uom: sample?.uom });
      }
    });
    return out;
  }, [cartons, allowanceByLineId]);

  // Build display rows: each carton + an error row after the last carton of any over-limit group.
  const dataSource = useMemo(() => {
    const out = [];
    cartons.forEach((c, i) => {
      out.push({ ...c, __type: 'data', __srcIdx: i });
      const next = cartons[i + 1];
      const isLastOfGroup = !next || next.poLineItemId !== c.poLineItemId;
      if (isLastOfGroup && overageByLineId.has(c.poLineItemId)) {
        out.push({ __type: 'error', __key: `err-${c.poLineItemId}`, poLineItemId: c.poLineItemId });
      }
    });
    return out;
  }, [cartons, overageByLineId]);

  const totalCols = 7; // #, Carton #, Item Code, Description, Color, Size, Quantity

  const columns = useMemo(
    () => [
      {
        title: '#',
        key: 'idx',
        align: 'center',
        width: 50,
        render: (_, row) => {
          if (row.__type === 'error') {
            const o = overageByLineId.get(row.poLineItemId);
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
                    Total Carton Quantity ({formatNumber(o.total, 2)} {o.uom || ''}) exceeds received quantity ({formatNumber(o.allowance, 2)} {o.uom || ''}) for {o.itemCode}
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
        title: 'Carton #',
        dataIndex: 'cartonNumber',
        align: 'center',
        width: 130,
        render: (val, row) => {
          if (row.__type === 'error') return { children: null, props: { colSpan: 0 } };
          return (
            <Input
              size="small"
              value={val}
              placeholder="e.g. C001"
              disabled={readOnly}
              status={!val ? 'warning' : ''}
              onChange={(e) => onCartonChange?.(row.__srcIdx, 'cartonNumber', e.target.value)}
            />
          );
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
        dataIndex: 'itemDescription',
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
        title: 'Quantity',
        dataIndex: 'quantity',
        align: 'center',
        width: 170,
        render: (val, row) => {
          if (row.__type === 'error') return { children: null, props: { colSpan: 0 } };
          const hasOverage = overageByLineId.has(row.poLineItemId);
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
              onChange={(v) => onCartonChange?.(row.__srcIdx, 'quantity', v)}
            />
          );
        },
      },
    ],
    [onCartonChange, readOnly, overageByLineId],
  );

  const totalQty = useMemo(() => cartons.reduce((s, c) => s + (Number(c.quantity) || 0), 0), [cartons]);

  return (
    <Table
      rowKey={(row) => (row.__type === 'error' ? row.__key : `carton-${row.__srcIdx}`)}
      columns={columns}
      dataSource={dataSource}
      pagination={false}
      scroll={{ x: 920 }}
      size="small"
      locale={{ emptyText: <Empty description="Select PO line items above to populate cartons." /> }}
      summary={() => cartons.length > 0 ? (
        <Table.Summary fixed>
          <Table.Summary.Row style={{ background: 'var(--bg-secondary)' }}>
            <Table.Summary.Cell index={0} colSpan={6} align="right"><Text strong>Total Quantity:</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="center"><Text strong style={{ color: 'var(--primary-color)' }}>{formatNumber(totalQty, 2)}</Text></Table.Summary.Cell>
          </Table.Summary.Row>
        </Table.Summary>
      ) : null}
    />
  );
};

export default AccessoriesGRNCartonTable;
