import { useState } from 'react';
import {
  Alert, App, Input, InputNumber, Modal, Space,
} from 'antd';
import { recordWasteSale } from '../../../../../services/production/jobwork/jobWorkPartyStockApi';
import { toastUnlessHandled } from '../../../../../utils/apiError';
import { fmtQty } from '../../jwFormat';

/** Cutting waste of a principal whose rule is "sold by us with their consent" (decision 22). */
const WasteSaleModal = ({ order, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [kg, setKg] = useState(order.wasteOnHand);
  const [buyer, setBuyer] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [consentRef, setConsent] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = kg > 0 && kg <= order.wasteOnHand && buyer.trim() && invoiceNo.trim() && consentRef.trim();
  const ok = async () => {
    setBusy(true);
    try {
      const res = await recordWasteSale({ jobOrderId: order.id, kg, buyer, invoiceNo, consentRef });
      message.success(`${res.docNo}: ${fmtQty(kg)} kg sold.`);
      onSaved();
    } catch (e) { toastUnlessHandled(message, e); } finally { setBusy(false); }
  };
  return (
    <Modal open destroyOnHidden title={`Sell cutting waste — ${order.orderNo}`} okText="Record the sale" okButtonProps={{ loading: busy, disabled: !ready }} onOk={ok} onCancel={onClose}>
      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
        <Alert type="info" showIcon title={`${fmtQty(order.wasteOnHand)} kg of their cutting waste is held.`} description="Sold on our invoice with their consent; it shows on their statement." />
        <InputNumber name="wasteKg" min={0} max={order.wasteOnHand} style={{ width: '100%' }} suffix="kg" value={kg} onChange={setKg} />
        <Input name="wasteBuyer" placeholder="Sold to" value={buyer} onChange={(e) => setBuyer(e.target.value)} />
        <Input name="wasteInvoice" placeholder="Our invoice no." value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
        <Input name="wasteConsent" placeholder="Their consent (who, how, when)" value={consentRef} onChange={(e) => setConsent(e.target.value)} />
      </Space>
    </Modal>
  );
};

export default WasteSaleModal;
