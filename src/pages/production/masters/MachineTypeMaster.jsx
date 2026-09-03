import { useMemo } from 'react';
import { Form, Input, InputNumber, Switch, Tag } from 'antd';
import ProductionMasterPanel from './ProductionMasterPanel';
import { machineTypeApi } from '../../../services/production/productionMasterApi';

/** The machines an operation runs on and an operator is trained for. */
const MachineTypeMaster = ({ onDirtyChange }) => {
  const columns = useMemo(() => [
    { title: 'Code', dataIndex: 'code', width: 120, render: (v) => <code>{v}</code> },
    { title: 'Machine', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    {
      title: 'Status', dataIndex: 'active', width: 90,
      render: (v) => (v === false ? <Tag>Inactive</Tag> : <Tag color="green">Active</Tag>),
    },
  ], []);

  return (
    <ProductionMasterPanel
      title="Machine Types"
      subtitle="Sewing floor"
      noun="Machine Type"
      api={machineTypeApi}
      columns={columns}
      searchFields={['code', 'name']}
      defaults={{ active: true }}
      onDirtyChange={onDirtyChange}
      extraHeader="Operations default to a machine type, and operators are skilled against them"
      renderFields={() => (
        <>
          <Form.Item name="code" label="Code" rules={[{ required: true, message: 'Enter a short code' }]}>
            <Input placeholder="e.g. SNLS" maxLength={20} />
          </Form.Item>
          <Form.Item name="name" label="Machine Name" rules={[{ required: true, message: 'Enter the machine name' }]}>
            <Input placeholder="e.g. Single Needle Lock Stitch" maxLength={100} />
          </Form.Item>
          <Form.Item name="sortOrder" label="Sort Order">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} maxLength={255} />
          </Form.Item>
          <Form.Item name="active" label="Active" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </>
      )}
    />
  );
};

export default MachineTypeMaster;
