import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Drawer, Form, Input, Select, Switch, Button, Card, Space, Row, Col, Alert, App,
} from 'antd';
import {
  getReportCatalog, createReportFromBlueprint, updateReportFromBlueprint, getReportDefinition,
} from '../../../services/core/reportService';
import { getModuleLabel } from '../../../utils/reportConstants';
import ReportColumnPicker from './ReportColumnPicker';

const { TextArea } = Input;

const toCode = (name) => name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

/** Admin-only designer: compose a report from a curated data source. Sends no SQL. */
const ReportDesignerDrawer = ({ open, onClose, onSaved, editingReport }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selection, setSelection] = useState({});
  const dataSourceKey = Form.useWatch('dataSourceKey', form);

  const isEditing = !!editingReport;
  const source = useMemo(
    () => catalog.find((s) => s.key === dataSourceKey) || null,
    [catalog, dataSourceKey],
  );

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getReportCatalog()
      .then((data) => setCatalog(data || []))
      .catch(() => message.error('Failed to load the report catalog'))
      .finally(() => setLoading(false));
  }, [open, message]);

  useEffect(() => {
    if (!open) return;
    if (!editingReport) {
      form.resetFields();
      form.setFieldsValue({ active: true });
      setSelection({});
      return;
    }
    getReportDefinition(editingReport.id)
      .then((def) => {
        form.setFieldsValue({
          dataSourceKey: def.dataSourceKey,
          displayName: def.displayName,
          reportCode: def.reportCode,
          description: def.description,
          active: def.isActive !== false,
        });
        setSelection(Object.fromEntries((def.fields || []).map((f) => [f.fieldCode, {
          isDefault: f.isDefault !== false,
          isFilterable: f.isFilterable === true,
          isSortable: f.isSortable !== false,
        }])));
      })
      .catch(() => message.error('Failed to load the report'));
  }, [open, editingReport, form, message]);

  const handleSourceChange = useCallback((key) => {
    const next = catalog.find((s) => s.key === key);
    // Default to the source's headline columns so a report is one click from useful
    setSelection(Object.fromEntries((next?.columns || [])
      .filter((c) => c.defaultVisible)
      .map((c) => [c.key, { isDefault: true, isFilterable: false, isSortable: c.sortable }])));
  }, [catalog]);

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const columns = (source?.columns || [])
        .filter((c) => selection[c.key])
        .map((c) => ({ key: c.key, ...selection[c.key] }));
      if (!columns.length) {
        message.error('Select at least one column');
        return;
      }
      setSubmitting(true);
      const payload = { ...values, description: values.description || null, columns };
      if (isEditing) {
        await updateReportFromBlueprint(editingReport.id, payload);
        message.success('Report updated');
      } else {
        await createReportFromBlueprint(payload);
        message.success('Report created');
      }
      onSaved?.();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Failed to save the report');
    } finally {
      setSubmitting(false);
    }
  }, [form, source, selection, isEditing, editingReport, onSaved, message]);

  return (
    <Drawer
      title={isEditing ? 'Edit Report' : 'New Report'}
      open={open}
      onClose={onClose}
      width={1000}
      destroyOnHidden
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={submitting} onClick={handleSubmit}>
            {isEditing ? 'Update' : 'Create'}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" disabled={loading}>
        <Card size="small" title="Report" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 0]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="dataSourceKey"
                label="Data Source"
                rules={[{ required: true, message: 'Select a data source' }]}
              >
                <Select
                  placeholder="What should this report be about?"
                  loading={loading}
                  disabled={isEditing}
                  onChange={handleSourceChange}
                  options={catalog.map((s) => ({
                    value: s.key,
                    label: `${getModuleLabel(s.module)} · ${s.label}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="displayName"
                label="Report Name"
                rules={[{ required: true, message: 'Enter a report name' }]}
              >
                <Input
                  placeholder="e.g. Pending Orders by Buyer"
                  onChange={(e) => {
                    if (!isEditing) form.setFieldValue('reportCode', toCode(e.target.value));
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[16, 0]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="reportCode"
                label="Report Code"
                tooltip="Unique identifier. Generated from the name — change it only if you need to."
                rules={[{ required: true, message: 'Enter a report code' }]}
              >
                <Input placeholder="PENDING_ORDERS_BY_BUYER" disabled={isEditing} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="active" label="Active" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <TextArea rows={2} placeholder="What this report shows and when to use it" />
          </Form.Item>
          {source?.description && (
            <Alert type="info" showIcon message={source.description} style={{ marginTop: 4 }} />
          )}
        </Card>

        <Card size="small" title="Columns">
          <ReportColumnPicker
            columns={source?.columns || []}
            value={selection}
            onChange={setSelection}
          />
        </Card>
      </Form>
    </Drawer>
  );
};

export default ReportDesignerDrawer;
