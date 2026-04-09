import { useMemo } from 'react';
import { Table, Input, InputNumber, Typography, Empty } from 'antd';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

const ReadOnlyText = ({ value }) => <Text style={{ fontSize: 13 }}>{value ?? '—'}</Text>;

const FabricGRNRollTable = ({ rolls = [], onRollChange, readOnly = false }) => {
  const columns = useMemo(
    () => [
      { title: '#', key: 'idx', align: 'center', width: 50, render: (_, __, i) => i + 1 },
      {
        title: 'Roll Number',
        dataIndex: 'rollNumber',
        align: 'center',
        width: 120,
        render: (val, _, i) => (
          <Input
            size="small"
            value={val}
            placeholder="e.g. R001"
            disabled={readOnly}
            status={!val ? 'warning' : ''}
            onChange={(e) => onRollChange(i, 'rollNumber', e.target.value)}
          />
        ),
      },
      { title: 'Item Code', dataIndex: 'itemCode', align: 'center', width: 140, render: (v) => <ReadOnlyText value={v} /> },
      { title: 'Description', dataIndex: 'description', align: 'center', ellipsis: true, render: (v) => <ReadOnlyText value={v} /> },
      { title: 'Width', dataIndex: 'width', align: 'center', width: 80, render: (v) => <ReadOnlyText value={v} /> },
      { title: 'GSM', dataIndex: 'gsm', align: 'center', width: 80, render: (v) => <ReadOnlyText value={v} /> },
      { title: 'PO Qty', dataIndex: 'poQty', align: 'center', width: 90, render: (v) => <ReadOnlyText value={formatNumber(v, 1)} /> },
      { title: 'Received Qty', dataIndex: 'receivedQty', align: 'center', width: 110, render: (v) => <ReadOnlyText value={formatNumber(v, 1)} /> },
      { title: 'Balance', dataIndex: 'balance', align: 'center', width: 90, render: (v) => <Text strong style={{ color: 'var(--primary-color)' }}>{formatNumber(v, 1)}</Text> },
      {
        title: 'Receiving Qty',
        dataIndex: 'receivingQty',
        align: 'center',
        width: 160,
        render: (val, _, i) => (
          <InputNumber
            size="small"
            min={0}
            precision={2}
            max={rolls[i]?.balance}
            value={val}
            placeholder="Qty"
            controls={false}
            addonAfter={rolls[i]?.uom || ''}
            style={{ width: '100%' }}
            disabled={readOnly}
            status={!val ? 'warning' : ''}
            onChange={(v) => onRollChange(i, 'receivingQty', v)}
          />
        ),
      },
      { title: 'Rate', dataIndex: 'rate', align: 'center', width: 90, render: (v) => <ReadOnlyText value={formatNumber(v, 2)} /> },
      {
        title: 'Shade Lot',
        dataIndex: 'shadeLot',
        align: 'center',
        width: 120,
        render: (val, _, i) => (
          <Input
            size="small"
            value={val}
            placeholder="SL-001"
            disabled={readOnly}
            status={!val ? 'warning' : ''}
            onChange={(e) => onRollChange(i, 'shadeLot', e.target.value)}
          />
        ),
      },
    ],
    [onRollChange, readOnly, rolls],
  );

  const totalReceiving = useMemo(() => rolls.reduce((s, r) => s + (Number(r.receivingQty) || 0), 0), [rolls]);

  return (
    <Table
      rowKey={(r, i) => `${r.poLineItemId}-${i}`}
      columns={columns}
      dataSource={rolls}
      pagination={false}
      scroll={{ x: 1240 }}
      size="small"
      locale={{ emptyText: <Empty description="Select PO line items above to populate rolls." /> }}
      summary={() => rolls.length > 0 ? (
        <Table.Summary fixed>
          <Table.Summary.Row style={{ background: 'var(--bg-secondary)' }}>
            <Table.Summary.Cell index={0} colSpan={9} align="center"><Text strong>Total Receiving:</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="center"><Text strong style={{ color: 'var(--primary-color)' }}>{formatNumber(totalReceiving, 2)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={2} colSpan={2} />
          </Table.Summary.Row>
        </Table.Summary>
      ) : null}
    />
  );
};

export default FabricGRNRollTable;
