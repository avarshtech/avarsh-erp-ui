import { memo, useCallback, useMemo, useState } from 'react';
import { Card, Empty, Table } from 'antd';
import JobWorkBulkFillBar from '../jobWork/JobWorkBulkFillBar';
import { BULK_MODE } from '../../../utils/jobWorkBulkFill';
import { cppGridColumns, gridRows } from './cppGridColumns';
import { liveBalance } from '../../../utils/cutPanelPoCalc';
import { gridScroll } from '../../../utils/gridScroll';

/**
 * PO Grid (PRD §8.3, §13.1): one line per requirement line × size, grouped per colour
 * and panel with subtotals. Zero-balance lines render greyed and locked (EC-13); the
 * bulk-fill helpers sit in the grid header (FR-15). A long grid scrolls inside a viewport-high
 * body with its header pinned (utils/gridScroll). The tick boxes show only while the rate fill
 * is on "Selected lines", the one thing they feed. `h` carries the handlers the columns
 * need; see cppGridColumns.
 */
const CppGridSection = memo(function CppGridSection({ doc, editable, ctx, rates, selectedKeys, h }) {
  const rows = useMemo(() => gridRows(doc.lines), [doc.lines]);
  const lastRates = rates.byKey;
  const [fillMode, setFillMode] = useState(BULK_MODE.COLOUR);
  const selecting = fillMode === BULK_MODE.SELECTED;
  const { onSelectRows } = h;
  const onFillMode = useCallback((m) => { setFillMode(m); if (m !== BULK_MODE.SELECTED) onSelectRows([]); }, [onSelectRows]);
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
      id="cpp-grid" size="small" title="PO Grid" style={{ marginBottom: 16 }}
      extra={editable && doc.lines.length > 0 && (
        <JobWorkBulkFillBar lines={doc.lines} selectedKeys={selectedKeys} rateOf={rateOf} recent={rates.recent} onApply={h.onLines} mode={fillMode} onMode={onFillMode} />
      )}
    >
      {doc.lines.length ? (
        <Table
          size="small" rowKey="key" pagination={false} dataSource={rows} columns={columns} scroll={gridScroll('max-content', rows.length + doc.lines.length)}
          expandable={{ expandedRowKeys: rows.map((r) => r.key), showExpandColumn: false }}
          onRow={(r) => ({ style: !r.isGroup && !(Number(r.poQty) > 0) ? { opacity: 0.55 } : r.isGroup ? { background: 'var(--bg-secondary, #fafafa)' } : undefined })}
          rowSelection={editable && selecting ? {
            checkStrictly: true, selectedRowKeys: selectedKeys, onChange: (keys) => h.onSelectRows(keys.filter((k) => !String(k).startsWith('G|'))),
            getCheckboxProps: (r) => ({ disabled: r.isGroup || !(Number(r.poQty) > 0), name: `select-${r.key}`, 'aria-label': 'Select line' }),
          } : undefined}
        />
      ) : <Empty description="Choose the process and requirements above, then Add to Grid." />}
    </Card>
  );
});

export default CppGridSection;
