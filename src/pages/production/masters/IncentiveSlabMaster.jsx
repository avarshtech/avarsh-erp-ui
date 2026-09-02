import { useMemo } from 'react';
import { Form, Input, InputNumber, Switch, Tag, Alert } from 'antd';
import ProductionMasterPanel from './ProductionMasterPanel';
import { incentiveSlabApi } from '../../../services/production/productionMasterApi';

/** Efficiency bands and what each pays. The server refuses overlapping bands. */
const IncentiveSlabMaster = ({ onDirtyChange }) => {
  const columns = useMemo(() => [
    { title: 'Slab', dataIndex: 'name', sorter: (a, b) => Number(a.fromPct) - Number(b.fromPct) },
    {
      title: 'Efficiency Band', key: 'band', width: 170, align: 'center',
      render: (_, r) => <span>{Number(r.fromPct)}% – {Number(r.toPct)}%</span>,
    },
    {
      title: 'Amount / day', dataIndex: 'amount', width: 130, align: 'right',
      render: (v) => <strong>₹{Number(v)}</strong>,
    },
    {
      title: 'Status', dataIndex: 'active', width: 90,
      render: (v) => (v === false ? <Tag>Inactive</Tag> : <Tag color="green">Active</Tag>),
    },
  ], []);

  return (
    <ProductionMasterPanel
      title="Incentive Slabs"
      subtitle="Payout bands"
      noun="Slab"
      api={incentiveSlabApi}
      columns={columns}
      searchFields={['name']}
      defaults={{ active: true }}
      onDirtyChange={onDirtyChange}
      extraHeader="The daily figure per operator is read from these; nothing is posted to payroll"
      renderFields={() => (
        <>
          <Alert type="info" showIcon style={{ marginBottom: 16 }}
            title="Bands must not overlap"
            description="An efficiency has to fall in exactly one slab, so the server refuses a band that overlaps an existing one. A band includes its From and stops below its To." />
          <Form.Item name="name" label="Slab Name" rules={[{ required: true, message: 'Name the slab' }]}>
            <Input placeholder="e.g. 80-90%" maxLength={50} />
          </Form.Item>
          <Form.Item name="fromPct" label="From Efficiency %" rules={[{ required: true, message: 'Enter the band start' }]}>
            <InputNumber min={0} max={999} step={5} style={{ width: '100%' }} addonAfter="%" />
          </Form.Item>
          <Form.Item name="toPct" label="To Efficiency %"
            rules={[
              { required: true, message: 'Enter the band end' },
              ({ getFieldValue }) => ({
                validator: (_, value) => (value == null || value > getFieldValue('fromPct')
                  ? Promise.resolve()
                  : Promise.reject(new Error('The band must end above where it starts'))),
              }),
            ]}>
            <InputNumber min={0} max={999} step={5} style={{ width: '100%' }} addonAfter="%" />
          </Form.Item>
          <Form.Item name="amount" label="Amount per day" rules={[{ required: true, message: 'Enter the payout' }]}>
            <InputNumber min={0} step={10} style={{ width: '100%' }} addonBefore="₹" />
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

export default IncentiveSlabMaster;
