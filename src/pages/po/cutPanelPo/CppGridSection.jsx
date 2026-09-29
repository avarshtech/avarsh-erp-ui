import { memo, useCallback, useMemo } from 'react';
import { Card, Empty, Table } from 'antd';
import JobWorkBulkFillBar from '../jobWork/JobWorkBulkFillBar';
import { cppGridColumns, gridRows } from './cppGridColumns';
import { liveBalance } from '../../../utils/cutPanelPoCalc';

/**
 * ④ PO Grid (PRD §8.3, §13.1): one line per requirement line × size, grouped per colour
 * and panel with subtotals. Zero-balance lines render greyed and locked (EC-13); the
 * bulk-fill helpers sit in the grid header (FR-15). `h` carries the handlers the columns
 * need; see cppGridColumns.
 */
const CppGridSection = memo(function CppGridSection({ doc, editable, ctx, rates, selectedKeys, h }) {
  const rows = useMemo(() => gridRows(doc.lines), [doc.lines]);
  const lastRates = rates.byKey;
  const rateOf = useCallback((l) => lastRates?.[`${l.styleNo}|${l.size}`], [lastRates]);
  const columns = useMemo(() => cppGridColumns({
    ...h,
    editable,
    balanceOf: (l) => liveBalance(l, ctx, doc.held),
    lastRateOf: (l) => rates.byKey?.[`${l.styleNo}|${l.size}`],
    overrideOf: (l) => (doc.overrides || []).find((o) => o.lineKey === l.key),
  }), [h, editable, ctx, rates, doc.overrides, doc.held]);
  return (
    <Card
      id="cpp-grid" size="small" title="④ PO Grid" style={{ marginBottom: 16 }}
      extra={editable && doc.lines.length > 0 && (
        <JobWorkBulkFillBar lines={doc.lines} selectedKeys={selectedKeys} rateOf={rateOf} recent={rates.recent} onApply={h.onLines} />
      )}
    >
      {doc.lines.length ? (
        <Table
          size="small" rowKey="key" pagination={false} dataSource={rows} columns={columns} scroll={{ x: 'max-content' }}
          expandable={{ expandedRowKeys: rows.map((r) => r.key), showExpandColumn: false }}
          onRow={(r) => ({ style: !r.isGroup && !(Number(r.poQty) > 0) ? { opacity: 0.55 } : r.isGroup ? { background: 'var(--bg-secondary, #fafafa)' } : undefined })}
          rowSelection={editable ? {
            checkStrictly: true, selectedRowKeys: selectedKeys, onChange: (keys) => h.onSelectRows(keys.filter((k) => !String(k).startsWith('G|'))),
            getCheckboxProps: (r) => ({ disabled: r.isGroup || !(Number(r.poQty) > 0), name: `select-${r.key}`, 'aria-label': 'Select line' }),
          } : undefined}
        />
      ) : <Empty description="Choose the process and requirements above, then Add to Grid." />}
    </Card>
  );
});

export default CppGridSection;
