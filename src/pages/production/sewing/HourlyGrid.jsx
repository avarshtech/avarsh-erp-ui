import { useCallback, useMemo } from 'react';
import { Card, Table, InputNumber, Input, Button, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../components/form';
import { HOURS } from '../../../utils/sewingConstants';
import { rowTotal } from '../../../services/production/sewingService';

/**
 * PRD 4.3.2 — inline-editable grid: operators as rows, Hr 1-8 + OT as columns,
 * matching the paper form. Tab between cells for fast numeric entry.
 */
const HourlyGrid = ({ sheet, operators, onChange }) => {
  const setCell = useCallback((idx, field, val) => {
    onChange((prev) => ({ ...prev, rows: prev.rows.map((r, i) => (i === idx ? { ...r, [field]: val } : r)) }));
  }, [onChange]);

  const columns = useMemo(() => [
    {
      title: 'Tailor Name', dataIndex: 'operatorId', width: 170, fixed: 'left',
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 155 }} placeholder="Operator"
          options={operators.map((o) => ({ value: o.id, label: `${o.name} (${o.code})` }))}
          onChange={(val) => setCell(idx, 'operatorId', val)} />
      ),
    },
    {
      title: 'Parts Name', dataIndex: 'part', width: 170,
      render: (v, _, idx) => <Input size="small" value={v} onChange={(e) => setCell(idx, 'part', e.target.value)} />,
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
      title: '', key: 'del', width: 46, align: 'center', fixed: 'right',
      render: (_, __, idx) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />}
          onClick={() => onChange((prev) => ({ ...prev, rows: prev.rows.filter((_, i) => i !== idx) }))} />
      ),
    },
  ], [operators, setCell, onChange]);

  const hourTotals = useMemo(() => {
    const totals = {};
    HOURS.forEach((h) => { totals[h] = sheet.rows.reduce((s, r) => s + (r[h] || 0), 0); });
    totals.ot = sheet.rows.reduce((s, r) => s + (r.ot || 0), 0);
    totals.all = sheet.rows.reduce((s, r) => s + rowTotal(r), 0);
    return totals;
  }, [sheet.rows]);

  return (
    <Card
      title="Operator-wise Hourly Output"
      extra={(
        <Button icon={<PlusOutlined />} size="small"
          onClick={() => onChange((prev) => ({
            ...prev,
            rows: [...prev.rows, { operatorId: null, part: '', hr1: null, hr2: null, hr3: null, hr4: null, hr5: null, hr6: null, hr7: null, hr8: null, ot: null }],
          }))}>
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
        scroll={{ x: 1250 }}
        locale={{ emptyText: 'Add operator rows and enter output per hour' }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row style={{ background: 'var(--bg-secondary)' }}>
              <Table.Summary.Cell index={0} colSpan={2}><strong>Hour totals</strong></Table.Summary.Cell>
              {HOURS.map((h, i) => (
                <Table.Summary.Cell key={h} index={i + 2} align="center"><strong>{hourTotals[h]}</strong></Table.Summary.Cell>
              ))}
              <Table.Summary.Cell index={10} align="center"><strong>{hourTotals.ot}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={11} align="center"><strong>{hourTotals.all}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={12} />
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
      <Space style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
        Tab moves between cells; totals recalculate instantly. Auto-save on blur arrives with backend integration.
      </Space>
    </Card>
  );
};

export default HourlyGrid;
