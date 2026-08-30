import { useCallback, useMemo } from 'react';
import { Card, Table, InputNumber, Button, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../components/form';
import { HOURS } from '../../../utils/finishingConstants';
import { rowTotal } from '../../../services/production/finishingService';

/**
 * PRD §19 common hourly pattern — employees as rows, Hr 1-8 + OT as columns,
 * auto Total / G.Tot / Balance. Ironing variant swaps G.Tot for Cost
 * (Total × piece rate, PRD 9.3).
 */
const FinishingHourlyGrid = ({ sheet, employees, hasCost, onChange }) => {
  const setCell = useCallback((idx, field, val) => {
    onChange((prev) => ({ ...prev, rows: prev.rows.map((r, i) => (i === idx ? { ...r, [field]: val } : r)) }));
  }, [onChange]);

  const columns = useMemo(() => {
    const perEmployeeTarget = sheet.target || 0;
    let running = 0;
    const gtots = sheet.rows.map((r) => { running += rowTotal(r); return running; });
    return [
      {
        title: 'Employee', dataIndex: 'employeeId', width: 180, fixed: 'left',
        render: (v, _, idx) => (
          <FormSelect size="small" value={v} style={{ width: 165 }} placeholder="Employee"
            options={employees.map((e) => ({ value: e.id, label: `${e.name} (${e.code})` }))}
            onChange={(val) => setCell(idx, 'employeeId', val)} />
        ),
      },
      ...HOURS.map((h, hi) => ({
        title: `Hr ${hi + 1}`, dataIndex: h, width: 72, align: 'center',
        render: (v, _, idx) => (
          <InputNumber size="small" min={0} controls={false} value={v} style={{ width: 56 }}
            onChange={(val) => setCell(idx, h, val)} />
        ),
      })),
      {
        title: 'OT', dataIndex: 'ot', width: 72, align: 'center',
        render: (v, _, idx) => (
          <InputNumber size="small" min={0} controls={false} value={v} style={{ width: 56 }}
            onChange={(val) => setCell(idx, 'ot', val)} />
        ),
      },
      { title: 'Total', key: 'total', width: 76, align: 'center', fixed: 'right', render: (_, r) => <strong>{rowTotal(r)}</strong> },
      hasCost
        ? { title: 'Cost ₹', key: 'cost', width: 84, align: 'right', fixed: 'right', render: (_, r) => <strong>{(rowTotal(r) * (sheet.ratePerPiece || 0)).toFixed(0)}</strong> }
        : { title: 'G.Tot', key: 'gtot', width: 80, align: 'center', fixed: 'right', render: (_, __, idx) => gtots[idx] },
      {
        title: 'Balance', key: 'balance', width: 88, align: 'center', fixed: 'right',
        render: (_, r) => {
          const bal = perEmployeeTarget - rowTotal(r);
          return <strong style={{ color: bal >= 0 ? 'var(--success-color)' : 'var(--error-color)' }}>{bal}</strong>;
        },
      },
      {
        title: '', key: 'del', width: 46, align: 'center', fixed: 'right',
        render: (_, __, idx) => (
          <Button size="small" type="text" danger icon={<DeleteOutlined />}
            onClick={() => onChange((prev) => ({ ...prev, rows: prev.rows.filter((_, i) => i !== idx) }))} />
        ),
      },
    ];
  }, [employees, setCell, onChange, sheet.rows, sheet.target, sheet.ratePerPiece, hasCost]);

  const hourTotals = useMemo(() => {
    const totals = {};
    HOURS.forEach((h) => { totals[h] = sheet.rows.reduce((s, r) => s + (r[h] || 0), 0); });
    totals.ot = sheet.rows.reduce((s, r) => s + (r.ot || 0), 0);
    totals.all = sheet.rows.reduce((s, r) => s + rowTotal(r), 0);
    return totals;
  }, [sheet.rows]);

  return (
    <Card
      title="Employee-wise Hourly Output"
      extra={(
        <Button icon={<PlusOutlined />} size="small"
          onClick={() => onChange((prev) => ({
            ...prev,
            rows: [...prev.rows, { employeeId: null, hr1: null, hr2: null, hr3: null, hr4: null, hr5: null, hr6: null, hr7: null, hr8: null, ot: null }],
          }))}>
          Add Employee Row
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
        locale={{ emptyText: 'Add employee rows and enter pieces per hour' }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row style={{ background: 'var(--bg-secondary)' }}>
              <Table.Summary.Cell index={0}><strong>Hour totals</strong></Table.Summary.Cell>
              {HOURS.map((h, i) => (
                <Table.Summary.Cell key={h} index={i + 1} align="center"><strong>{hourTotals[h]}</strong></Table.Summary.Cell>
              ))}
              <Table.Summary.Cell index={9} align="center"><strong>{hourTotals.ot}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={10} align="center"><strong>{hourTotals.all}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={11} colSpan={3} />
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
      <Space style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
        Balance = daily target per employee − total; green under target remaining, red when target crossed. Auto-save every 5 minutes arrives with backend integration.
      </Space>
    </Card>
  );
};

export default FinishingHourlyGrid;
