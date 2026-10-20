import { useEffect, useState } from 'react';
import {
  App, Button, Card, Descriptions, Form, InputNumber,
} from 'antd';
import { getSettings, saveSettings } from '../../../services/tna/tnaService';
import { hasPermission } from '../../../utils/permissions';
import { RULE_VERSION } from '../../../services/tna/tnaEngine';

/** D-04, D-08, D-09 — thresholds held as configuration; the rule version is recorded on every plan (FR-12.1). */
const ThresholdsTab = () => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const canEdit = hasPermission('tna-masters', 'update');

  useEffect(() => { getSettings().then((s) => form.setFieldsValue(s)).catch((e) => message.error(e.message)); }, [form, message]);

  const submit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await saveSettings(values);
      message.success('Thresholds saved — they apply to plans generated from now on');
    } catch (e) { message.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Card size="small" style={{ maxWidth: 760 }}>
      <Descriptions size="small" column={1} bordered style={{ marginBottom: 16 }} items={[{ key: 'r', label: 'Scheduling, revision and delay rules', children: `${RULE_VERSION} — recorded on every plan it produces` }]} />
      <Form form={form} layout="vertical" disabled={!canEdit}>
        <Form.Item name="floatWarningWd" label="Float warning threshold (working days) — Amber at or below; Feasible — tight at generation (D-08)" rules={[{ required: true }]}>
          <InputNumber min={0} max={30} />
        </Form.Item>
        <Form.Item name="dueSoonWd" label="Due soon within (working days)" rules={[{ required: true }]}>
          <InputNumber min={0} max={15} />
        </Form.Item>
        <Form.Item name="materialThresholdPct" label="Default material receipt threshold % (D-04)" rules={[{ required: true }]}>
          <InputNumber min={1} max={100} />
        </Form.Item>
        <Form.Item name="productionThresholdPct" label="Default production output threshold % (D-04)" rules={[{ required: true }]}>
          <InputNumber min={1} max={100} />
        </Form.Item>
        <Form.Item name="reasonUnavailableCeilingPct" label='"Reason unavailable" ceiling % before it counts as a data-quality failure (D-09)' rules={[{ required: true }]}>
          <InputNumber min={0} max={100} />
        </Form.Item>
        {canEdit && <Button type="primary" onClick={submit} loading={saving}>Save thresholds</Button>}
      </Form>
    </Card>
  );
};

export default ThresholdsTab;
