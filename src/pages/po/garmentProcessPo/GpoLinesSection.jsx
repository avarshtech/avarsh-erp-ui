import { memo, useMemo } from 'react';
import { Button, Card, Empty, Table, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { gpoLineColumns } from './gpoLineColumns';
import { gpoLiveBalance } from '../../../utils/garmentProcessPoCalc';
import { lineAmount } from '../../../utils/jobWorkPoCalc';

const { Text } = Typography;
const n = (v) => Number(v || 0).toLocaleString('en-IN');
const money = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * ④ PO Line Items (PRD §8.2, §19): one line per requirement × colour × size × process, a
 * totals row, and "Add another requirement" (the selection as a modal, S3). Different
 * processes stay on separate lines; amount = PO qty × rate (per dozen or kg as keyed).
 */
const GpoLinesSection = memo(function GpoLinesSection({ doc, ctx, editable, canRequest, h, onAddMore }) {
  const columns = useMemo(() => gpoLineColumns({
    ...h, editable, canRequest,
    balanceOf: (l) => gpoLiveBalance(l, ctx, doc.held),
    excessOf: (l) => (doc.overrides || []).find((o) => o.lineKey === l.key),
    lastRateOf: (l) => ctx?.lastRates?.[l.uom],
    onRemove: editable ? h.onRemove : null,
  }), [h, editable, canRequest, ctx, doc.held, doc.overrides]);
  const qty = doc.lines.reduce((s, l) => s + (Number(l.poQty) || 0), 0);
  const total = doc.lines.reduce((s, l) => s + lineAmount(l), 0);
  return (
    <Card id="gpo-lines" size="small" title="④ PO Line Items" style={{ marginBottom: 16 }}
      extra={<Text type="secondary" style={{ fontSize: 12 }}>Tinted columns come from the requirement (locked)</Text>}>
      {doc.lines.length ? (
        <Table
          size="small" rowKey="key" pagination={false} dataSource={doc.lines} columns={columns} scroll={{ x: 'max-content' }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={2}><strong>Total · {doc.lines.length} line{doc.lines.length === 1 ? '' : 's'}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={2} colSpan={9} />
              <Table.Summary.Cell index={11}><strong>{n(qty)} pcs</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={12} colSpan={2} />
              <Table.Summary.Cell index={14} align="right"><strong>{money(total)}</strong></Table.Summary.Cell>
              {editable && <Table.Summary.Cell index={15} />}
            </Table.Summary.Row>
          )}
        />
      ) : <Empty description="Select requirements above and add them to the PO." />}
      {editable && (
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <Button icon={<PlusOutlined />} onClick={onAddMore}>Add another requirement</Button>
          <Text type="secondary" style={{ fontSize: 12 }}>Different processes stay on separate lines. Amount = PO Qty × Rate.</Text>
        </div>
      )}
    </Card>
  );
});

export default GpoLinesSection;
