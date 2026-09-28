import { useState } from 'react';
import { App, Form, Input, InputNumber } from 'antd';
import { createProcess } from '../../../services/master/processService';
import { createOverhead } from '../../../services/master/overheadService';
import { numericInputProps } from '../../../utils/inputHelpers';
import QuickFormFooter from './QuickFormFooter';

/**
 * A name and a default cost — the two things a costing row reads from these masters. Returned
 * as a picker option ({value, label, defaultCost}) so the row can take it directly.
 */
function NameCostForm({ prefill, onDone, onCancel, nameLabel, placeholder, save, formName }) {
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);

  const handleFinish = async (values) => {
    setSaving(true);
    try {
      const option = await save(values);
      message.success(`"${option.label}" created`);
      onDone(option);
    } catch {
      // The axios interceptor has already shown the server's message.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form name={formName} layout="vertical" initialValues={{ name: prefill.text }} onFinish={handleFinish}>
      <Form.Item name="name" label={nameLabel} rules={[{ required: true, message: `${nameLabel} is required` }]}>
        <Input autoFocus placeholder={placeholder} maxLength={200} />
      </Form.Item>
      <Form.Item name="defaultCost" label="Default Cost" extra="Filled into the row's cost when it is picked.">
        <InputNumber min={0} precision={2} controls={false} style={{ width: '100%' }} {...numericInputProps} />
      </Form.Item>
      <QuickFormFooter saving={saving} onCancel={onCancel} />
    </Form>
  );
}

export function ProcessQuickForm(props) {
  // Section D lists only Manufacturing processes, so the category is implied.
  const save = async ({ name, defaultCost }) => {
    const created = await createProcess({ processName: name, defaultCost, category: 'Manufacturing', isActive: true });
    return { value: created.id, label: created.processName, defaultCost: created.defaultCost || 0 };
  };
  return <NameCostForm {...props} formName="quickProcess" nameLabel="Process Name" placeholder="e.g. Overlock, Flatlock, Washing" save={save} />;
}

export function OverheadQuickForm(props) {
  const save = async ({ name, defaultCost }) => {
    const created = await createOverhead({ overheadName: name, defaultCost, isActive: true });
    return { value: created.id, label: created.overheadName, defaultCost: created.defaultCost || 0 };
  };
  return <NameCostForm {...props} formName="quickOverhead" nameLabel="Overhead Name" placeholder="e.g. Testing, Freight, Courier" save={save} />;
}
