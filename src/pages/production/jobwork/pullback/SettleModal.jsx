import { useState } from 'react';
import {
  Alert, App, Input, Modal, Radio, Space, Typography,
} from 'antd';
import { settlePullBack } from '../../../../services/production/jobwork/jobWorkPullBackApi';
import { toastUnlessHandled } from '../../../../utils/apiError';
import { SETTLE_ACTION } from '../../../../utils/jobWorkTracker/constants';
import { fmtQty } from '../jwFormat';

const { Text } = Typography;

/** Close the pull-back: per colour, what was approved but never arrived goes back to the vendor or is written off. */
const SettleModal = ({ pb, onClose, onDone }) => {
  const { message } = App.useApp();
  const [choices, setChoices] = useState({});
  const [busy, setBusy] = useState(false);
  const balances = Object.entries(pb.approvedByColour).map(([colour, approved]) => {
    const back = pb.returnedByColour[colour] || 0;
    return { colour, approved, back, balance: Math.max(0, approved - back) };
  }).filter((b) => b.balance > 0);
  const set = (colour, p) => setChoices((c) => ({ ...c, [colour]: { ...c[colour], ...p } }));
  const ready = balances.every((b) => choices[b.colour]?.action
    && (choices[b.colour].action !== SETTLE_ACTION.WRITE_OFF || choices[b.colour].reason?.trim()));

  const ok = async () => {
    setBusy(true);
    try {
      await settlePullBack(pb.id, { colours: balances.map((b) => ({ colour: b.colour, ...choices[b.colour] })) });
      message.success(`${pb.pbNo} settled.`);
      onDone();
    } catch (e) { toastUnlessHandled(message, e); } finally { setBusy(false); }
  };

  return (
    <Modal open title={`Settle ${pb.pbNo}`} okText="Settle" onOk={ok} onCancel={onClose} destroyOnHidden width={620}
      okButtonProps={{ loading: busy, disabled: !ready }}>
      <Alert type="info" showIcon style={{ marginBottom: 12 }}
        title="Back to vendor: the vendor keeps those pieces and finishes them on its POs. Write off: they are lost; re-cutting opens on an in-house Cutting PO." />
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {balances.map((b) => (
          <div key={b.colour}>
            <Text strong>{b.colour}</Text>
            <Text type="secondary"> — {fmtQty(b.approved)} approved, {fmtQty(b.back)} back, {fmtQty(b.balance)} never arrived</Text>
            <Radio.Group
              style={{ display: 'block', marginTop: 6 }}
              value={choices[b.colour]?.action}
              onChange={(e) => set(b.colour, { action: e.target.value })}
              options={[{ value: SETTLE_ACTION.BACK_TO_VENDOR, label: 'Back to vendor' }, { value: SETTLE_ACTION.WRITE_OFF, label: 'Write off' }]}
            />
            {choices[b.colour]?.action === SETTLE_ACTION.WRITE_OFF && (
              <Input name={`settle-${b.colour}`} style={{ marginTop: 6 }} placeholder="Why are they written off?"
                value={choices[b.colour]?.reason} onChange={(e) => set(b.colour, { reason: e.target.value })} />
            )}
          </div>
        ))}
      </Space>
    </Modal>
  );
};

export default SettleModal;
