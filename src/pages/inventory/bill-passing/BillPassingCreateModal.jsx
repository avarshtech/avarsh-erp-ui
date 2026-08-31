import { useState, useEffect, useCallback } from 'react';
import { App, Modal, Form, Select, Row, Col, Typography, Alert } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import { formatCurrency, formatNumber } from '../../../utils/formatters';
import { currentFinancialYear } from '../../../utils/billPassingConstants';
import { listBpSuppliers, listBillablePos, createBill } from '../../../services/inventory/billPassingService';

const { Text } = Typography;

/**
 * Step one of a bill: pick the supplier and the PO to bill against. That is the
 * whole of it — everything else needs the reserved BP number to hang off, so the
 * draft is created here and the workspace opens on the real record.
 */
const BillPassingCreateModal = ({ open, onClose, onCreated }) => {
  const { message } = App.useApp();

  const [suppliers, setSuppliers] = useState([]);
  const [pos, setPos] = useState([]);
  const [supplierId, setSupplierId] = useState(null);
  const [poId, setPoId] = useState(null);
  const [posLoading, setPosLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Reset on every open so a cancelled attempt never pre-fills the next one.
  useEffect(() => {
    if (!open) return;
    setSupplierId(null);
    setPoId(null);
    setPos([]);
    listBpSuppliers()
      .then(setSuppliers)
      .catch((e) => message.error(e.message || 'Failed to load suppliers'));
  }, [open, message]);

  useEffect(() => {
    if (!open || !supplierId) { setPos([]); return undefined; }
    let alive = true;
    setPosLoading(true);
    listBillablePos({ supplierId })
      .then((res) => { if (alive) setPos(res || []); })
      .catch((e) => { if (alive) message.error(e.message || 'Failed to load billable purchase orders'); })
      .finally(() => { if (alive) setPosLoading(false); });
    return () => { alive = false; };
  }, [open, supplierId, message]);

  const handleCreate = useCallback(async () => {
    if (!supplierId || !poId) return;
    setCreating(true);
    try {
      const created = await createBill({
        supplierId,
        poId,
        supplierInvoiceNo: '',
        invoiceDate: dayjs().format('YYYY-MM-DD'),
        financialYear: currentFinancialYear(),
      });
      message.success(`${created.bpNumber} created as draft`);
      onCreated?.(created);
    } catch (e) {
      message.error(e.message || 'Failed to create the bill');
    } finally {
      setCreating(false);
    }
  }, [supplierId, poId, onCreated, message]);

  const selectedPo = pos.find((p) => p.id === poId);

  return (
    <Modal
      open={open}
      title="New Bill Passing"
      width={640}
      destroyOnHidden
      onCancel={onClose}
      footer={(
        <>
          <ActionButton action="cancel" text="Cancel" onClick={onClose} disabled={creating} />
          <ActionButton
            action="create"
            text="Create Draft Bill"
            loading={creating}
            disabled={!supplierId || !poId}
            onClick={handleCreate}
          />
        </>
      )}
    >
      <Text type="secondary" style={{ color: 'var(--text-secondary)' }}>
        Pick the supplier and the purchase order to bill against. A draft{' '}
        {`BP/${currentFinancialYear()}/…`} number is reserved as soon as you create it.
      </Text>

      <Form layout="vertical" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col xs={24} md={10}>
            <Form.Item label="Supplier" required>
              <Select
                showSearch
                autoFocus
                optionFilterProp="label"
                placeholder="Select supplier"
                value={supplierId}
                onChange={(v) => { setSupplierId(v); setPoId(null); }}
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                notFoundContent="No active suppliers"
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={14}>
            <Form.Item label="Purchase Order" required>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={supplierId ? 'Select a billable PO' : 'Select a supplier first'}
                disabled={!supplierId}
                loading={posLoading}
                value={poId}
                onChange={setPoId}
                options={pos.map((p) => ({
                  value: p.id,
                  label: `${p.poNumber} · ${formatCurrency(p.poValue)} · ${p.grnCount} GRN · ${formatNumber(p.pendingQty, 3)} pending`,
                }))}
                notFoundContent={posLoading ? 'Loading…' : 'Nothing left to bill for this supplier'}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>

      {selectedPo && (
        <Alert
          type="info"
          showIcon
          message={`${selectedPo.grnCount} GRN(s) will be pulled in automatically`}
          description={`${formatNumber(selectedPo.pendingQty, 3)} still unbilled on ${selectedPo.poNumber}. You can narrow the GRNs and quantities once the draft opens.`}
        />
      )}
    </Modal>
  );
};

export default BillPassingCreateModal;
