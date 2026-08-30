import { useCallback, useMemo } from 'react';
import { Table, InputNumber, Button } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../components/form';
import { PANEL_NAMES, TMB_COMMENTS, TMB_ACTIONS } from '../../../utils/cuttingConstants';
import { tmbRowInTolerance } from './tmbUtils';

const POSITIONS = ['top', 'middle', 'bottom'];

/** FR-04 grid — one measurement per position: TOP | MIDDLE | BOTTOM. */
const TmbCheckGrid = ({ check, sizes, onChange }) => {
  const setRow = useCallback((idx, field, val) => {
    onChange((prev) => ({ ...prev, rows: prev.rows.map((r, i) => (i === idx ? { ...r, [field]: val } : r)) }));
  }, [onChange]);

  const setPoint = useCallback((idx, pos, pointIdx, val) => {
    onChange((prev) => ({
      ...prev,
      rows: prev.rows.map((r, i) => (i === idx ? { ...r, [pos]: r[pos].map((p, j) => (j === pointIdx ? val : p)) } : r)),
    }));
  }, [onChange]);

  const columns = useMemo(() => [
    {
      title: 'Part', dataIndex: 'part', width: 120, fixed: 'left',
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 105 }} placeholder="Part"
          options={PANEL_NAMES.map((p) => ({ value: p, label: p }))} onChange={(val) => setRow(idx, 'part', val)} />
      ),
    },
    {
      title: 'Size', dataIndex: 'size', width: 90,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 74 }} placeholder="Size"
          options={sizes.map((s) => ({ value: s, label: s }))} onChange={(val) => setRow(idx, 'size', val)} />
      ),
    },
    ...POSITIONS.map((pos) => ({
      title: pos.toUpperCase(), key: pos, width: 100, align: 'center',
      render: (_, row, idx) => (
        <InputNumber size="small" step={0.1} controls={false} value={row[pos][0]} style={{ width: 80 }}
          onChange={(val) => setPoint(idx, pos, 0, val)} />
      ),
    })),
    {
      title: '# Pcs', dataIndex: 'pcs', width: 85, align: 'center',
      render: (v, _, idx) => <InputNumber size="small" min={0} value={v} style={{ width: 70 }} onChange={(val) => setRow(idx, 'pcs', val)} />,
    },
    {
      title: 'Comments', dataIndex: 'comment', width: 140,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 125 }}
          options={TMB_COMMENTS.map((c) => ({ value: c, label: c }))} onChange={(val) => setRow(idx, 'comment', val)} />
      ),
    },
    {
      title: 'Corrective Action', dataIndex: 'action', width: 160,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 145 }}
          options={TMB_ACTIONS.map((a) => ({ value: a, label: a }))} onChange={(val) => setRow(idx, 'action', val)} />
      ),
    },
    {
      title: '', key: 'del', width: 46, align: 'center', fixed: 'right',
      render: (_, __, idx) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />}
          onClick={() => onChange((prev) => ({ ...prev, rows: prev.rows.filter((_, i) => i !== idx) }))} />
      ),
    },
  ], [sizes, setRow, setPoint, onChange]);

  return (
    <Table
      rowKey={(r) => check.rows.indexOf(r)}
      size="small"
      columns={columns}
      dataSource={check.rows}
      pagination={false}
      scroll={{ x: 1000 }}
      rowClassName={(row) => (tmbRowInTolerance(row) ? '' : 'row-shortage')}
      locale={{ emptyText: 'Add a row per part + size combination measured at Top, Middle and Bottom plies' }}
    />
  );
};

export default TmbCheckGrid;
