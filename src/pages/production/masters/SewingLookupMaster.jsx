import { useMemo, useState } from 'react';
import { Form, Input, InputNumber, Select, Switch, Tag, Alert } from 'antd';
import ProductionMasterPanel from './ProductionMasterPanel';
import { sewingLookupApi } from '../../../services/production/productionMasterApi';

/**
 * The typed code lists the sewing screens read. THRESHOLD is the odd one out:
 * its rows carry the tuning numbers — efficiency bands, DHU limits, the
 * incentive base — so the value is the point of the row, not a label.
 */
const LOOKUP_TYPES = [
  { value: 'CHECK_TYPE', label: 'Check Type (trim verification)' },
  { value: 'MEASUREMENT_STAGE', label: 'Measurement Stage' },
  { value: 'DAMAGE_REASON', label: 'Damage Reason (replacements)' },
  { value: 'ISSUE_SEVERITY', label: 'Issue Severity' },
  { value: 'SKILL_GRADE', label: 'Skill Grade' },
  { value: 'BUNDLE_QUALITY', label: 'Bundle Quality (cut parts receipt)' },
  { value: 'SAM_SOURCE', label: 'SAM Source' },
  { value: 'THRESHOLD', label: 'Threshold (tuning numbers)' },
];

const SewingLookupMaster = ({ onDirtyChange }) => {
  const [lookupType, setLookupType] = useState(null);

  const columns = useMemo(() => [
    {
      title: 'List', dataIndex: 'lookupType', width: 190,
      sorter: (a, b) => a.lookupType.localeCompare(b.lookupType),
      render: (v) => <Tag color={v === 'THRESHOLD' ? 'purple' : undefined}>{v.replaceAll('_', ' ')}</Tag>,
    },
    { title: 'Code', dataIndex: 'code', width: 220, render: (v) => <code>{v}</code> },
    { title: 'Label', dataIndex: 'name', ellipsis: true },
    {
      title: 'Value', dataIndex: 'numericValue', width: 90, align: 'right',
      render: (v) => (v == null ? '—' : <strong>{Number(v)}</strong>),
    },
    {
      title: 'Status', dataIndex: 'active', width: 90,
      render: (v) => (v === false ? <Tag>Inactive</Tag> : <Tag color="green">Active</Tag>),
    },
  ], []);

  return (
    <ProductionMasterPanel
      title="Sewing Lookups"
      subtitle="Code lists &amp; thresholds"
      noun="Lookup"
      api={sewingLookupApi}
      columns={columns}
      searchFields={['lookupType', 'code', 'name']}
      defaults={{ active: true }}
      toFormValues={(record) => { setLookupType(record.lookupType); return record; }}
      onDirtyChange={onDirtyChange}
      extraHeader="Deactivating a code stops it being offered; documents already using it keep their own copy"
      renderFields={() => (
        <>
          <Form.Item name="lookupType" label="List" rules={[{ required: true, message: 'Pick which list this belongs to' }]}>
            <Select options={LOOKUP_TYPES} showSearch optionFilterProp="label" onChange={setLookupType} />
          </Form.Item>
          {lookupType === 'THRESHOLD' && (
            <Alert type="warning" showIcon style={{ marginBottom: 16 }}
              title="This row is a tuning number"
              description="The value drives what the floor screens flag — efficiency bands, DHU limits, the incentive base. The sewing services look the row up by its code, so renaming the code silently disables the rule it drives." />
          )}
          <Form.Item name="code" label="Code" rules={[{ required: true, message: 'Enter the code' }]}>
            <Input placeholder="e.g. PILOT_RUN" maxLength={50} />
          </Form.Item>
          <Form.Item name="name" label="Label" rules={[{ required: true, message: 'Enter the label shown on screen' }]}>
            <Input placeholder="e.g. Pilot run" maxLength={100} />
          </Form.Item>
          <Form.Item name="numericValue"
            label={lookupType === 'THRESHOLD' ? 'Threshold Value' : 'Numeric Value (optional)'}
            rules={lookupType === 'THRESHOLD' ? [{ required: true, message: 'A threshold needs a value' }] : []}>
            <InputNumber step={0.5} style={{ width: '100%' }} placeholder="e.g. 70" />
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

export default SewingLookupMaster;
