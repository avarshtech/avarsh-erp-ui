import { useEffect, useState } from 'react';
import {
  Alert, Button, Drawer, Form, Input, InputNumber, Select, Space, Switch,
} from 'antd';
import AssetFieldDefEditor from './AssetFieldDefEditor';

const parseDefs = (json) => {
  try { return JSON.parse(json || '[]'); } catch { return []; }
};

/**
 * Add or edit a category.
 *
 * The code is the one field that cannot be corrected later once the category
 * owns assets: it is the first part of every asset ID already printed under it.
 * The server refuses the change; this says so before the user tries.
 */
const AssetCategoryDrawer = ({ open, category, parentOptions, onClose, onSave }) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const isEdit = !!category?.id;
  const isSub = !!category?.parentId;

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      code: category?.code,
      name: category?.name,
      parentId: category?.parentId ?? undefined,
      assignable: category?.assignable ?? false,
      maintIntervalDays: category?.maintIntervalDays ?? undefined,
      fieldDefs: parseDefs(category?.fieldDefs),
      active: category?.active ?? true,
    });
  }, [open, category, form]);

  const submit = async (values) => {
    setSaving(true);
    try {
      await onSave({
        ...values,
        code: values.code?.toUpperCase(),
        // Every field needs the shape the server validates: options only mean
        // something for a dropdown, so the rest send an empty list.
        fieldDefs: (values.fieldDefs ?? []).map((def) => ({
          key: def.key, label: def.label, type: def.type,
          options: def.type === 'SELECT' ? (def.options ?? []) : [],
          required: !!def.required,
        })),
      });
    } catch {
      // onSave reported it; keep the drawer open so the user does not lose the form.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={isEdit ? `Edit ${category.name}` : isSub ? 'Add sub-category' : 'Add category'}
      open={open}
      onClose={onClose}
      size={640}
      destroyOnHidden
      footer={(
        <Space>
          <Button type="primary" loading={saving} onClick={() => form.submit()}>Save</Button>
          <Button onClick={onClose}>Cancel</Button>
        </Space>
      )}
    >
      <Form form={form} layout="vertical" onFinish={submit}>
        {isEdit && (
          <Alert
            type="info"
            showIcon
            title="The code is fixed once this category has assets"
            description="It is the first part of every asset ID printed under it, so changing it would orphan those stickers."
            style={{ marginBottom: 16 }}
          />
        )}
        <Form.Item name="parentId" label="Parent category" hidden={!isSub}>
          <Select disabled options={parentOptions} />
        </Form.Item>
        <Form.Item
          name="code"
          label="Code"
          tooltip="2-10 capitals or digits. Becomes the asset ID prefix: SEW-U1-01001."
          rules={[
            { required: true, message: 'Give the category a code' },
            { pattern: /^[A-Za-z0-9]{2,10}$/, message: '2 to 10 letters or digits, no spaces' },
          ]}
        >
          <Input maxLength={10} style={{ textTransform: 'uppercase' }} placeholder="SEW" />
        </Form.Item>
        <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name the category' }]}>
          <Input maxLength={100} placeholder="Sewing machines" />
        </Form.Item>
        <Form.Item
          name="assignable"
          label="Can be issued to a person"
          valuePropName="checked"
          tooltip="A laptop can be issued; a compressor bolted to the floor cannot."
        >
          <Switch />
        </Form.Item>
        <Form.Item
          name="maintIntervalDays"
          label="Service interval (days)"
          tooltip="Used as the default when maintenance is logged. Leave blank if there is no schedule."
        >
          <InputNumber min={1} max={3650} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="active" label="Active" valuePropName="checked">
          <Switch />
        </Form.Item>

        <AssetFieldDefEditor />
      </Form>
    </Drawer>
  );
};

export default AssetCategoryDrawer;
