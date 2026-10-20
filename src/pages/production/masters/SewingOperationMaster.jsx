import { useEffect, useMemo, useState } from 'react';
import { App, Form, Input, InputNumber, Select, Switch, Tag } from 'antd';
import ProductionMasterPanel from './ProductionMasterPanel';
import { sewingOperationApi, machineTypeApi } from '../../../services/production/productionMasterApi';

/** The operation library a plan's breakdown and an operator's skills are built from. */
const SewingOperationMaster = ({ onDirtyChange }) => {
  const { message } = App.useApp();
  const [machines, setMachines] = useState([]);

  useEffect(() => {
    machineTypeApi.list()
      .then(setMachines)
      .catch(() => message.error('Failed to load machine types'));
  }, [message]);

  const machineOptions = useMemo(
    () => machines.map((m) => ({ value: m.id, label: `${m.code} — ${m.name}` })),
    [machines],
  );

  const columns = useMemo(() => [
    { title: 'Operation', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    {
      title: 'Default Machine', dataIndex: 'machineTypeName', width: 210, ellipsis: true,
      render: (v, r) => (v ? <span><code>{r.machineTypeCode}</code> {v}</span> : '—'),
    },
    {
      title: 'Status', dataIndex: 'active', width: 90,
      render: (v) => (v === false ? <Tag>Inactive</Tag> : <Tag color="green">Active</Tag>),
    },
  ], []);

  return (
    <ProductionMasterPanel
      title="Sewing Operations"
      subtitle="Sewing floor"
      noun="Operation"
      api={sewingOperationApi}
      columns={columns}
      searchFields={['name', 'machineTypeName']}
      defaults={{ active: true }}
      onDirtyChange={onDirtyChange}
      extraHeader="Plans break down into these; a plan may override the machine for a style"
      renderFields={() => (
        <>
          <Form.Item name="name" label="Operation Name" rules={[{ required: true, message: 'Enter the operation name' }]}>
            <Input placeholder="e.g. Shoulder join" maxLength={100} />
          </Form.Item>
          <Form.Item name="machineTypeId" label="Default Machine"
            tooltip="What this operation normally runs on; a plan can override it per style">
            <Select placeholder="Select machine type" options={machineOptions} showSearch optionFilterProp="label" allowClear />
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

export default SewingOperationMaster;
