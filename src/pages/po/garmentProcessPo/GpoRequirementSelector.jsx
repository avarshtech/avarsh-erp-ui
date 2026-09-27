import { memo, useMemo } from 'react';
import { Button, Space, Table, Tooltip, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import GpoRequirementFilters from './GpoRequirementFilters';
import useGpoRequirementFilter from './useGpoRequirementFilter';
import { gpoRequirementColumns } from './gpoRequirementColumns';

const { Text } = Typography;

/**
 * Requirement selection (PRD §9, S3) — inline in section ② and in the "Add another
 * requirement" modal. Selectable: balance left, and the PO's process once it has lines (one
 * process per PO, deviation D23). Several requirements of that process may be ticked
 * (§12); each PO line keeps its own requirement number.
 */
const GpoRequirementSelector = memo(function GpoRequirementSelector({ rows, loading, lines, picked, onPick, onAdd, adding }) {
  const filter = useGpoRequirementFilter(rows);
  const process = lines[0]?.processLabel ?? null;
  const onPo = useMemo(() => lines.reduce((m, l) => ({ ...m, [`${l.gprId}|${l.gprLineKey}`]: (m[`${l.gprId}|${l.gprLineKey}`] || 0) + 1 }), {}), [lines]);
  const columns = useMemo(() => gpoRequirementColumns({ onPo }), [onPo]);
  const why = (r) => {
    if (!(r.balance > 0)) return 'Fully allocated';
    if (process && r.processLabel !== process) return `This PO is for ${process} — raise a separate PO for ${r.processLabel}`;
    return null;
  };
  const chosen = rows.filter((r) => picked.includes(r.key));
  return (
    <>
      <GpoRequirementFilters filter={filter} />
      <Table
        size="small" rowKey="key" pagination={false} loading={loading} dataSource={filter.shown} columns={columns} scroll={{ x: 'max-content', y: 320 }}
        locale={{ emptyText: 'No submitted garment process requirement matches.' }}
        onRow={(r) => ({ style: why(r) ? { opacity: 0.55 } : undefined })}
        rowSelection={{
          selectedRowKeys: picked, onChange: onPick,
          getCheckboxProps: (r) => ({ disabled: Boolean(why(r)), name: `gpr-${r.key}`, 'aria-label': `Select ${r.gprNo} ${r.processLabel}` }),
          renderCell: (checked, r, i, node) => (why(r) ? <Tooltip title={why(r)}>{node}</Tooltip> : node),
        }}
      />
      <Space style={{ marginTop: 10, width: '100%', justifyContent: 'space-between' }} wrap>
        <Text type="secondary">{picked.length} selected · Same process and vendor can be combined. Each line keeps its requirement no.</Text>
        <Button type="primary" icon={<PlusOutlined />} disabled={!chosen.length} loading={adding} onClick={() => onAdd(chosen)}>Add selected to PO lines</Button>
      </Space>
    </>
  );
});

export default GpoRequirementSelector;
