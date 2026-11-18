import { useState, useMemo, useEffect } from 'react';
import {
  Button, Form, InputNumber, Space, Typography,
} from 'antd';
import dayjs from 'dayjs';
import { FormSection, FormInput, FormDatePicker } from '../../../components/form';
import { ClassifiedLabel } from '../shared/FieldClassBadge';
import { FIELD_CLASS } from '../../../utils/expDocConstants';
import { numericInputProps } from '../../../utils/inputHelpers';

const { Text } = Typography;
const FULL_WIDTH = { width: '100%' };

/**
 * The header fields a packing list owns (§12.1).
 *
 * The container no. is an OVERRIDE of a shipment value, which is the §11.3
 * "auto-editable" class: the inherited value shows as the placeholder, clearing the
 * field returns to it, and once overridden the field is tagged so a reader can see
 * at a glance that this document no longer follows its shipment. The seal no. is
 * the document's own — the shipment no longer carries one. The consignee is always
 * the shipment's (the buyer), so there is nothing to override.
 *
 * The shipping tolerance is the list's own (`ownTolerancePercent`): blank is none of its own,
 * and the default applies, shown greyed while the list has none. Saving a blank never writes
 * the default onto the list.
 */
const PlHeaderEditor = ({ pl, saving, onSave, onDirtyChange }) => {
  const [form] = Form.useForm();
  const [dirty, setDirty] = useState(false);

  const initial = useMemo(() => ({
    plDate: pl.plDate ? dayjs(pl.plDate) : null,
    descriptionOfGoods: pl.descriptionOfGoods || undefined,
    marksAndNos: pl.marksAndNos || undefined,
    containerNo: pl.containerNo || undefined,
    sealNo: pl.sealNo || undefined,
    remarks: pl.remarks || undefined,
    ownTolerancePercent: pl.ownTolerancePercent ?? null,
  }), [pl]);
  // The default the list works with while it has no tolerance of its own (the API sends the one in force)
  const defaultTolerance = pl.ownTolerancePercent == null ? pl.tolerancePercent : null;

  // Keyed on the document, not its version: an action elsewhere on the list (adding packing,
  // renumbering) must not wipe an edit in progress here. A revision is a new document.

  // Lifted so the workspace's Exit can warn before discarding an edit. Reported on
  // mount too, which is what clears the flag after a save remounts this.
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  /**
   * §11.3: AUTO_EDITABLE — the shipment supplies the value and this document may
   * override it. The badge says which, and the Modified marker says whether this
   * document has actually diverged.
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
    const saved = await onSave({
      ...v,
      plDate: v.plDate ? v.plDate.format('YYYY-MM-DD') : null,
    });
    // Saved: what is on screen is now the document's own
    if (saved) setDirty(false);
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
        <Form.Item
          name="ownTolerancePercent"
          label="Shipping tolerance %"
          tooltip="How far packed quantities may differ from the order before the list warns (short or excess). Blank uses the default."
          extra={pl.toleranceCarriedFrom ? `From ${pl.toleranceCarriedFrom}, this buyer's last packing list` : undefined}
        >
          {/* Not FormInputNumber: it turns a blank into 0 on blur, and blank here means the default */}
          <InputNumber
            controls={false}
            {...numericInputProps}
            min={0}
            max={100}
            precision={2}
            style={FULL_WIDTH}
            placeholder={defaultTolerance == null ? 'Default' : `${defaultTolerance} (default)`}
          />
        </Form.Item>
      </FormSection>

      <FormSection title="Container" columns={4}>
        <Form.Item name="containerNo" label={inherited('containerNo', 'Container no.', pl.resolved?.containerNo)}>
          <FormInput allowClear placeholder={pl.resolved?.containerNo || 'From the shipment'} />
        </Form.Item>
        <Form.Item name="sealNo" label={<ClassifiedLabel fieldClass={FIELD_CLASS.MANUAL}>Seal no.</ClassifiedLabel>}>
          <FormInput allowClear />
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
