import { useEffect, useState } from 'react';
import { Alert, App, Col, Form, Input, InputNumber, Modal, Row, Select } from 'antd';
import DateInput from '../../../components/DateInput';
import { createDisposal, getDisposalOptions } from '../../../services/asset/disposalService';
import { toastUnlessHandled } from '../../../utils/apiError';
import { ASSET_CONDITION, toOptions } from '../../../utils/assetConstants';

const CONDITION_OPTIONS = toOptions(ASSET_CONDITION);

/**
 * Raise a disposal request against one asset.
 *
 * <p>It only raises a request. The asset is not retired until somebody else
 * approves it, which is the point of the whole workflow - and the dialog says
 * so, because "Dispose" on a button reads like it happens now.</p>
 */
const AssetDisposalDialog = ({ open, asset, onClose, onRaised }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState({ reasons: [], methods: [] });
  const method = Form.useWatch('method', form);

  useEffect(() => {
    if (!open) return;
    getDisposalOptions().then(setOptions).catch(() => setOptions({ reasons: [], methods: [] }));
    form.setFieldsValue({ assetCondition: asset?.condition, disposalDate: undefined });
  }, [open, asset, form]);

  // Scrap and sale put money somewhere, so the amount is required - the server
  // says the same, and the form mirrors it rather than letting the save fail.
  const needsValue = options.methods.find((m) => m.value === method)?.needsValue;
  const isSale = method === 'SALE';

  const submit = async (values) => {
    setSaving(true);
    try {
      const saved = await createDisposal({
        ...values,
        assetId: asset.id,
        disposalDate: values.disposalDate ? values.disposalDate.format('YYYY-MM-DD') : null,
      });
      message.success(`Disposal request ${saved.disposalNo} raised`);
      onRaised(saved);
      form.resetFields();
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not raise the request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Dispose ${asset?.assetId ?? ''}`}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Raise request"
      confirmLoading={saving}
      width={680}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        title="This raises a request, it does not retire the asset"
        description="The machine stays exactly as it is until somebody else approves the request. Only then does it become Disposed."
        style={{ marginBottom: 16 }}
      />
      <Form form={form} layout="vertical" onFinish={submit}>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="reasonCode" label="Reason" rules={[{ required: true, message: 'Pick a reason' }]}>
              <Select options={options.reasons} placeholder="Why is it going?" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="assetCondition"
              label="Condition"
              rules={[{ required: true, message: 'Pick the condition' }]}
            >
              <Select options={CONDITION_OPTIONS} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="method" label="Method" rules={[{ required: true, message: 'Pick the method' }]}>
              <Select options={options.methods} placeholder="How is it going?" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="disposalDate" label="Date" rules={[{ required: true, message: 'Pick the date' }]}>
              <DateInput />
            </Form.Item>
          </Col>
          {needsValue && (
            <Col xs={24} sm={12}>
              <Form.Item
                name="value"
                label="Amount"
                tooltip="Zero is a perfectly good answer; blank is not. Finance posts against it."
                rules={[{ required: true, message: 'Enter the amount, even if it is zero' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="₹" />
              </Form.Item>
            </Col>
          )}
          {isSale && (
            <Col xs={24} sm={12}>
              <Form.Item name="buyerText" label="Buyer" rules={[{ required: true, message: 'Record who bought it' }]}>
                <Input maxLength={150} />
              </Form.Item>
            </Col>
          )}
          <Col xs={24}>
            <Form.Item name="remarks" label="Remarks">
              <Input.TextArea rows={2} maxLength={500} showCount />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default AssetDisposalDialog;
