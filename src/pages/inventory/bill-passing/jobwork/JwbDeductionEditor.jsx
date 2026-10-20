import { useMemo, useState } from 'react';
import { Alert, Col, Form, Input, InputNumber, Modal, Radio, Row, Select } from 'antd';
import { formatCurrency } from '../../../../utils/formatters';
import { JW_DEDUCTION_TYPES, JW_DEDUCTION_TYPE_OPTIONS, uomShort } from '../../../../utils/jobWorkBillConstants';
import { lineLabel } from './jwbLineColumns';

/**
 * Add a deduction by hand, or edit one — keying the recovery rate on a proposed material-damage or shortage row
 * is the usual edit. The order's costing per garment is shown beside the rate as a reference, never a default.
 * `deduction` null = a new manual row. `onSave(values)` returns a promise; OK spins until it settles.
 */
const JwbDeductionEditor = ({ open, deduction, bill, onCancel, onSave }) => {
  const [form] = Form.useForm();
  const system = deduction?.origin === 'SYSTEM_PROPOSED';
  const typeValue = Form.useWatch('type', form);
  const lineId = Form.useWatch('lineId', form);
  const qty = Form.useWatch('qty', form);
  const rate = Form.useWatch('rate', form);
  const type = JW_DEDUCTION_TYPES[typeValue];
  const line = bill.lines.find((l) => l.id === lineId);

  // Seeded through initialValues on a Form that remounts on every open (destroyOnHidden): a setFieldsValue from
  // an effect can land before the modal has mounted its Form, and is then silently dropped.
  const initialValues = useMemo(() => (deduction
    ? { ...deduction }
    : { type: 'LATE_DELIVERY', gstTreatment: JW_DEDUCTION_TYPES.LATE_DELIVERY.gst, lineId: null }), [deduction]);

  const lineOptions = useMemo(() => bill.lines.map((l) => ({ value: l.id, label: lineLabel(l) })), [bill.lines]);
  const qtyUnit = type?.basis === 'PCS' ? 'pcs' : (line ? uomShort(line.uom) : 'units');

  const [saving, setSaving] = useState(false);
  const handleOk = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return; // the form shows what is missing
    }
    setSaving(true);
    try {
      await onSave({ ...deduction, ...values });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={deduction ? 'Edit deduction' : 'Add deduction'} width={620} destroyOnHidden
      okText="Save deduction" confirmLoading={saving} onOk={handleOk} onCancel={onCancel}>
      <Form key={deduction?.id ?? 'new'} form={form} layout="vertical" preserve={false} initialValues={initialValues}
        onValuesChange={(changed) => { if (changed.type) form.setFieldValue('gstTreatment', JW_DEDUCTION_TYPES[changed.type].gst); }}>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="type" label="Deduction" rules={[{ required: true }]}>
              <Select options={JW_DEDUCTION_TYPE_OPTIONS} disabled={system} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="lineId" label="Against line">
              <Select options={lineOptions} allowClear placeholder="The whole bill" disabled={system} />
            </Form.Item>
          </Col>
          {type?.basis ? (
            <>
              <Col xs={12} md={8}>
                <Form.Item name="qty" label={`Qty (${qtyUnit})`} rules={[{ required: true, message: 'Enter the quantity' }]}>
                  <InputNumber min={0} precision={3} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={12} md={8}>
                <Form.Item name="rate" label={type.basis === 'PCS' ? 'Recovery rate / pc ₹' : 'Rate ₹'} rules={[{ required: true, message: 'Enter the rate' }]}>
                  <InputNumber min={0} precision={4} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="Amount">
                  <Input value={formatCurrency((Number(qty) || 0) * (Number(rate) || 0))} disabled />
                </Form.Item>
              </Col>
            </>
          ) : (
            <Col xs={24} md={12}>
              <Form.Item name="amount" label="Amount ₹" rules={[{ required: true, message: 'Enter the amount' }]}>
                <InputNumber min={0} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          )}
        </Row>
        {type?.keyedRate && line?.costingRef && (
          <Alert type="info" showIcon style={{ marginBottom: 16 }}
            title={`Costing reference: ${line.costingRef.basis.toLowerCase()} ${formatCurrency(line.costingRef.perGarment)} per garment (${line.orderNo})`}
            description="The rate is yours to decide — what the damaged or missing piece is worth at this stage." />
        )}
        <Form.Item name="gstTreatment" label="GST">
          <Radio.Group options={[{ value: 'WITH_GST', label: `With GST (${bill.gstRatePercent}%)` }, { value: 'WITHOUT_GST', label: 'Without GST' }]} />
        </Form.Item>
        <Form.Item name="reason" label="Reason (printed on the debit note)" rules={[{ required: true, whitespace: true, message: 'Give the reason' }]}>
          <Input maxLength={200} />
        </Form.Item>
        <Form.Item name="remarks" label="Internal remarks" style={{ marginBottom: 0 }}>
          <Input.TextArea rows={2} maxLength={500} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default JwbDeductionEditor;
