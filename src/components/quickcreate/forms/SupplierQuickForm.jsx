import { useState } from 'react';
import { Alert, App, Form, Input } from 'antd';
import { createSupplier } from '../../../services/master/supplierService';
import QuickFormFooter from './QuickFormFooter';

/**
 * Enough to name a job-work vendor on a costing row. Address, PAN and GSTIN are needed before a
 * purchase order is raised to them, and are completed in Supplier Master.
 */
export default function SupplierQuickForm({ prefill, onDone, onCancel }) {
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);

  const handleFinish = async (values) => {
    setSaving(true);
    try {
      const res = await createSupplier(values);
      const supplier = res?.data || res;
      message.success(`Vendor "${supplier.name}" created`);
      onDone(supplier);
    } catch {
      // The axios interceptor has already shown the server's message.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form name="quickSupplier" layout="vertical" initialValues={{ name: prefill.text }} onFinish={handleFinish}>
      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        title="Complete the address, PAN and GSTIN in Supplier Master before raising a PO to this vendor." />
      <Form.Item name="name" label="Vendor Name" rules={[{ required: true, message: 'Vendor name is required' }]}>
        <Input autoFocus maxLength={200} />
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
