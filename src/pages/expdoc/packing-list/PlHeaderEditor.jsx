import { useState, useMemo } from 'react';
import { Button, Form, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import { FormSection, FormInput, FormSelect, FormDatePicker } from '../../../components/form';
import { ClassifiedLabel } from '../shared/FieldClassBadge';
import { FIELD_CLASS } from '../../../utils/expDocConstants';

const { Text } = Typography;

/**
 * The header fields a packing list owns (§12.1).
 *
 * Four of the seven are OVERRIDES of a shipment value, which is the §11.3
 * "auto-editable" class: the inherited value shows as the placeholder, clearing the
 * field returns to it, and once overridden the field is tagged so a reader can see
 * at a glance that this document no longer follows its shipment.
 */
const PlHeaderEditor = ({ pl, saving, onSave }) => {
  const [form] = Form.useForm();
  const [dirty, setDirty] = useState(false);

  const initial = useMemo(() => ({
    plDate: pl.plDate ? dayjs(pl.plDate) : null,
    descriptionOfGoods: pl.descriptionOfGoods || undefined,
    marksAndNos: pl.marksAndNos || undefined,
    consigneeProfileId: pl.consigneeProfileId || undefined,
    deliveryCentre: pl.deliveryCentre || undefined,
    containerNo: pl.containerNo || undefined,
    sealNo: pl.sealNo || undefined,
    remarks: pl.remarks || undefined,
  }), [pl]);

  // No reset effect: the parent keys this on the document's version, so any save —
  // here, a refresh, a revision — remounts it with the stored values.

  const consigneeOptions = (pl.consigneeOptions || []).map((c) => ({ value: c.id, label: c.name }));

  /**
   * §11.3: these four are AUTO_EDITABLE — the shipment supplies them and this
   * document may override them. The badge says which, and the Modified marker says
   * whether this document has actually diverged.
   */
  const inherited = (key, label, inheritedValue) => (
    <ClassifiedLabel
      fieldClass={FIELD_CLASS.AUTO_EDITABLE}
      source="the shipment"
      modified={Boolean(pl.overridden?.[key])}
      originalValue={inheritedValue}
    >
      {label}
    </ClassifiedLabel>
  );

  const submit = async () => {
    const v = await form.validateFields();
    await onSave({
      ...v,
      plDate: v.plDate ? v.plDate.format('YYYY-MM-DD') : null,
    });
  };

  return (
    <Form form={form} layout="vertical" initialValues={initial} onValuesChange={() => setDirty(true)}>
      <FormSection title="Document details" columns={4}>
        <Form.Item name="plDate" label="Packing list date" rules={[{ required: true, message: 'A date is required' }]}>
          <FormDatePicker />
        </Form.Item>
        <Form.Item
          name="descriptionOfGoods"
          label={(
            <ClassifiedLabel fieldClass={FIELD_CLASS.MANUAL}>Description of goods</ClassifiedLabel>
          )}
          tooltip="Printed where the buyer's layout asks for one. Left blank, the layout falls back to its own text."
        >
          <FormInput placeholder="e.g. MEN'S KNITTED GARMENTS" />
        </Form.Item>
        <Form.Item name="marksAndNos" label={<ClassifiedLabel fieldClass={FIELD_CLASS.MANUAL}>Marks &amp; numbers</ClassifiedLabel>} tooltip="The shipping marks block. Blank prints the carton range.">
          <FormInput placeholder={pl.cartonRangeLabel || 'e.g. 1-48'} />
        </Form.Item>
        <Form.Item name="remarks" label="Remarks">
          <FormInput placeholder="Optional note printed under the totals" />
        </Form.Item>
      </FormSection>

      <FormSection title="Overrides for this document" columns={4}>
        <Form.Item
          name="consigneeProfileId"
          label={inherited('consignee', 'Consignee', pl.resolved?.consignee?.name)}
          tooltip="Only for this packing list. Leave blank to use the shipment's consignee."
        >
          <FormSelect
            allowClear
            options={consigneeOptions}
            placeholder={pl.resolved?.consignee?.name || (consigneeOptions.length ? 'Use the shipment consignee' : 'None configured for this buyer')}
            disabled={!consigneeOptions.length}
          />
        </Form.Item>
        <Form.Item name="deliveryCentre" label={inherited('deliveryCentre', 'Delivery centre', pl.resolved?.deliveryCentre)}>
          <FormInput allowClear placeholder={pl.resolved?.deliveryCentre || 'From the shipment'} />
        </Form.Item>
        <Form.Item name="containerNo" label={inherited('containerNo', 'Container no.', pl.resolved?.containerNo)}>
          <FormInput allowClear placeholder={pl.resolved?.containerNo || 'From the shipment'} />
        </Form.Item>
        <Form.Item name="sealNo" label={inherited('sealNo', 'Seal no.', pl.resolved?.sealNo)}>
          <FormInput allowClear placeholder={pl.resolved?.sealNo || 'From the shipment'} />
        </Form.Item>
      </FormSection>

      <Space size={12}>
        <Button type="primary" loading={saving} disabled={!dirty} onClick={submit}>Save details</Button>
        <Button
          disabled={!dirty || saving}
          onClick={() => { form.setFieldsValue(initial); setDirty(false); }}
        >
          Discard
        </Button>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dirty ? 'Unsaved changes.' : 'Every edit is recorded field by field in the audit trail.'}
        </Text>
      </Space>
    </Form>
  );
};

export default PlHeaderEditor;
