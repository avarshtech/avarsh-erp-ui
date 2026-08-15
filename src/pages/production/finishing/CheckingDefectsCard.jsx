import { useCallback, useMemo } from 'react';
import { Card, Table, InputNumber, Button, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../components/form';
import { DEFECT_LIBRARY, DEFECT_SEVERITIES } from '../../../utils/finishingConstants';

/** PRD 8.2/8.3 — defect log from the standard library (no free-text-only entries). */
const CheckingDefectsCard = ({ defects, onChange }) => {
  const setDefect = useCallback((idx, field, val) => {
    onChange((prev) => ({ ...prev, defects: prev.defects.map((d, i) => (i === idx ? { ...d, [field]: val } : d)) }));
  }, [onChange]);

  const columns = useMemo(() => [
    {
      title: 'Defect Code', dataIndex: 'code', width: 300,
      render: (v, _, idx) => (
        <FormSelect size="small" value={v} style={{ width: 285 }} placeholder="Defect from library" showSearch
          options={DEFECT_LIBRARY.map((d) => ({ value: d.code, label: `${d.code} — ${d.name}` }))}
          onChange={(val) => setDefect(idx, 'code', val)} />
      ),
    },
    {
      title: 'Severity', key: 'sev', width: 110, align: 'center',
      render: (_, r) => {
        const sev = DEFECT_LIBRARY.find((d) => d.code === r.code)?.severity;
        return sev ? <Tag color={DEFECT_SEVERITIES[sev].color}>{DEFECT_SEVERITIES[sev].label}</Tag> : '—';
      },
    },
    {
      title: 'Count', dataIndex: 'count', width: 100, align: 'center',
      render: (v, _, idx) => <InputNumber size="small" min={0} value={v} style={{ width: 80 }} onChange={(val) => setDefect(idx, 'count', val)} />,
    },
    {
      title: '', key: 'del', width: 46, align: 'center',
      render: (_, __, idx) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />}
          onClick={() => onChange((prev) => ({ ...prev, defects: prev.defects.filter((_, i) => i !== idx) }))} />
      ),
    },
  ], [setDefect, onChange]);

  return (
    <Card
      title="Defects Found"
      extra={(
        <Button icon={<PlusOutlined />} size="small"
          onClick={() => onChange((prev) => ({ ...prev, defects: [...prev.defects, { code: null, count: null }] }))}>
          Add Defect
        </Button>
      )}
    >
      <Table rowKey={(r) => defects.indexOf(r)} size="small" columns={columns} dataSource={defects} pagination={false}
        locale={{ emptyText: 'Every defect must be logged with a code from the defect library' }} />
    </Card>
  );
};

export default CheckingDefectsCard;
