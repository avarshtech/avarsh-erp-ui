import { useState } from 'react';
import {
  Alert, App, Input, InputNumber, Modal, Select, Space, Typography,
} from 'antd';
import { lotAction } from '../../../../../services/production/jobwork/jobWorkPartyStockApi';
import { validateLotAction } from '../../../../../utils/jobWorkInward/partyStockRules';
import { toastUnlessHandled } from '../../../../../utils/apiError';
import { fmtQty } from '../../jwFormat';

const { Text } = Typography;

/** Move part of a lot to the principal's next order (their consent), or write it off (a reason). */
const LotActionModal = ({ mode, lot, jobOrders, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [qty, setQty] = useState(lot.ledger.inStore);
  const [toJobOrderId, setTo] = useState(null);
  const [consentRef, setConsent] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const move = mode === 'MOVE';
  const errors = validateLotAction({ mode, qty, inStore: lot.ledger.inStore, toJobOrderId, consentRef, reason });
  const ok = async () => {
    setBusy(true);
    try {
      const res = await lotAction({ mode, lotId: lot.id, qty, toJobOrderId, consentRef, reason });
      message.success(`${res.docNo} recorded.`);
      onSaved();
    } catch (e) { toastUnlessHandled(message, e); } finally { setBusy(false); }
  };
  return (
    <Modal open destroyOnHidden title={`${move ? 'Move' : 'Write off'} — ${lot.lotNo} · ${lot.itemName}`} okText={move ? 'Move' : 'Write off'}
      okButtonProps={{ danger: !move, loading: busy, disabled: errors.length > 0 }} onOk={ok} onCancel={onClose}>
      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
        <Text type="secondary">{fmtQty(lot.ledger.inStore)} {lot.uom} in store, from their challan {lot.theirDcNo}.</Text>
        <InputNumber name="lotQty" min={0} max={lot.ledger.inStore} style={{ width: '100%' }} suffix={lot.uom} value={qty} onChange={setQty} />
        {move ? (
          <>
            <Select name="lotTo" style={{ width: '100%' }} placeholder="Their order it moves to" value={toJobOrderId} onChange={setTo}
              options={jobOrders.filter((o) => o.principalId === lot.principalId && o.value !== lot.jobOrderId)} />
            <Input name="lotConsent" placeholder="Their consent (who, how, when)" value={consentRef} onChange={(e) => setConsent(e.target.value)} />
            <Alert type="info" showIcon title="The lot keeps its original challan and date, so the one-year count does not restart." />
          </>
        ) : (
          <>
            <Input.TextArea name="lotReason" rows={3} placeholder="Why is it written off? (it shows on their statement)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Alert type="warning" showIcon title="A write-off moves no goods; the principal sees it on their statement as a loss." />
          </>
        )}
      </Space>
    </Modal>
  );
};

export default LotActionModal;
