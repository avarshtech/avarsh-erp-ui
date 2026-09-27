import { useState } from 'react';
import { App, Form, Input, Select } from 'antd';
import { createSizePreset } from '../../../services/master/sizePresetService';
import QuickFormFooter from './QuickFormFooter';

const normalise = (sizes) => [...new Set((sizes || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean))];

/** A named run of sizes, e.g. "Kids 2-12Y" = 2Y, 4Y, 6Y… Returned whole so the sheet can select its sizes. */
export default function SizePresetQuickForm({ prefill, onDone, onCancel }) {
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);

  const handleFinish = async ({ name, sizes, category }) => {
    setSaving(true);
    try {
      const res = await createSizePreset({ name: name.trim(), category: category || null, sizes: normalise(sizes), active: true });
      const preset = res?.data || res;
      message.success(`Size preset "${preset.name}" created`);
      onDone(preset);
    } catch {
      // The axios interceptor has already shown the server's message.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form name="quickSizePreset" layout="vertical" initialValues={{ name: prefill.text, sizes: prefill.sizes }} onFinish={handleFinish}>
      <Form.Item name="name" label="Preset Name" rules={[{ required: true, message: 'Preset name is required' }]}>
        <Input autoFocus placeholder='e.g. "Mens S-XXL"' maxLength={100} />
      </Form.Item>
      <Form.Item name="sizes" label="Sizes" extra="Type a size and press Enter, in the order they run."
        rules={[{ required: true, message: 'Add at least one size' }]}>
        <Select mode="tags" tokenSeparators={[',', ' ']} open={false} placeholder="S, M, L, XL" />
      </Form.Item>
      <Form.Item name="category" label="Category">
        <Input placeholder="e.g. Mens, Womens, Kids" maxLength={50} />
      </Form.Item>
      <QuickFormFooter saving={saving} onCancel={onCancel} okText="Create & use" />
    </Form>
  );
}
