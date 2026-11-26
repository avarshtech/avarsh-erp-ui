import { useEffect, useMemo, useState } from 'react';
import { Alert, App, Form, Input, Modal, Select } from 'antd';
import { changeAssetLine, getFloors } from '../../../services/asset/assetService';
import { toastUnlessHandled } from '../../../utils/apiError';

/**
 * Puts the asset on another line of the floor it is already standing on.
 *
 * Not a transfer, and deliberately not one. Unit, department and floor are where
 * an asset is, and moving between them raises a request, an approval, a challan
 * and a receipt. A line is where it stands on that floor this week: it changes
 * between styles, several times a day on a busy floor, and asking for a challan
 * each time would mean nobody recorded it at all and the register quietly stopped
 * matching the floor.
 *
 * So it is one field and a note. It cannot move the asset off its floor - the
 * list only offers lines of the floor it is on, and the server refuses the rest.
 *
 * The lines are fetched when the dialog opens rather than with the screen. This is
 * the only thing on the asset page that needs them, and most visits never open it.
 */
const AssetLineDialog = ({ open, asset, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [floors, setFloors] = useState([]);

  // An inactive line is left out, unless the asset is standing on it - in which
  // case hiding it would make the dialog look like the asset had no line at all.
  const lineOptions = useMemo(() => (floors
    .find((f) => f.id === asset?.floorId)?.lines ?? [])
    .filter((l) => l.active || l.id === asset?.lineId)
    .map((l) => ({ value: l.id, label: l.name })), [floors, asset?.floorId, asset?.lineId]);

  useEffect(() => {
    if (!open || !asset) return;
    form.setFieldsValue({ lineId: asset.lineId ?? undefined, note: undefined });
    getFloors(asset.departmentId).then(setFloors).catch(() => setFloors([]));
  }, [open, asset, form]);

  const submit = async (values) => {
    setSaving(true);
    try {
      const saved = await changeAssetLine(asset.id, { ...values, version: asset.version });
      message.success(values.lineId
        ? `${asset.assetId} is on ${lineOptions.find((l) => l.value === values.lineId)?.label ?? 'its new line'}`
        : `${asset.assetId} is no longer on a line`);
      onSaved?.(saved);
      onClose();
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not change the line');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Change line — ${asset?.assetId ?? ''}`}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Save line"
      confirmLoading={saving}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        title={`Staying on ${asset?.floorName ?? 'this floor'}`}
        description="A line change is noted in the history but is not a move. Sending the asset to another floor or department needs a transfer."
        style={{ marginBottom: 16 }}
      />
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item
          name="lineId"
          label="Line"
          extra={lineOptions.length
            ? 'Clear it to leave the asset on the floor without a line.'
            : 'This floor has no lines yet. Add them under Asset Setup.'}
        >
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            options={lineOptions}
            placeholder={lineOptions.length ? 'Select line' : 'No lines on this floor'}
            disabled={!lineOptions.length}
          />
        </Form.Item>
        <Form.Item name="note" label="Note" extra="Optional — why it moved, if it is worth saying.">
          <Input.TextArea rows={2} maxLength={250} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AssetLineDialog;
