import { useState, useCallback } from 'react';
import { App, Modal, Form, Select, Row, Col, Typography, Alert, Radio } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import { formatCurrency, formatNumber } from '../../../utils/formatters';
import { currentFinancialYear } from '../../../utils/billPassingConstants';
import { BILL_SOURCE, BILL_SOURCES, billSourceOf, isJobWorkSource, JW_DOC_PREFIX } from '../../../utils/jobWorkBillConstants';
import { createBill } from '../../../services/inventory/billPassingService';
import { createJobWorkBill } from '../../../services/inventory/jobWorkBill/jobWorkBillService';
import useBillCreateSources from './useBillCreateSources';

const { Text } = Typography;

const STATUS_LABEL = { COMPLETED: 'Completed', CLOSED: 'Short-closed' };

const poLabel = (p, jobWork) => (jobWork
  ? [p.poNumber, p.processName, `${p.dcCount} DC`, STATUS_LABEL[p.status] || p.status,
    p.uncheckedDcCount ? `${p.uncheckedDcCount} DC not checked` : null].filter(Boolean).join(' · ')
  : `${p.poNumber} · ${formatCurrency(p.poValue)} · ${p.grnCount} GRN · ${formatNumber(p.pendingQty, 3)} pending`);

/**
 * Step one of a bill: what kind, which party, which PO. That is the whole of it — everything else needs the
 * reserved number to hang off, so the draft is created here and the workspace opens on the real record.
 * A job-work bill (Cut Panel PO / Garment Process PO) is offered only for a PO that is complete or short-closed.
 */
const BillPassingCreateModal = ({ open, initialSource = BILL_SOURCE.SUPPLIER_PO, onClose, onCreated }) => {
  const { message } = App.useApp();
  // The list remounts this dialog on every open, so a cancelled attempt never pre-fills the next one.
  const [source, setSource] = useState(initialSource);
  const [partyId, setPartyId] = useState(null);
  const [poId, setPoId] = useState(null);
  const [creating, setCreating] = useState(false);
  const jobWork = isJobWorkSource(source);
  const kind = billSourceOf(source);
  const { parties, pos, posLoading } = useBillCreateSources({ open, source, partyId });
  const pickSource = (value) => { setSource(value); setPartyId(null); setPoId(null); };

  const handleCreate = useCallback(async () => {
    if (!partyId || !poId) return;
    setCreating(true);
    try {
      const created = jobWork
        ? await createJobWorkBill({ source, vendorId: partyId, poId })
        : await createBill({
          supplierId: partyId,
          poId,
          supplierInvoiceNo: '',
          // The server derives the financial year from this date, because that is what the duplicate-invoice rule keys on.
          invoiceDate: dayjs().format('YYYY-MM-DD'),
        });
      message.success(`${created.jwbNumber || created.bpNumber} created as draft`);
      onCreated?.(created, source);
    } catch (e) {
      if (!e.response) message.error(e.message || 'Failed to create the bill');
    } finally {
      setCreating(false);
    }
  }, [jobWork, source, partyId, poId, onCreated, message]);

  const selectedPo = pos.find((p) => p.id === poId);
  const prefix = jobWork ? JW_DOC_PREFIX : 'BP';

  return (
    <Modal
      open={open}
      title="New Bill Passing"
      width={680}
      destroyOnHidden
      onCancel={onClose}
      footer={(
        <>
          <ActionButton action="cancel" text="Cancel" onClick={onClose} disabled={creating} />
          <ActionButton action="create" text="Create Draft Bill" loading={creating} disabled={!partyId || !poId} onClick={handleCreate} />
        </>
      )}
    >
      <Text type="secondary" style={{ color: 'var(--text-secondary)' }}>
        Pick what is being billed, the {kind.party.toLowerCase()} and the purchase order. A draft{' '}
        {`${prefix}/${currentFinancialYear()}/…`} number is reserved as soon as you create it.
      </Text>

      <Form layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item label="Bill type" required>
          <Radio.Group
            id="billType"
            optionType="button"
            buttonStyle="solid"
            value={source}
            onChange={(e) => pickSource(e.target.value)}
            options={BILL_SOURCES.map((s) => ({ value: s.value, label: s.label }))}
          />
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} md={10}>
            <Form.Item label={kind.party} required>
              <Select
                showSearch
                autoFocus
                optionFilterProp="label"
                placeholder={`Select ${kind.party.toLowerCase()}`}
                value={partyId}
                onChange={(v) => { setPartyId(v); setPoId(null); }}
                options={parties.map((s) => ({ value: s.id, label: s.name }))}
                notFoundContent={jobWork ? 'No vendor has a completed PO waiting for a bill' : 'No active suppliers'}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={14}>
            <Form.Item label="Purchase Order" required>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={partyId ? 'Select a billable PO' : `Select a ${kind.party.toLowerCase()} first`}
                // The label carries the PO's process, DCs and state: let the list be as wide as it needs.
                popupMatchSelectWidth={false}
                disabled={!partyId}
                loading={posLoading}
                value={poId}
                onChange={setPoId}
                options={pos.map((p) => ({ value: p.id, label: poLabel(p, jobWork) }))}
                notFoundContent={posLoading ? 'Loading…' : `Nothing left to bill for this ${kind.party.toLowerCase()}`}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>

      {jobWork && !selectedPo && (
        <Alert type="info" showIcon title="Only a completed or short-closed PO can be billed"
          description="A job-work bill is passed once every line is back from the vendor (or the PO is short-closed), so the whole PO is checked and billed once." />
      )}
      {selectedPo && (
        <Alert
          type={selectedPo.uncheckedDcCount ? 'warning' : 'info'}
          showIcon
          title={jobWork ? `${selectedPo.dcCount} vendor DC(s) will be pulled in` : `${selectedPo.grnCount} GRN(s) will be pulled in automatically`}
          description={jobWork
            ? (selectedPo.uncheckedDcCount
              ? `${selectedPo.uncheckedDcCount} DC(s) have no ${kind.check.toLowerCase()} yet — the bill cannot be passed until they are checked.`
              : `Everything that came back on ${selectedPo.poNumber}, with its ${kind.check.toLowerCase()}s, is on the bill.`)
            : `${formatNumber(selectedPo.pendingQty, 3)} still unbilled on ${selectedPo.poNumber}. You can narrow the GRNs and quantities once the draft opens.`}
        />
      )}
    </Modal>
  );
};

export default BillPassingCreateModal;
