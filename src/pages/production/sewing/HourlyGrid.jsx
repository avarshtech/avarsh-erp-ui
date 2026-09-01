import { useCallback, useMemo } from 'react';
import { Card, Table, InputNumber, Button, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../components/form';
import { HOURS } from '../../../utils/sewingConstants';
import { rowTotal, completedOf } from '../../../utils/sewingCalc';

const blankRow = () => ({
  operatorId: null, operationId: null,
  hr1: null, hr2: null, hr3: null, hr4: null, hr5: null, hr6: null, hr7: null, hr8: null, ot: null,
});

/**
 * PRD 4.3.2 — inline-editable grid: operators as rows, Hr 1-8 + OT as columns,
 * matching the paper form. Totals are computed here as the supervisor types;
 * the server recomputes them on save and owns the authoritative figure.
 */
const HourlyGrid = ({ sheet, operators, operations, lastOperationId, targetPerDay = 0, onChange }) => {
  const setCell = useCallback((idx, field, val) => {
    onChange((prev) => ({ ...prev, rows: prev.rows.map((r, i) => (i === idx ? { ...r, [field]: val } : r)) }));
  }, [onChange]);

  const columns = useMemo(() => [
    {
      title: 'Tailor (operator register)', dataIndex: 'operatorId', width: 190, fixed: 'left',
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 165 }} placeholder="Operator"
          options={operators.map((o) => ({ value: o.id, label: `${o.name} (${o.code})` }))}
          onChange={(val) => setCell(idx, 'operatorId', val)} />
      ),
    },
    {
      // Only the plan's own operations: a count against an operation this style
      // does not run has no place in the sequence, and the server refuses it.
      title: 'Operation', dataIndex: 'operationId', width: 190,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 165 }} placeholder="Operation"
          options={operations.map((o) => ({ value: o.operationId, label: o.operation }))}
          onChange={(val) => setCell(idx, 'operationId', val)} />
      ),
    },
    ...HOURS.map((h, hi) => ({
      title: `Hr ${hi + 1}`, dataIndex: h, width: 74, align: 'center',
      render: (v, _, idx) => (
        <InputNumber size="small" min={0} controls={false} value={v} style={{ width: 58 }}
          onChange={(val) => setCell(idx, h, val)} />
      ),
    })),
    {
      title: 'OT', dataIndex: 'ot', width: 74, align: 'center',
      render: (v, _, idx) => (
        <InputNumber size="small" min={0} controls={false} value={v} style={{ width: 58 }}
          onChange={(val) => setCell(idx, 'ot', val)} />
      ),
    },
    { title: 'Total', key: 'total', width: 80, align: 'center', fixed: 'right', render: (_, r) => <strong>{rowTotal(r)}</strong> },
    {
      title: 'Balance', key: 'balance', width: 88, align: 'center', fixed: 'right',
      render: (_, r) => {
        const bal = targetPerDay - rowTotal(r);
        return <strong style={{ color: bal > 0 ? 'var(--warning-color)' : 'var(--success-color)' }}>{bal}</strong>;
      },
    },
    {
      title: '', key: 'del', width: 46, align: 'center', fixed: 'right',
      render: (_, __, idx) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />}
          onClick={() => onChange((prev) => ({ ...prev, rows: prev.rows.filter((_, i) => i !== idx) }))} />
      ),
    },
  ], [operators, operations, targetPerDay, setCell, onChange]);

  const completed = completedOf(sheet.rows, lastOperationId);

  return (
    <Card
      title="Operator-wise Hourly Output"
      extra={(
        <Button icon={<PlusOutlined />} size="small"
          onClick={() => onChange((prev) => ({ ...prev, rows: [...prev.rows, blankRow()] }))}>
          Add Operator Row
        </Button>
      )}
    >
      <Table
        rowKey={(r) => sheet.rows.indexOf(r)}
        size="small"
        columns={columns}
        dataSource={sheet.rows}
        pagination={false}
        scroll={{ x: 1290 }}
        locale={{ emptyText: 'Add operator rows and enter output per hour' }}
      />
      <Space style={{ marginTop: 8, color: 'var(--text-secondary)' }} wrap>
        <span>Balance = day target ({targetPerDay}) − operation total. Garment output counts the last operation only.</span>
        <strong>Total Garment Output: {completed} pcs</strong>
      </Space>
    </Card>
  );
};

export default HourlyGrid;
