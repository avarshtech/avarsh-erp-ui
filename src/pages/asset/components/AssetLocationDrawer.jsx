import { useEffect, useState } from 'react';
import { Button, Drawer, Form, Input, Select, Space, Switch } from 'antd';

/** Add or edit a section or a line - the same four fields either way. */
const AssetLocationDrawer = ({ drawer, departmentOptions, sectionOptions, onClose, onSave }) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const open = !!drawer;
  const isSection = drawer?.kind === 'section';
  const record = drawer?.record;
  const isEdit = !!record?.id;

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      code: record?.code,
      name: record?.name,
      departmentId: record?.departmentId,
      sectionId: record?.sectionId,
      active: record?.active ?? true,
    });
  }, [open, record, form]);

  const submit = async (values) => {
    setSaving(true);
    try {
      await onSave({ ...values, code: values.code?.toUpperCase() });
    } catch {
      // Reported by onSave; the drawer stays open so nothing typed is lost.
    } finally {
      setSaving(false);
    }
  };

  const noun = isSection ? 'section' : 'line';

  return (
    <Drawer
      title={`${isEdit ? 'Edit' : 'Add'} ${noun}`}
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
        {isSection ? (
          <Form.Item
            name="departmentId"
            label="Department"
            tooltip="Fixed once assets sit in this section - moving it would relocate them without a transfer."
            rules={[{ required: true, message: 'Pick the department' }]}
          >
            <Select showSearch optionFilterProp="label" options={departmentOptions} placeholder="Select department" />
          </Form.Item>
        ) : (
          <Form.Item name="sectionId" label="Section" rules={[{ required: true, message: 'Pick the section' }]}>
            <Select showSearch optionFilterProp="label" options={sectionOptions} placeholder="Select section" />
          </Form.Item>
        )}
        <Form.Item name="code" label="Code" rules={[{ required: true, message: `Give the ${noun} a code` }]}>
          <Input maxLength={20} style={{ textTransform: 'uppercase' }} placeholder={isSection ? 'OVR' : 'L05'} />
        </Form.Item>
        <Form.Item name="name" label="Name" rules={[{ required: true, message: `Name the ${noun}` }]}>
          <Input maxLength={100} placeholder={isSection ? 'Overlock' : 'Line 05'} />
        </Form.Item>
        <Form.Item name="active" label="Active" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default AssetLocationDrawer;
