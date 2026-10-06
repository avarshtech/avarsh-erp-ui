import { useState } from 'react';
import { Alert, App, Form, Input, Select } from 'antd';
import { createVendor } from '../../../services/master/vendorService';
import useVendorProcesses from '../../../hooks/useVendorProcesses';
import { toastUnlessHandled } from '../../../utils/apiError';
import QuickFormFooter from './QuickFormFooter';

/**
 * Enough to name a job worker or CMT unit on a costing manufacturing row: a name and the process it
 * does, pre-filled with the row's own (a vendor needs at least one). GSTIN, approval and bank details
 * are completed on Master Data › Vendors.
 */
export default function VendorQuickForm({ prefill, onDone, onCancel }) {
  const { message } = App.useApp();
  const processes = useVendorProcesses();
  const [saving, setSaving] = useState(false);

  const handleFinish = async (values) => {
    setSaving(true);
    try {
      const res = await createVendor({ ...values, active: true });
      const vendor = res?.data || res;
      message.success(`Vendor "${vendor.name}" created`);
      onDone(vendor);
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not create the vendor');
    } finally {
      setSaving(false);
    }
  };

  const initialValues = { name: prefill.text, processIds: prefill.processId ? [prefill.processId] : [] };
  return (
    <Form name="quickVendor" layout="vertical" initialValues={initialValues} onFinish={handleFinish}>
      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        title="Complete the GSTIN, job-work approval and bank details in Master Data › Vendors." />
      <Form.Item name="name" label="Vendor Name" rules={[{ required: true, whitespace: true, message: 'Vendor name is required' }]}>
        <Input autoFocus maxLength={255} />
      </Form.Item>
      <Form.Item name="processIds" label="Processes it does"
        rules={[{ required: true, type: 'array', min: 1, message: 'Select at least one process this vendor does' }]}>
        <Select mode="multiple" placeholder="Pick the processes" options={processes.options} loading={processes.loading}
          optionFilterProp="label" maxTagCount="responsive" labelRender={({ value, label }) => label ?? processes.nameOf(value)} />
      </Form.Item>
      <Form.Item name="contactPerson" label="Contact Person">
        <Input maxLength={100} />
      </Form.Item>
      <Form.Item name="phone" label="Phone" rules={[{ pattern: /^[0-9+\-\s]{6,20}$/, message: 'Enter a valid phone number' }]}>
        <Input maxLength={20} />
      </Form.Item>
      <Form.Item name="city" label="City">
        <Input maxLength={100} />
      </Form.Item>
      <QuickFormFooter saving={saving} onCancel={onCancel} />
    </Form>
  );
}
