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
 * The name is the whole identity, and the asset ID is built from it:
 * "Sewing Machines" gives SEWINGMACH-U1-01001. Renaming later is allowed - the
 * IDs already issued keep the old name, because a sticker on a machine does not
 * change because someone edited a master.
 */
const AssetCategoryDrawer = ({ open, category, parentOptions, onClose, onSave }) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const isEdit = !!category?.id;
  const isSub = !!category?.parentId;

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
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
        <Form.Item name="parentId" label="Parent category" hidden={!isSub}>
          <Select disabled options={parentOptions} />
        </Form.Item>
        <Form.Item
          name="name"
          label="Name"
          tooltip="The first part of every asset ID under this category, shortened to ten characters: Sewing Machines gives SEWINGMACH."
          rules={[{ required: true, message: 'Name the category' }]}
        >
          <Input maxLength={100} placeholder="Sewing Machines" />
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
