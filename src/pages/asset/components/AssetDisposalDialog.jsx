import { useEffect, useState } from 'react';
import { Alert, App, Col, Form, Input, InputNumber, Modal, Row, Select } from 'antd';
import dayjs from 'dayjs';
import DateInput from '../../../components/DateInput';
import {
  createDisposal, getDisposalOptions, updateDisposal,
} from '../../../services/asset/disposalService';
import { toastUnlessHandled } from '../../../utils/apiError';
import { ASSET_CONDITION, toOptions } from '../../../utils/assetConstants';

const CONDITION_OPTIONS = toOptions(ASSET_CONDITION);

/**
 * Raise a disposal request against one asset, or correct one that was sent back.
 *
 * <p>It only raises a request. The asset is not retired until somebody else
 * approves it, which is the point of the whole workflow - and the dialog says
 * so, because "Dispose" on a button reads like it happens now.</p>
 *
 * <p>Correcting one is the same form over the same fields, so it is the same
 * dialog. Without it a request that was sent back had nowhere to go: the only
 * way on from there is to change what was wrong and send it again, and there
 * was no screen that could change anything.</p>
 */
const AssetDisposalDialog = ({ open, asset, disposal, onClose, onRaised }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState({ reasons: [], methods: [] });
  const method = Form.useWatch('method', form);

  const editing = !!disposal?.id;

  useEffect(() => {
    if (!open) return;
    getDisposalOptions().then(setOptions).catch(() => setOptions({ reasons: [], methods: [] }));
    form.setFieldsValue(editing
      ? {
        reasonCode: disposal.reasonCode,
        assetCondition: disposal.assetCondition,
        method: disposal.method,
        disposalDate: disposal.disposalDate ? dayjs(disposal.disposalDate) : undefined,
        value: disposal.value ?? undefined,
        buyerText: disposal.buyerText ?? undefined,
        remarks: disposal.remarks ?? undefined,
      }
      : { assetCondition: asset?.condition, disposalDate: undefined });
  }, [open, asset, disposal, editing, form]);

  // Scrap and sale put money somewhere, so the amount is required - the server
  // says the same, and the form mirrors it rather than letting the save fail.
  const needsValue = options.methods.find((m) => m.value === method)?.needsValue;
  const isSale = method === 'SALE';

  const submit = async (values) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        assetId: editing ? disposal.assetId : asset.id,
        disposalDate: values.disposalDate ? values.disposalDate.format('YYYY-MM-DD') : null,
      };
      const saved = editing
        ? await updateDisposal(disposal.id, { ...payload, version: disposal.version })
        : await createDisposal(payload);
      message.success(editing
        // Saving a corrected request puts it back to Draft; the server does that,
        // and saying so here stops it looking as though nothing happened.
        ? `${saved.disposalNo} saved as a draft - submit it when you are ready`
        : `Disposal request ${saved.disposalNo} raised`);
      onRaised(saved);
      form.resetFields();
    } catch (e) {
      toastUnlessHandled(message, e, editing ? 'Could not save the request' : 'Could not raise the request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={editing ? `Correct ${disposal.disposalNo}` : `Dispose ${asset?.assetId ?? ''}`}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={editing ? 'Save changes' : 'Raise request'}
      confirmLoading={saving}
      width={680}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        title={editing
          ? 'Saving puts this back to Draft'
          : 'This raises a request, it does not retire the asset'}
        description={editing
          ? 'It was sent back for correction. Change what was wrong, save it, and it returns to Draft so you can submit it again.'
          : 'The machine stays exactly as it is until somebody else approves the request. Only then does it become Disposed.'}
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
