import { useState } from 'react';
import { Modal, Form, Input, Alert, App } from 'antd';
import { mapWholePo } from '../../../services/po/poOrderMappingService';
import OrderSelect from './OrderSelect';

/** Shortcut for the common case: everything still open on this PO goes to one order. */
const MapWholePoModal = ({ open, po, onClose, onMapped }) => {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);

  const openLines = (po?.lineItems || []).filter((l) => l.unmappedQty > 0).length;

  const handleOk = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const updated = await mapWholePo({ poId: po.id, ...values });
      message.success(`${po.poNumber} mapped to the selected order`);
      form.resetFields();
      onMapped(updated);
    } catch (e) {
      message.error(e.message || 'Could not map the purchase order');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`Map entire PO ${po?.poNumber || ''} to one order`}
      okText="Map all open quantity"
      onOk={handleOk}
      onCancel={() => { form.resetFields(); onClose(); }}
      okButtonProps={{ loading: saving, disabled: openLines === 0 }}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={`${openLines} line${openLines === 1 ? '' : 's'} with open quantity will be mapped in full. Lines already fully mapped are untouched.`}
      />
      <Form form={form} layout="vertical">
        <Form.Item name="orderId" label="Customer order" rules={[{ required: true, message: 'Pick an order' }]}>
          <OrderSelect disabled={saving} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="remarks" label="Remarks">
          <Input.TextArea rows={2} maxLength={200} showCount placeholder="Why this PO belongs to the order (optional)" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default MapWholePoModal;
