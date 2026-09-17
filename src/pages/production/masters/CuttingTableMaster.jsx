import { useEffect, useMemo, useState } from 'react';
import { App, Form, Input, InputNumber, Select, Switch, Tag } from 'antd';
import ProductionMasterPanel from './ProductionMasterPanel';
import { getActiveUnits } from '../../../services/master/unitService';
import { cuttingTableApi } from '../../../services/production/productionMasterApi';
import { useBranch } from '../../../context/BranchContext';

/**
 * Lay / cutting tables. A table sits on one unit's floor, so the marker plan
 * offers only the tables of the unit the cutting PO is cut at; a table with
 * no unit is shared by every unit.
 */
const CuttingTableMaster = ({ onDirtyChange }) => {
  const { message } = App.useApp();
  // Units of the working branch only; "All branches" lists every unit
  const { activeBranchId } = useBranch();
  const [units, setUnits] = useState([]);

  useEffect(() => {
    getActiveUnits(activeBranchId || undefined)
      .then(setUnits)
      .catch(() => message.error('Failed to load the unit list'));
  }, [message, activeBranchId]);

  const unitOptions = useMemo(
    () => units.map((f) => ({ value: f.id, label: f.unitName })),
    [units],
  );

  const columns = useMemo(() => [
    { title: 'Table', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Unit', dataIndex: 'unitName', width: 180, ellipsis: true, render: (v) => v || <Tag>Shared</Tag> },
    { title: 'Sort', dataIndex: 'sortOrder', width: 70, align: 'right', render: (v) => v ?? 0 },
    {
      title: 'Status', dataIndex: 'active', width: 90,
      render: (v) => (v === false ? <Tag>Inactive</Tag> : <Tag color="green">Active</Tag>),
    },
  ], []);

  return (
    <ProductionMasterPanel
      title="Cutting Tables"
      subtitle="Cutting floor"
      noun="Table"
      api={cuttingTableApi}
      columns={columns}
      searchFields={['name', 'unitName']}
      defaults={{ active: true, sortOrder: 0 }}
      onDirtyChange={onDirtyChange}
      extraHeader="A table sits on one unit's floor; the marker plan offers a cut PO only that unit's tables. Leave the unit blank for a table every unit can use."
      renderFields={() => (
        <>
          <Form.Item name="name" label="Table Name" rules={[{ required: true, message: 'Enter the table name' }]}>
            <Input placeholder="e.g. Table-1" maxLength={50} />
          </Form.Item>
          <Form.Item name="unitId" label="Unit" tooltip="Blank = shared by every unit">
            <Select placeholder="Shared by every unit" options={unitOptions} showSearch optionFilterProp="label" allowClear />
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

export default CuttingTableMaster;
