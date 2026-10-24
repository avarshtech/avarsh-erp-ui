import { memo, useMemo } from 'react';
import { Card, Empty, Table, Tag } from 'antd';
import { metricColumns, num, pct, toneOf } from './strengthFormat';
import './strengthReport.css';

/**
 * The report itself, laid out like the hand-made daily sheet: each department's
 * name merged down its designations, a grey department total, a blue unit total,
 * and a solid grand total. The same rows, in the same order, as the Excel and PDF.
 */
const flatten = (report) => {
  const rows = [];
  (report?.units ?? []).forEach((unit) => {
    rows.push({ key: `u${unit.unitId}`, kind: 'unit', label: unit.unitName });
    unit.departments.forEach((dept, d) => {
      const deptKey = `${dept.contract ? 'c' : 'd'}${dept.departmentId}`;
      dept.designations.forEach((line, i) => rows.push({
        key: `u${unit.unitId}-${deptKey}-${line.id}`,
        kind: 'row',
        sno: i === 0 ? d + 1 : null,
        department: dept.departmentName,
        contract: dept.contract,
        span: i === 0 ? dept.designations.length : 0,
        label: line.label,
        counts: line.counts,
      }));
      rows.push({ key: `u${unit.unitId}-${deptKey}-t`, kind: 'dept', label: `${dept.departmentName} total`, counts: dept.total });
    });
    rows.push({ key: `u${unit.unitId}-t`, kind: 'unitTotal', label: `${unit.unitName} total`, counts: unit.total });
  });
  if (rows.length) rows.push({ key: 'grand', kind: 'grand', label: 'Grand total', counts: report.total });
  return rows;
};

const isTotal = (kind) => kind === 'dept' || kind === 'unitTotal' || kind === 'grand';

/** Row fills live in strengthReport.css: index.css paints every cell with !important. */
const rowClassName = (r) => `strength-row-${r.kind}`;

const StrengthTable = memo(function StrengthTable({ report, loading }) {
  const data = useMemo(() => flatten(report), [report]);

  const columns = useMemo(() => {
    const metrics = metricColumns(report);
    const width = 3 + metrics.length;
    return [
      {
        title: 'S.No', key: 'sno', width: 56, align: 'center',
        onCell: (r) => {
          if (r.kind === 'unit') return { colSpan: width, style: { textAlign: 'left' } };
          if (isTotal(r.kind)) return { colSpan: 3 };
          return { rowSpan: r.span };
        },
        render: (_, r) => (r.kind === 'row' ? r.sno : r.label),
      },
      {
        title: 'Department', key: 'department', width: 170,
        onCell: (r) => (r.kind === 'row' ? { rowSpan: r.span, style: { fontWeight: 600 } } : { colSpan: 0 }),
        render: (_, r) => (
          <span>
            {r.department}
            {r.contract && <Tag color="purple" style={{ marginInlineStart: 6 }}>Contract</Tag>}
          </span>
        ),
      },
      {
        title: 'Designation', dataIndex: 'label', key: 'label', width: 170,
        onCell: (r) => (r.kind === 'row' ? {} : { colSpan: 0 }),
      },
      ...metrics.map((m) => ({
        title: m.title,
        key: m.key,
        align: 'right',
        width: m.percent ? 96 : 90,
        onCell: (r) => {
          if (r.kind === 'unit') return { colSpan: 0 };
          return m.percent && r.kind === 'row' ? { className: `strength-tone-${toneOf(r.counts.absentPct)}` } : {};
        },
        render: (_, r) => (r.counts ? (m.percent ? pct(r.counts[m.key]) : num(r.counts[m.key])) : null),
      })),
    ];
  }, [report]);

  return (
    <Card title="Strength by unit, department and designation" styles={{ body: { padding: 0 } }} style={{ marginBottom: 16 }}>
      <Table
        className="strength-table"
        size="small"
        bordered
        rowKey="key"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={false}
        scroll={{ x: 'max-content' }}
        rowClassName={rowClassName}
        rowHoverable={false}
        locale={{ emptyText: <Empty description="Nobody is on the roll for this day and unit" /> }}
      />
    </Card>
  );
});

export default StrengthTable;
