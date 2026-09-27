import { memo, useState } from 'react';
import { Col, Input, Modal, Row, Select, Typography } from 'antd';
import dayjs from 'dayjs';
import IsoDatePicker from '../../../components/form/IsoDatePicker';
import { GPO_RETURN_TO } from '../../../utils/jobWorkConstants';

const { Text } = Typography;
const FIELDS = ['requiredDate', 'plannedSendDate', 'expectedReturnDate', 'returnTo', 'returnToOther', 'instructions', 'remarks'];
const Label = ({ children }) => <Text type="secondary" style={{ fontSize: 12 }}>{children}</Text>;

const Body = ({ doc, onSubmit, onClose }) => {
  const [v, setV] = useState(() => Object.fromEntries(FIELDS.map((f) => [f, doc[f] ?? null])));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (f) => (value) => setV((cur) => ({ ...cur, [f]: value }));
  const backwards = v.expectedReturnDate && v.plannedSendDate && dayjs(v.expectedReturnDate).isBefore(v.plannedSendDate, 'day');
  const changed = FIELDS.some((f) => (v[f] ?? '') !== (doc[f] ?? ''));
  const submit = async () => {
    setBusy(true);
    try {
      if (await onSubmit(v, reason.trim()) !== false) onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open title="Amend dates / remarks" okText="Save amendment" onOk={submit} onCancel={onClose} confirmLoading={busy} width={720} destroyOnHidden
      okButtonProps={{ disabled: !changed || !reason.trim() || backwards || !v.plannedSendDate || !v.expectedReturnDate }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Quantities, rates and the vendor stay as approved. Every change is kept in the PO history with your reason.
      </Text>
      <Row gutter={[12, 12]}>
        <Col span={8}><Label>Required date</Label><IsoDatePicker id="amend-requiredDate" value={v.requiredDate} onChange={set('requiredDate')} /></Col>
        <Col span={8}><Label>Planned send date</Label><IsoDatePicker id="amend-plannedSendDate" value={v.plannedSendDate} onChange={set('plannedSendDate')} /></Col>
        <Col span={8}>
          <Label>Expected return</Label>
          <IsoDatePicker id="amend-expectedReturnDate" status={backwards ? 'error' : undefined} value={v.expectedReturnDate} onChange={set('expectedReturnDate')} />
        </Col>
        <Col span={12}><Label>Return to</Label><Select id="amend-returnTo" style={{ width: '100%' }} options={GPO_RETURN_TO} value={v.returnTo} onChange={set('returnTo')} /></Col>
        {v.returnTo === 'OTHER' && <Col span={12}><Label>Return to (other)</Label><Input id="amend-returnToOther" value={v.returnToOther ?? ''} onChange={(e) => set('returnToOther')(e.target.value)} /></Col>}
        <Col span={24}><Label>Processing instructions</Label><Input.TextArea id="amend-instructions" rows={2} maxLength={2000} value={v.instructions ?? ''} onChange={(e) => set('instructions')(e.target.value)} /></Col>
        <Col span={24}><Label>PO remarks</Label><Input.TextArea id="amend-remarks" rows={2} maxLength={1000} value={v.remarks ?? ''} onChange={(e) => set('remarks')(e.target.value)} /></Col>
        <Col span={24}><Label>Reason for the amendment *</Label><Input.TextArea id="amend-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></Col>
      </Row>
    </Modal>
  );
};

/**
 * Amend dates / remarks on an approved or sent Garment Process PO (PRD §16): the dates,
 * Return To, instructions and remarks, with a reason. Mounts fresh per opening.
 */
const GpoAmendDialog = memo(function GpoAmendDialog({ open, doc, onSubmit, onClose }) {
  return open ? <Body doc={doc} onSubmit={onSubmit} onClose={onClose} /> : null;
});

export default GpoAmendDialog;
