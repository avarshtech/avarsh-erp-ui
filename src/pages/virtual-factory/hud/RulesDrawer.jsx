import { useMemo, useState } from 'react';
import { App, Button, Drawer, Form, InputNumber, Space } from 'antd';
import { isSuperuser } from '../../../utils/permissions';
import { DEFAULT_RULES, RULE_FIELDS, getAt } from '../engine/healthRules';

const GROUPS = [...new Set(RULE_FIELDS.map((f) => f.group))];
const nameOf = (path) => path.split('.');

/**
 * The Factory Health rules, for the whole organisation. Everyone can read how the score is made;
 * a superuser can change it (the server checks again and keeps the last saved version).
 */
export default function RulesDrawer({ open, onClose, rules, onSave, updatedAt }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const editable = isSuperuser();
  const weights = Form.useWatch('weights', form);
  const weightSum = useMemo(() => Object.values(weights || rules.weights).reduce((s, v) => s + (Number(v) || 0), 0), [weights, rules.weights]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ ...rules, ...form.getFieldsValue(true) });
      message.success('Factory Health rules saved for everyone');
      onClose();
    } catch {
      // the request's own error message is already shown
    } finally {
      setSaving(false);
    }
  };

  const reset = () => RULE_FIELDS.forEach((f) => form.setFieldValue(nameOf(f.path), getAt(DEFAULT_RULES, f.path)));

  return (
    <Drawer
      title="Factory Health rules"
      open={open}
      onClose={onClose}
      size={460}
      destroyOnHidden
      footer={editable ? (
        <Space style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={reset}>Use the defaults</Button>
          <Button type="primary" loading={saving} disabled={weightSum <= 0} onClick={save}>Save for everyone</Button>
        </Space>
      ) : null}
    >
      <p style={{ marginTop: 0, color: 'var(--text-secondary)' }}>
        The score combines five areas by these weights (they need not add up to 100). An area with no data today is left out.
        {updatedAt ? ` Last changed ${new Date(updatedAt).toLocaleString()}.` : ' These are the built-in defaults.'}
        {!editable && ' Only a superuser can change them.'}
      </p>
      <Form form={form} layout="horizontal" labelCol={{ span: 15 }} wrapperCol={{ span: 9 }} labelWrap initialValues={rules} disabled={!editable} size="small">
        {GROUPS.map((group) => (
          <fieldset key={group} style={{ border: 0, margin: '0 0 12px', padding: 0 }}>
            <legend style={{ fontWeight: 650, fontSize: 13, marginBottom: 6 }}>
              {group}{group === 'Score weights' ? ` (total ${weightSum})` : ''}
            </legend>
            {RULE_FIELDS.filter((f) => f.group === group).map((f) => (
              <Form.Item key={f.path} name={nameOf(f.path)} label={f.label} style={{ marginBottom: 6 }}>
                <InputNumber min={f.min} max={f.max} step={f.step || 1} suffix={f.unit} style={{ width: '100%' }} />
              </Form.Item>
            ))}
          </fieldset>
        ))}
      </Form>
    </Drawer>
  );
}
