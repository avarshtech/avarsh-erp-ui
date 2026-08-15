import { useMemo } from 'react';
import { Table, Tooltip, Space, Tag } from 'antd';
import { OPERATIONS, SKILL_GRADES } from '../../../utils/sewingConstants';

const gradeColor = (grade) => SKILL_GRADES.find((g) => g.grade === grade)?.color;

/**
 * PRD 5.1 — skill matrix heat map: operators as rows, operations as columns,
 * cells colored by grade (A dark-green → D red). Guides line balancing.
 */
const SkillMatrixHeatmap = ({ operators }) => {
  const columns = useMemo(() => [
    {
      title: 'Operator', key: 'op', width: 190, fixed: 'left',
      render: (_, o) => (
        <Space direction="vertical" size={0}>
          <strong>{o.name}</strong>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{o.code} · {o.line} · {o.machines.join(', ')}</span>
        </Space>
      ),
    },
    ...OPERATIONS.map((op) => ({
      title: <span style={{ fontSize: 12 }}>{op}</span>, key: op, width: 105, align: 'center',
      render: (_, o) => {
        const grade = o.grades[op];
        if (!grade) return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
        const info = SKILL_GRADES.find((g) => g.grade === grade);
        return (
          <Tooltip title={`${op}: Grade ${grade} — ${info?.label}`}>
            <div style={{
              width: 30, height: 30, lineHeight: '30px', margin: '0 auto', borderRadius: 6,
              background: gradeColor(grade), color: '#fff', fontWeight: 700,
            }}>
              {grade}
            </div>
          </Tooltip>
        );
      },
    })),
  ], []);

  return (
    <>
      <Space style={{ marginBottom: 12 }} wrap>
        {SKILL_GRADES.map((g) => (
          <Tag key={g.grade} style={{ background: g.color, color: '#fff', border: 'none' }}>
            {g.grade} — {g.label}
          </Tag>
        ))}
      </Space>
      <Table rowKey="id" size="small" columns={columns} dataSource={operators} pagination={false} scroll={{ x: 1150 }} />
    </>
  );
};

export default SkillMatrixHeatmap;
