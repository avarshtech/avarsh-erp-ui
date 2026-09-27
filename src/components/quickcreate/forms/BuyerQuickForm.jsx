import { useState } from 'react';
import { Alert, App, Form, Input } from 'antd';
import { createBuyer } from '../../../services/master/buyerService';
import QuickFormFooter from './QuickFormFooter';

/** Name, contact and email — the rest (shipping, bank) can be added later in Buyer Master. */
export default function BuyerQuickForm({ prefill, onDone, onCancel }) {
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);

  const handleFinish = async (values) => {
    setSaving(true);
    try {
      const res = await createBuyer({ ...values, shippingLocations: [] });
      const buyer = res?.data || res;
      message.success(`Buyer "${buyer.name}" created`);
      onDone(buyer);
    } catch {
      // The axios interceptor has already shown the server's message.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form name="quickBuyer" layout="vertical" initialValues={{ name: prefill.text }} onFinish={handleFinish}>
      <Alert type="info" showIcon style={{ marginBottom: 16 }} title="Shipping and bank details can be added later in Buyer Master." />
      <Form.Item name="name" label="Buyer Name" rules={[{ required: true, message: 'Buyer name is required' }]}>
        <Input autoFocus maxLength={200} />
      </Form.Item>
      <Form.Item name="contactPerson" label="Contact Person" rules={[{ required: true, message: 'Contact person is required' }]}>
        <Input placeholder="e.g. John Smith" maxLength={100} />
      </Form.Item>
      <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'A valid email is required' }]}>
        <Input placeholder="buyer@brand.com" maxLength={150} />
      </Form.Item>
      <QuickFormFooter saving={saving} onCancel={onCancel} />
    </Form>
  );
}
