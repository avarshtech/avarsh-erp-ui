import { memo, useCallback, useMemo, useState } from 'react';
import { Card, Table, Typography } from 'antd';
import EmptyState from '../../../components/EmptyState';
import { cprTotals } from '../../../utils/cutPanelCalc';
import { buildGridColumns, buildGridRows } from './cprGridColumns';
import CprGridToolbar from './CprGridToolbar';

const { Text } = Typography;
const n = (v) => Number(v || 0).toLocaleString('en-IN');

/**
 * Section 3 — Cut Panel Requirement grid (PRD §8.3). Size columns come from the order's
 * size set, never hard-coded; a totals row sums every size and the whole CPR.
 */
const CprRequirementGrid = memo(function CprRequirementGrid({ doc, order, editable, handlers }) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [selectedKeys, setSelectedKeys] = useState([]);

  const toggleGroup = useCallback((gk) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(gk)) next.delete(gk); else next.add(gk);
    return next;
  }), []);

  const rows = useMemo(() => buildGridRows(doc.lines, order, doc.orderAllowancePct, collapsed), [doc.lines, order, doc.orderAllowancePct, collapsed]);
  const lineKeys = useMemo(() => rows.filter((r) => r.type === 'line').map((r) => r.key), [rows]);

  /** Enter in a size cell: next size on the row, then the first size of the next row. */
  const focusNext = useCallback((key, idx) => {
    const next = idx + 1 < order.sizes.length
      ? `cpr-qty-${key}-${idx + 1}`
      : `cpr-qty-${lineKeys[lineKeys.indexOf(key) + 1]}-0`;
    document.getElementById(next)?.focus();
  }, [order.sizes.length, lineKeys]);

  const columns = useMemo(() => buildGridColumns({
    order, editable, orderAllowancePct: doc.orderAllowancePct, collapsed, focusNext, handlers: { ...handlers, toggleGroup },
  }), [order, editable, doc.orderAllowancePct, collapsed, focusNext, handlers, toggleGroup]);

  const totals = useMemo(() => cprTotals(doc.lines, order.sizes), [doc.lines, order.sizes]);
  const offset = editable ? 1 : 0; // selection column

  return (
    <Card title="Cut Panel Requirement" size="small" style={{ marginBottom: 16 }} extra={<Text type="secondary">{doc.lines.length} line(s)</Text>}>
      {editable && doc.lines.length > 0 && (
        <CprGridToolbar
          defaultAllowance={doc.orderAllowancePct}
          overriddenCount={doc.lines.filter((l) => l.isManualOverride).length}
          selectedCount={selectedKeys.length}
          onRecalcAll={handlers.onRecalcAll}
          onApplyAllowance={handlers.onApplyAllowance}
          onRemoveSelected={() => { handlers.onRemoveMany(selectedKeys); setSelectedKeys([]); }}
        />
      )}
      <Table
        size="small"
        bordered
        rowKey="key"
        sticky={{ offsetHeader: 64 }}
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 760 + order.sizes.length * 90 }}
        onRow={(r) => ({ style: r.type === 'group' ? { background: 'var(--bg-secondary, #fafafa)' } : undefined })}
        rowSelection={editable ? {
          selectedRowKeys: selectedKeys,
          onChange: (keys) => setSelectedKeys(keys.filter((k) => lineKeys.includes(k))),
          getCheckboxProps: (r) => ({ disabled: r.type !== 'line', name: `select-${r.key}` }),
          renderCell: (checked, r, i, node) => (r.type === 'line' ? node : null),
        } : undefined}
        locale={{ emptyText: <EmptyState title="No requirement lines yet" description="Pick a fabric, colours, panels and processes above, then Add to Grid." /> }}
        summary={() => (doc.lines.length ? (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={4 + offset}><strong>Total cut panel requirement</strong></Table.Summary.Cell>
              {order.sizes.map((s, i) => (
                <Table.Summary.Cell key={s} index={4 + offset + i} align="right"><strong>{n(totals.bySize[s])}</strong></Table.Summary.Cell>
              ))}
              <Table.Summary.Cell index={4 + offset + order.sizes.length} align="right"><strong>{n(totals.totalQty)}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={5 + offset + order.sizes.length} colSpan={2} />
            </Table.Summary.Row>
          </Table.Summary>
        ) : null)}
      />
    </Card>
  );
});

export default CprRequirementGrid;
