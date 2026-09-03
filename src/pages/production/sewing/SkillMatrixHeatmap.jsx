import { useMemo } from 'react';
import { Table, Tooltip, Space, Tag } from 'antd';
import useSewingMasters from '../../../hooks/useSewingMasters';
import { SKILL_GRADE_COLORS } from '../../../utils/sewingConstants';

/**
 * PRD 5.1 — skill matrix heat map: operators as rows, operations as columns,
 * cells colored by grade (A dark-green → D red). Guides line balancing.
 */
const SkillMatrixHeatmap = ({ operators }) => {
  // Columns are the operation library; the grade bands and their meaning are
  // master data, while the heat-map colours stay presentation.
  const { operations, options, labelOf } = useSewingMasters();
  const grades = useMemo(() => options('SKILL_GRADE'), [options]);

  const columns = useMemo(() => [
    {
      title: 'Operator', key: 'op', width: 190, fixed: 'left',
      render: (_, o) => (
        <Space orientation="vertical" size={0}>
          <strong>{o.name}</strong>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{o.code} · {o.line || '—'} · {(o.machines || []).join(', ')}</span>
        </Space>
      ),
    },
    ...operations.map((op) => ({
      title: <span style={{ fontSize: 12 }}>{op.name}</span>, key: op.id, width: 105, align: 'center',
      render: (_, o) => {
        const grade = o.grades?.[op.name];
        if (!grade) return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
        return (
          <Tooltip title={`${op.name}: Grade ${grade} — ${labelOf('SKILL_GRADE', grade)}`}>
            <div style={{
              width: 30, height: 30, lineHeight: '30px', margin: '0 auto', borderRadius: 6,
              background: SKILL_GRADE_COLORS[grade], color: '#fff', fontWeight: 700,
            }}>
              {grade}
            </div>
          </Tooltip>
        );
      },
    })),
  ], [operations, labelOf]);

  return (
    <>
      <Space style={{ marginBottom: 12 }} wrap>
        {grades.map((g) => (
          <Tag key={g.value} style={{ background: SKILL_GRADE_COLORS[g.value], color: '#fff', border: 'none' }}>
            {g.value} — {g.label}
          </Tag>
        ))}
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={operators} pagination={false} scroll={{ x: 1150 }} />
    </>
  );
};

export default SkillMatrixHeatmap;
