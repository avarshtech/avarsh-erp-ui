import { Table, Radio, Select, Typography, Tag } from 'antd';
import { FINISHING_PROCESSES, getProcessLabel } from '../../../utils/productionConstants';

const { Text } = Typography;

/**
 * Process assignment grid (PRD §6.7 step 2). Each of the 4 finishing processes
 * is set to In-house or Outsourced; outsourced rows pick a vendor.
 * assignments: [{ processKey, mode: 'INHOUSE'|'OUTSOURCE', vendorId }].
 */
const ProcessAssignmentTable = ({ assignments, onChange, vendors = [] }) => {
  const update = (key, patch) =>
    onChange(assignments.map((a) => (a.processKey === key ? { ...a, ...patch } : a)));

  const columns = [
    { title: 'Process', dataIndex: 'processKey', width: 280,
      render: (key) => {
        const p = FINISHING_PROCESSES.find((x) => x.key === key);
        return (
          <div>
            <Tag color="blue">{p?.sequence}</Tag>
            <Text strong>{getProcessLabel(key)}</Text>
            <div><Text type="secondary" style={{ fontSize: 12 }}>{p?.description}</Text></div>
          </div>
        );
      } },
    { title: 'Assigned To', key: 'mode', width: 240,
      render: (_, r) => (
        <Radio.Group
          optionType="button"
          value={r.mode}
          onChange={(e) => update(r.processKey, { mode: e.target.value, vendorId: e.target.value === 'INHOUSE' ? null : r.vendorId })}
          options={[{ value: 'INHOUSE', label: 'In-house' }, { value: 'OUTSOURCE', label: 'Outsource' }]}
        />
      ) },
    { title: 'Vendor', key: 'vendor', width: 240,
      render: (_, r) => (
        <>
          <Select
            style={{ width: '100%' }}
            placeholder="Select vendor"
            disabled={r.mode !== 'OUTSOURCE'}
            value={r.vendorId || undefined}
            onChange={(v) => update(r.processKey, { vendorId: v })}
            options={vendors.map((v) => ({ value: v.id, label: v.name }))}
            notFoundContent="No finishing vendors configured"
          />
          {r.mode === 'OUTSOURCE' && !r.vendorId && (
            <Text type="danger" style={{ fontSize: 11 }}>Pick a vendor</Text>
          )}
        </>
      ) },
  ];

  return (
    <Table
      rowKey="processKey"
      columns={columns}
      dataSource={assignments}
      pagination={false}
      size="small"
    />
  );
};

export default ProcessAssignmentTable;
