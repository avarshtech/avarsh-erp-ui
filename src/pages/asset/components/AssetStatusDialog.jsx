import { useEffect, useState } from 'react';
import { Alert, App, Form, Input, Modal, Select } from 'antd';
import { changeAssetStatus } from '../../../services/asset/assetService';
import { toastUnlessHandled } from '../../../utils/apiError';
import {
  ASSET_CONDITION, ASSET_STATUS, EDITABLE_STATUSES, NEEDS_REASON, STATUS_REASON, toOptions,
} from '../../../utils/assetConstants';

/**
 * Moves an asset to a new state, and makes it say why.
 *
 * Its own dialog rather than two more fields on Edit Asset, because this is a
 * decision about the machine rather than a correction to its record - and
 * because it is the one that has to be explained. "Idle" on its own tells a
 * manager nothing: idle for want of orders is a sales problem, idle for want of
 * an operator is a hiring problem, and the register cannot tell them apart
 * unless the reason is captured at the moment somebody knows it.
 */

const STATUS_OPTIONS = toOptions(ASSET_STATUS, EDITABLE_STATUSES);
const CONDITION_OPTIONS = toOptions(ASSET_CONDITION);
const REASON_OPTIONS = Object.entries(STATUS_REASON).map(([value, label]) => ({ value, label }));

const AssetStatusDialog = ({ open, asset, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const status = Form.useWatch('status', form);
  const reasonCode = Form.useWatch('reasonCode', form);

  // The server requires a reason for the states that stop an asset earning;
  // this mirrors it so the user is told before the round trip, not after.
  const reasonRequired = NEEDS_REASON.includes(status);

  useEffect(() => {
    if (!open || !asset) return;
    form.setFieldsValue({
      status: asset.status,
      condition: asset.condition,
      reasonCode: asset.statusReasonCode ?? undefined,
      reasonText: asset.statusReasonText ?? undefined,
    });
  }, [open, asset, form]);

  const submit = async (values) => {
    setSaving(true);
    try {
      const saved = await changeAssetStatus(asset.id, { ...values, version: asset.version });
      message.success(`${asset.assetId} is now ${ASSET_STATUS[values.status]?.label ?? values.status}`);
      onSaved?.(saved);
      onClose();
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not change the status');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Change status — ${asset?.assetId ?? ''}`}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Save status"
      confirmLoading={saving}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        title="This is recorded"
        description="Every status change is kept with its reason and the date, so the register can answer how long a machine has been standing and why."
        style={{ marginBottom: 16 }}
      />
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item name="status" label="Status" rules={[{ required: true, message: 'Pick the status' }]}>
          <Select options={STATUS_OPTIONS} />
        </Form.Item>
        <Form.Item name="condition" label="Condition">
          <Select options={CONDITION_OPTIONS} allowClear placeholder="Unchanged" />
        </Form.Item>
        <Form.Item
          name="reasonCode"
          label="Reason"
          rules={reasonRequired ? [{ required: true, message: 'Say why' }] : undefined}
          extra={reasonRequired ? 'Required: this status stops the asset earning.' : 'Optional.'}
        >
          <Select options={REASON_OPTIONS} allowClear showSearch optionFilterProp="label" placeholder="Select a reason" />
        </Form.Item>
        <Form.Item
          name="reasonText"
          label="Notes"
          // "Other" with no description records nothing at all, which is worse
          // than leaving the reason blank: it looks answered.
          rules={reasonCode === 'OTHER' ? [{ required: true, message: 'Describe the reason, since it is Other' }] : undefined}
        >
          <Input.TextArea rows={2} maxLength={500} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AssetStatusDialog;
