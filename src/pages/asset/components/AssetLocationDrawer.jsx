import { useEffect, useState } from 'react';
import { Button, Drawer, Form, Input, Select, Space, Switch } from 'antd';

/**
 * Add or edit a line.
 *
 * Only lines: floors moved to HR Masters with the units and departments, because
 * the people standing on a floor are filed against the same record as the machines.
 */
const AssetLocationDrawer = ({ drawer, floorOptions, onClose, onSave }) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const open = !!drawer;
  const record = drawer?.record;
  const isEdit = !!record?.id;

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      name: record?.name,
      floorId: record?.floorId,
      active: record?.active ?? true,
    });
  }, [open, record, form]);

  const submit = async (values) => {
    setSaving(true);
    try {
      await onSave(values);
    } catch {
      // Reported by onSave; the drawer stays open so nothing typed is lost.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={`${isEdit ? 'Edit' : 'Add'} line`}
      open={open}
      onClose={onClose}
      size={420}
      destroyOnHidden
      footer={(
        <Space>
          <Button type="primary" loading={saving} onClick={() => form.submit()}>Save</Button>
          <Button onClick={onClose}>Cancel</Button>
        </Space>
      )}
    >
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item
          name="floorId"
          label="Floor"
          tooltip="Fixed once assets are on this line - moving it would relocate them without a transfer."
          rules={[{ required: true, message: 'Pick the floor' }]}
        >
          <Select showSearch optionFilterProp="label" options={floorOptions} placeholder="Select floor" />
        </Form.Item>
        <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name the line' }]}>
          <Input maxLength={100} placeholder="Line 05" />
        </Form.Item>
        <Form.Item name="active" label="Active" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default AssetLocationDrawer;
