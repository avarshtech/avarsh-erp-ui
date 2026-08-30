import { useEffect, useState } from 'react';
import { App, Button, Col, DatePicker, Drawer, Form, Input, Row, Select, Statistic, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { saveTemplate } from '../../../services/tna/tnaService';
import { forwardPass } from '../../../services/tna/tnaScheduler';
import { MODAL_WIDTHS, DATE_FORMAT } from '../../../utils/uiConstants';
import { PRODUCT_TYPES } from '../../../services/tna/tnaMockData';
import TemplateLineTable from './TemplateLineTable';

const BUYERS = ['H&M', 'Zara', 'Decathlon', 'Primark', 'M&S', 'Uniqlo', 'Tesco F&F', 'C&A'];

/** §7.2/§7.3 — template builder. Critical path and floor are DERIVED, never keyed in. */
const TemplateBuilder = ({ open, template, activities, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [lines, setLines] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !template) return;
    setLines(template.lines.map((l) => ({ ...l })));
    form.setFieldsValue({ ...template, effectiveFrom: template.effectiveFrom ? dayjs(template.effectiveFrom) : null });
  }, [open, template, form]);

  // Live derived figures (§7.2) — recomputed as the lines are edited
  const criticalPath = lines.length ? forwardPass(lines.map((l) => ({ ...l, effectiveDays: l.baseDays }))).criticalPath : 0;
  const floor = lines.length ? forwardPass(lines.map((l) => ({ ...l, effectiveDays: l.fixed ? l.baseDays : l.minDays }))).criticalPath : 0;

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await saveTemplate({ ...template, ...values, effectiveFrom: values.effectiveFrom?.format('YYYY-MM-DD'), lines });
      message.success(`${values.templateName} saved — a new template version was created`);
      onSaved();
    } catch (e) {
      if (!e?.errorFields) message.error(e.message || 'Template validation failed');
    } finally { setSaving(false); }
  };

  return (
    <Drawer
      title={template?.id ? `Template — ${template.templateCode}` : 'New Template'}
      open={open}
      onClose={onClose}
      size={MODAL_WIDTHS.XLARGE}
      destroyOnHidden
      extra={<Button type="primary" loading={saving} onClick={handleSave}>Validate & save</Button>}
    >
      <Form form={form} layout="vertical">
        <Row gutter={[16, 0]}>
          <Col xs={12} md={5}><Form.Item name="templateCode" label="Code" rules={[{ required: true }]}><Input maxLength={15} disabled={!!template?.id} /></Form.Item></Col>
          <Col xs={12} md={7}><Form.Item name="templateName" label="Name" rules={[{ required: true }]}><Input maxLength={100} /></Form.Item></Col>
          <Col xs={12} md={4}><Form.Item name="buyer" label="Buyer" tooltip="Blank = any buyer"><Select allowClear options={BUYERS.map((b) => ({ value: b, label: b }))} /></Form.Item></Col>
          <Col xs={12} md={4}><Form.Item name="productType" label="Product type" tooltip="Blank = any product type"><Select allowClear options={PRODUCT_TYPES.map((p) => ({ value: p, label: p }))} /></Form.Item></Col>
          <Col xs={12} md={4}><Form.Item name="effectiveFrom" label="Effective from"><DatePicker style={{ width: '100%' }} format={DATE_FORMAT} /></Form.Item></Col>
        </Row>
      </Form>
      <Row gutter={16} style={{ marginBottom: 14 }}>
        <Col>
          <Tooltip title="Critical path length at 100% scale — derived by the engine on every save, governs the percentage conversion">
            <Statistic title="Baseline critical path" value={criticalPath} suffix="days" valueStyle={{ fontSize: 20, color: 'var(--primary-color)' }} />
          </Tooltip>
        </Col>
        <Col>
          <Tooltip title="Critical path with every activity at its floor — any order below this cannot be planned and is flagged infeasible">
            <Statistic title="Minimum feasible leadtime" value={floor} suffix="days" valueStyle={{ fontSize: 20, color: 'var(--error-color)' }} />
          </Tooltip>
        </Col>
      </Row>
      <TemplateLineTable lines={lines} activities={activities} onChange={setLines} readOnly={template?.inUse} />
      {template?.inUse && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
          This template is in use by live plans — lines are read-only (VR-17). Save creates a new version; existing plans are never regenerated.
        </div>
      )}
    </Drawer>
  );
};

export default TemplateBuilder;
