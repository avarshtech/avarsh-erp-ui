import { useMemo } from 'react';
import { Form, Input, InputNumber, Select, Switch, Tag } from 'antd';
import ProductionMasterPanel from './ProductionMasterPanel';
import { sewingDefectTypeApi } from '../../../services/production/productionMasterApi';
import { CATEGORY_COLORS } from '../../../utils/sewingConstants';

const CATEGORY_OPTIONS = Object.keys(CATEGORY_COLORS).map((c) => ({ value: c, label: c }));

/** The end-line defect library — one Pareto bar per type, so the names must be shared. */
const SewingDefectTypeMaster = ({ onDirtyChange }) => {
  const columns = useMemo(() => [
    {
      title: 'Category', dataIndex: 'category', width: 190,
      sorter: (a, b) => (a.category || '').localeCompare(b.category || ''),
      render: (v) => <Tag color={CATEGORY_COLORS[v]}>{v}</Tag>,
    },
    { title: 'Defect Type', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    {
      title: 'Status', dataIndex: 'active', width: 90,
      render: (v) => (v === false ? <Tag>Inactive</Tag> : <Tag color="green">Active</Tag>),
    },
  ], []);

  return (
    <ProductionMasterPanel
      title="Defect Types"
      subtitle="Quality"
      noun="Defect Type"
      api={sewingDefectTypeApi}
      columns={columns}
      searchFields={['category', 'name']}
      defaults={{ active: true, category: CATEGORY_OPTIONS[0]?.value }}
      onDirtyChange={onDirtyChange}
      extraHeader="End-line reports count against these; two names for one fault split the Pareto"
      renderFields={() => (
        <>
          <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Select the defect category' }]}>
            <Select options={CATEGORY_OPTIONS} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="name" label="Defect Type" rules={[{ required: true, message: 'Enter the defect name' }]}>
            <Input placeholder="e.g. Broken stitch" maxLength={100} />
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

export default SewingDefectTypeMaster;
