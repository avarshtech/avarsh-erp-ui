import { memo, useCallback, useMemo } from 'react';
import { Card, Empty, Table, Typography } from 'antd';
import JobWorkBulkFillBar from '../jobWork/JobWorkBulkFillBar';
import { gpoLineColumns } from './gpoLineColumns';
import { gpoLiveBalance } from '../../../utils/garmentProcessPoCalc';
import { lineAmount } from '../../../utils/jobWorkPoCalc';

const { Text } = Typography;
const n = (v) => Number(v || 0).toLocaleString('en-IN');
const money = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * ④ PO Line Items (PRD §8.2, §19): one line per requirement × colour × size × process and a
 * totals row; more requirements are added from section ②. On a draft the lines can be ticked
 * and rates bulk-filled, to four decimals, with the vendor's last rate per UOM on offer.
 * Different processes stay on separate lines; amount = PO qty × rate (per dozen or kg as keyed).
 */
const GpoLinesSection = memo(function GpoLinesSection({ doc, ctx, editable, canRequest, selectedKeys, h }) {
  const columns = useMemo(() => gpoLineColumns({
    ...h, editable, canRequest,
    balanceOf: (l) => gpoLiveBalance(l, ctx, doc.held),
    excessOf: (l) => (doc.overrides || []).find((o) => o.lineKey === l.key),
    lastRateOf: (l) => ctx?.lastRates?.[l.uom],
    onRemove: editable ? h.onRemove : null,
  }), [h, editable, canRequest, ctx, doc.held, doc.overrides]);
  const lastRates = ctx?.lastRates;
  const rateOf = useCallback((l) => lastRates?.[l.uom], [lastRates]);
  const qty = doc.lines.reduce((s, l) => s + (Number(l.poQty) || 0), 0);
  const total = doc.lines.reduce((s, l) => s + lineAmount(l), 0);
  const offset = editable ? 1 : 0; // the selection column
  return (
    <Card id="gpo-lines" size="small" title="④ PO Line Items" style={{ marginBottom: 16 }}
      extra={editable && doc.lines.length > 0
        ? <JobWorkBulkFillBar lines={doc.lines} selectedKeys={selectedKeys} colourKey="color" precision={4} rateOf={rateOf} onApply={h.onLines} />
        : <Text type="secondary" style={{ fontSize: 12 }}>Tinted columns come from the requirement (locked)</Text>}>
      {doc.lines.length ? (
        <Table
          size="small" rowKey="key" pagination={false} dataSource={doc.lines} columns={columns} scroll={{ x: 'max-content' }}
          rowSelection={editable ? {
            selectedRowKeys: selectedKeys, onChange: h.onSelectRows,
            getCheckboxProps: (l) => ({ name: `select-${l.key}`, 'aria-label': `Select ${l.gprNo} ${l.color} ${l.size}` }),
          } : undefined}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={2 + offset}><strong>Total · {doc.lines.length} line{doc.lines.length === 1 ? '' : 's'}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={2 + offset} colSpan={9} />
              <Table.Summary.Cell index={11 + offset}><strong>{n(qty)} pcs</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={12 + offset} colSpan={2} />
              <Table.Summary.Cell index={14 + offset} align="right"><strong>{money(total)}</strong></Table.Summary.Cell>
              {editable && <Table.Summary.Cell index={15 + offset} />}
            </Table.Summary.Row>
          )}
        />
      ) : <Empty description="Pick an order and a requirement above, then Add to PO." />}
      {editable && (
        <Text type="secondary" style={{ display: 'block', marginTop: 10, fontSize: 12 }}>
          Tinted columns come from the requirement (locked). Different processes stay on separate lines. Amount = PO Qty × Rate.
        </Text>
      )}
    </Card>
  );
});

export default GpoLinesSection;
