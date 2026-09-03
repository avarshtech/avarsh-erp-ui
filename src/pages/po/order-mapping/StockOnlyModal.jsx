import { useState } from 'react';
import { Modal, Form, Input, Alert, App } from 'antd';
import { setStockOnly } from '../../../services/po/poOrderMappingService';

/**
 * Marks a General PO as deliberately unmapped ("Stock Only") so it leaves the
 * open queue, or clears that flag. A remark is required when marking.
 */
const StockOnlyModal = ({ open, po, onClose, onSaved }) => {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);
  const marking = !po?.stockOnly;

  const handleOk = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await setStockOnly({ poId: po.id, stockOnly: marking, remark: values.remark });
      message.success(marking ? `${po.poNumber} marked as Stock Only` : `${po.poNumber} is open for mapping again`);
      form.resetFields();
      onSaved();
    } catch (e) {
      message.error(e.message || 'Could not update the purchase order');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={marking ? `Mark ${po?.poNumber || ''} as Stock Only` : `Reopen ${po?.poNumber || ''} for mapping`}
      okText={marking ? 'Mark Stock Only' : 'Reopen'}
      onOk={handleOk}
      onCancel={() => { form.resetFields(); onClose(); }}
      okButtonProps={{ loading: saving }}
      destroyOnHidden
    >
      <Alert
        type={marking ? 'warning' : 'info'}
        showIcon
        style={{ marginBottom: 16 }}
        message={marking
          ? 'This PO will not be linked to any customer order. Its stock stays as free stock under the PO reference and the PO drops out of the Unmapped queue.'
          : 'The PO returns to the Unmapped queue and can be linked to customer orders.'}
      />
      <Form form={form} layout="vertical">
        <Form.Item
          name="remark"
          label="Remark"
          rules={marking ? [{ required: true, whitespace: true, message: 'Say why this PO stays as stock' }] : []}
        >
          <Input.TextArea rows={3} maxLength={250} showCount placeholder={marking ? 'e.g. Year-end stock lot, held for development' : 'Optional'} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default StockOnlyModal;
