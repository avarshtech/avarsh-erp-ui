import { memo, useState } from 'react';
import { Drawer, Form, Input, Button, Typography, Space, App } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { saveReport } from '../../../services/core/reportService';

const { Text } = Typography;

const SaveReportDrawer = memo(function SaveReportDrawer({
  open,
  onClose,
  reportDefId,
  selectedFields = [],
  appliedFilters = {},
  sortConfig,
  onSaved,
}) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const { message } = App.useApp();

  const activeFilterCount = Object.values(appliedFilters).filter(
    (v) => v !== null && v !== undefined && v !== ''
  ).length;

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await saveReport({
        savedName: values.name,
        reportDefId: reportDefId,
        selectedFields,
        appliedFilters,
        sortConfig,
      });
      message.success('Report saved successfully');
      form.resetFields();
      onSaved?.();
      onClose();
    } catch (err) {
      if (err.errorFields) return; // validation error — Ant handles display
      // API error already shown by axiosInstance
    } finally {
      setSaving(false);
    }
  };

  const handleAfterClose = () => {
    form.resetFields();
  };

  return (
    <Drawer
      title="Save Report Configuration"
      open={open}
      onClose={onClose}
      afterOpenChange={(isOpen) => { if (!isOpen) handleAfterClose(); }}
      width={400}
      footer={
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
            >
              Save Report
            </Button>
          </Space>
        </div>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="Report Name"
          rules={[{ required: true, message: 'Please enter a report name' }]}
        >
          <Input placeholder="e.g. Monthly Order Summary" maxLength={100} />
        </Form.Item>
      </Form>

      <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>Configuration Summary</Text>
        <div style={{ marginTop: 8 }}>
          <Text style={{ display: 'block', fontSize: 13 }}>
            Columns selected: <strong>{selectedFields.length}</strong>
          </Text>
          <Text style={{ display: 'block', fontSize: 13 }}>
            Filters applied: <strong>{activeFilterCount}</strong>
          </Text>
        </div>
      </div>
    </Drawer>
  );
});

export default SaveReportDrawer;
