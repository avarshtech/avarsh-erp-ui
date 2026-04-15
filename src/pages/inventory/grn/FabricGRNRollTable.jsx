import { useMemo } from 'react';
import { Table, Input, InputNumber, Typography, Empty } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const ReadOnlyText = ({ value }) => <Text style={{ fontSize: 13 }}>{value ?? '—'}</Text>;

const FabricGRNRollTable = ({ rolls = [], onRollChange, readOnly = false }) => {
  // Sum receiving qty per line item so we can flag groups where total > balance.
  const overageByLineId = useMemo(() => {
    const totals = new Map();
    rolls.forEach((r) => {
      if (r.poLineItemId == null) return;
      totals.set(r.poLineItemId, (totals.get(r.poLineItemId) || 0) + (Number(r.receivingQty) || 0));
    });
    const out = new Map();
    totals.forEach((total, lineId) => {
      const sample = rolls.find((r) => r.poLineItemId === lineId);
      const balance = Number(sample?.balance);
      if (sample && Number.isFinite(balance) && total > balance) {
        out.set(lineId, { total, balance, itemCode: sample.itemCode, uom: sample.uom });
      }
    });
    return out;
  }, [rolls]);

  // Build the display rows: each real roll, followed by a synthetic error row
  // appearing immediately after the last roll of any over-limit line item group.
  const dataSource = useMemo(() => {
    const out = [];
    rolls.forEach((r, i) => {
      out.push({ ...r, __type: 'data', __srcIdx: i });
      const next = rolls[i + 1];
      const isLastOfGroup = !next || next.poLineItemId !== r.poLineItemId;
      if (isLastOfGroup && overageByLineId.has(r.poLineItemId)) {
        out.push({ __type: 'error', __key: `err-${r.poLineItemId}`, poLineItemId: r.poLineItemId });
      }
    });
    return out;
  }, [rolls, overageByLineId]);

  const totalCols = 10; // #, Roll Number, Item Code, Description, Width, GSM, Rate, Quantity, Shade Lot, Amount

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
                    Total Quantity ({formatNumber(o.total, 2)} {o.uom || ''}) exceeds available balance ({formatNumber(o.balance, 2)} {o.uom || ''}) for {o.itemCode}
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
          if (row.__type === 'error') return { children: null, props: { colSpan: 0 } };
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
          if (row.__type === 'error') return { children: null, props: { colSpan: 0 } };
          return <ReadOnlyText value={v} />;
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
        title: 'Width',
        dataIndex: 'width',
        align: 'center',
        width: 80,
        render: (v, row) => {
          if (row.__type === 'error') return { children: null, props: { colSpan: 0 } };
          return <ReadOnlyText value={v} />;
        },
      },
      {
        title: 'GSM',
        dataIndex: 'gsm',
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
        width: 160,
        render: (val, row) => {
          if (row.__type === 'error') return { children: null, props: { colSpan: 0 } };
          const hasOverage = overageByLineId.has(row.poLineItemId);
          return (
            <InputNumber
              size="small"
              min={0}
              precision={2}
              value={val}
              placeholder="Qty"
              controls={false}
              addonAfter={row.uom || ''}
              style={{ width: '100%' }}
              disabled={readOnly}
              status={hasOverage ? 'error' : (!val ? 'warning' : '')}
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
          if (row.__type === 'error') return { children: null, props: { colSpan: 0 } };
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
          if (row.__type === 'error') return { children: null, props: { colSpan: 0 } };
          const amount = (Number(row.receivingQty) || 0) * (Number(row.rate) || 0);
          return <ReadOnlyText value={formatNumber(amount, 2)} />;
        },
      },
    ],
    [onRollChange, readOnly, overageByLineId],
  );

  const totalReceiving = useMemo(() => rolls.reduce((s, r) => s + (Number(r.receivingQty) || 0), 0), [rolls]);
  const totalAmount = useMemo(
    () => rolls.reduce((s, r) => s + (Number(r.receivingQty) || 0) * (Number(r.rate) || 0), 0),
    [rolls],
  );

  return (
    <Table
      rowKey={(row) => (row.__type === 'error' ? row.__key : `roll-${row.__srcIdx}`)}
      columns={columns}
      dataSource={dataSource}
      pagination={false}
      scroll={{ x: 1180 }}
      size="small"
      locale={{ emptyText: <Empty description="Select PO line items above to populate rolls." /> }}
      summary={() => rolls.length > 0 ? (
        <Table.Summary fixed>
          <Table.Summary.Row style={{ background: 'var(--bg-secondary)' }}>
            <Table.Summary.Cell index={0} colSpan={7} align="right"><Text strong>Totals:</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="center"><Text strong style={{ color: 'var(--primary-color)' }}>{formatNumber(totalReceiving, 2)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={2} />
            <Table.Summary.Cell index={3} align="center"><Text strong style={{ color: 'var(--success-color)' }}>{formatNumber(totalAmount, 2)}</Text></Table.Summary.Cell>
          </Table.Summary.Row>
        </Table.Summary>
      ) : null}
    />
  );
};

export default FabricGRNRollTable;
