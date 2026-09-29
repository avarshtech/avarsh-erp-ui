import { memo, useState } from 'react';
import { Col, Input, Modal, Row, Typography } from 'antd';
import IsoDatePicker from '../../../components/form/IsoDatePicker';
import JobWorkDeliveryFields from '../jobWork/JobWorkDeliveryFields';
import { GPO_AMEND_FIELDS, GPO_RETURN_TO } from '../../../utils/jobWorkConstants';
import { deliveryDateNote, deliveryIssues } from '../../../utils/jobWorkDelivery';

const { Text } = Typography;
const Label = ({ htmlFor, children }) => <label htmlFor={htmlFor}><Text type="secondary" style={{ fontSize: 12 }}>{children}</Text></label>;
const ALL_EDITABLE = { place: true, date: true, instructions: true };

const Body = ({ doc, units, onSubmit, onClose }) => {
  const [v, setV] = useState(() => Object.fromEntries(GPO_AMEND_FIELDS.map((f) => [f, doc[f] ?? null])));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const patch = (p) => setV((cur) => ({ ...cur, ...p }));
  const note = deliveryDateNote(v.expectedReturnDate, { notBefore: doc.poDate, warnAfter: v.requiredDate });
  const changed = GPO_AMEND_FIELDS.some((f) => (v[f] ?? '') !== (doc[f] ?? ''));
  // The amended PO must still meet the delivery rules (V14): nothing mandatory left blank.
  const incomplete = !v.requiredDate || deliveryIssues(v, 'expectedReturnDate').length > 0 || note?.type === 'error';
  const submit = async () => {
    setBusy(true);
    try {
      if (await onSubmit(v, reason.trim()) !== false) onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open title="Amend delivery / instructions" okText="Save amendment" onOk={submit} onCancel={onClose} confirmLoading={busy} width={760} destroyOnHidden
      okButtonProps={{ disabled: !changed || !reason.trim() || incomplete }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Quantities, rates and the vendor stay as approved. Every change is kept in the PO history with your reason.
      </Text>
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col span={8}>
          <Label htmlFor="amend-requiredDate">Required date</Label>
          <IsoDatePicker id="amend-requiredDate" aria-label="Required date" value={v.requiredDate} onChange={(requiredDate) => patch({ requiredDate })} />
        </Col>
      </Row>
      <JobWorkDeliveryFields value={v} dateKey="expectedReturnDate" idPrefix="amend" returnToOptions={GPO_RETURN_TO} units={units}
        editable={ALL_EDITABLE} onChange={patch} dateNote={note} minDate={doc.poDate} />
      <div style={{ marginTop: 12 }}>
        <Label htmlFor="amend-reason">Reason for the amendment *</Label>
        <Input.TextArea id="amend-reason" aria-label="Reason for the amendment" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Modal>
  );
};

/**
 * Amend delivery / instructions on an approved or sent Garment Process PO (PRD §16): the
 * required date, Return To, the return unit, the expected delivery date and the processing
 * instructions, with a reason. Mounts fresh per opening; `units` = useJobWorkUnits().
 */
const GpoAmendDialog = memo(function GpoAmendDialog({ open, doc, units, onSubmit, onClose }) {
  return open ? <Body doc={doc} units={units} onSubmit={onSubmit} onClose={onClose} /> : null;
});

export default GpoAmendDialog;
