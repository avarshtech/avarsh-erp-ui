import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Form, Card, Row, Col, Select, DatePicker, Input, Space } from 'antd';
import {
  SaveOutlined,
  SendOutlined,
  FileSearchOutlined,
  ShoppingCartOutlined,
  InboxOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import {
  getTrimsQCById,
  getSubmittedGRNsForQC,
  getActiveTrimsQCCriteria,
  saveTrimsQCDraft,
  submitTrimsQC,
} from '../../../services/inventoryService';
import { validateTrimsQC } from '../../../utils/qcValidation';
import { QC_STATUS } from '../../../utils/inventoryConstants';
import { formatNumber } from '../../../utils/formatters';
import TrimsQCCriteriaTable from './TrimsQCCriteriaTable';

const getSampleSize = (lotSize) => {
  if (!lotSize || lotSize <= 0) return 0;
  if (lotSize <= 150) return 20;
  if (lotSize <= 500) return 50;
  if (lotSize <= 1200) return 80;
  if (lotSize <= 3200) return 125;
  if (lotSize <= 10000) return 200;
  if (lotSize <= 35000) return 315;
  if (lotSize <= 150000) return 500;
  return 800;
};

/**
 * Small presentation component used to render the three quantity summary
 * badges (Qty Ordered / Received / Checked) inside the Inspection Header
 * card. Each badge carries its own accent colour so the numbers are visually
 * distinguishable at a glance.
 */
const QtyBadge = ({ label, value, icon, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '1 1 180px', minWidth: 180, justifyContent: 'center' }}>
    <div
      aria-hidden
      style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: `${color}1a`, // ~10% alpha tint
        border: `1.5px solid ${color}`,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color: 'var(--text-secondary, #8c8c8c)',
        marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 22,
        fontWeight: 600,
        lineHeight: 1.15,
        color,
      }}>
        {formatNumber(value)}
      </div>
    </div>
  </div>
);

const TrimsQCInspection = () => {
  const { message } = App.useApp();
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const isNew = !id || id === 'new';

  const [savingDraft, setSavingDraft] = useState(false);
  const [submittingForm, setSubmittingForm] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [grns, setGrns] = useState([]);
  const [selectedGRN, setSelectedGRN] = useState(null);
  const [poLineItemId, setPoLineItemId] = useState(null);
  const [criteriaMaster, setCriteriaMaster] = useState([]);
  const [criteriaRows, setCriteriaRows] = useState([]);
  const [qcData, setQcData] = useState(null);

  const readOnly = !isNew && qcData?.status && qcData.status !== QC_STATUS.DRAFT && qcData.status !== QC_STATUS.REFERRED_BACK;
  const isReferredBack = qcData?.status === QC_STATUS.REFERRED_BACK;

  useEffect(() => {
    getSubmittedGRNsForQC('Accessories').then(setGrns).catch(() => message.error('Failed to load GRNs'));
    getActiveTrimsQCCriteria().then(setCriteriaMaster).catch(() => message.error('Failed to load criteria master'));
  }, [message]);

  useEffect(() => {
    if (isNew) return;
    getTrimsQCById(id).then((data) => {
      if (!data) return;
      setQcData(data);
      setSelectedGRN({ id: data.grnId, grnNumber: data.grnNumber });
      setPoLineItemId(data.poLineItemId);
      setCriteriaRows(data.criteriaRows || data.criteriaChecks || []);
      form.setFieldsValue({
        grnId: data.grnId,
        poLineItemId: data.poLineItemId,
        inspectionDate: data.inspectionDate || data.date ? dayjs(data.inspectionDate || data.date) : null,
        inspector: data.inspector || '',
      });
    });
  }, [id, isNew, form]);

  const handleGRNChange = useCallback((grnId) => {
    const grn = grns.find((g) => g.id === grnId);
    setSelectedGRN(grn || null);
    setPoLineItemId(null);
    setCriteriaRows([]);
    form.setFieldsValue({ poLineItemId: undefined });
    setIsDirty(true);
  }, [grns, form]);

  // Different accessories line items require different criteria — for example a
  // button line item needs Pull Strength but a woven label needs Print Quality.
  // Clear the selected criteria whenever the inspector picks a different line item
  // so they consciously choose the criteria relevant to it.
  const handleLineItemChange = useCallback((newPoLineItemId) => {
    setPoLineItemId(newPoLineItemId);
    if (isNew) {
      setCriteriaRows([]);
    }
    setIsDirty(true);
  }, [isNew]);

  // Multi-select callback — add rows for newly selected criteria, keep rows for
  // still-selected ones (preserving any OK/Not OK/remarks the inspector already set),
  // drop rows for deselected ones.
  const handleSelectedCriteriaChange = useCallback((ids) => {
    setCriteriaRows((prev) => {
      const kept = prev.filter((r) => ids.includes(r.id));
      const newOnes = ids
        .filter((id) => !prev.find((r) => r.id === id))
        .map((id) => {
          const m = criteriaMaster.find((c) => c.id === id);
          return { id, criteria: m?.name || '', ok: false, notOk: false, remarks: '' };
        });
      // Preserve the order the user picked them
      return ids.map((id) => kept.find((r) => r.id === id) || newOnes.find((r) => r.id === id)).filter(Boolean);
    });
    setIsDirty(true);
  }, [criteriaMaster]);

  // For Accessories GRNs the canonical item detail lives in `items[]` (with itemCode,
  // description, poQty, etc). `lineItems[]` on accessories may be just an array of
  // numeric poLineItemIds (the old reference-only shape). For Fabric GRNs the canonical
  // source is `lineItems[]` with objects carrying nested rolls. Pick whichever array
  // actually contains full objects.
  const lineItemSource = useMemo(() => {
    if (!selectedGRN) return [];
    const items = selectedGRN.items || [];
    if (items.length > 0 && typeof items[0] === 'object') return items;
    const lineItems = selectedGRN.lineItems || [];
    if (lineItems.length > 0 && typeof lineItems[0] === 'object') return lineItems;
    return [];
  }, [selectedGRN]);

  const lineItemOptions = useMemo(
    () => lineItemSource.map((li) => ({
      label: `${li.itemCode || '—'} — ${li.description || '—'}`,
      value: li.poLineItemId || li.id,
    })),
    [lineItemSource],
  );

  const selectedLineItem = useMemo(
    () => lineItemSource.find((li) => (li.poLineItemId || li.id) === poLineItemId) || null,
    [lineItemSource, poLineItemId],
  );

  const qtyReceived = selectedLineItem?.receivingQty || 0;
  const qtyChecked = useMemo(() => getSampleSize(qtyReceived), [qtyReceived]);

  const handleCriteriaChange = useCallback((idx, field, value) => {
    setCriteriaRows((prev) => prev.map((row, i) => {
      if (i !== idx) return row;
      const next = { ...row, [field]: value };
      if (field === 'ok' && value) next.notOk = false;
      if (field === 'notOk' && value) next.ok = false;
      return next;
    }));
    setIsDirty(true);
  }, []);

  const buildPayload = () => {
    const values = form.getFieldsValue();
    return {
      id: qcData?.id,
      qcNumber: qcData?.qcNumber,
      grnId: selectedGRN?.id,
      grnNumber: selectedGRN?.grnNumber,
      poLineItemId,
      inspectionDate: values.inspectionDate ? dayjs(values.inspectionDate).format('YYYY-MM-DD') : null,
      inspector: values.inspector || '',
      qtyOrdered: selectedLineItem?.poQty || selectedLineItem?.orderedQty || 0,
      qtyReceived,
      qtyChecked,
      criteriaRows,
    };
  };

  const handleSaveDraft = async () => {
    if (savingDraft || submittingForm) return;
    if (!isNew && !isDirty) {
      message.warning('No changes detected.');
      return;
    }
    const payload = buildPayload();
    const errors = validateTrimsQC(payload, false, { grn: selectedGRN });
    if (errors.length) { errors.slice(0, 3).forEach((e) => message.error(e)); return; }
    setSavingDraft(true);
    try {
      await saveTrimsQCDraft(payload);
      message.success('Draft saved');
      navigate('/inventory/qc');
    } catch {
      message.error('Failed to save draft');
      setSavingDraft(false);
    }
  };

  const handleSubmit = async () => {
    if (savingDraft || submittingForm) return;
    const payload = buildPayload();
    const errors = validateTrimsQC(payload, true, { grn: selectedGRN });
    if (errors.length) { errors.slice(0, 5).forEach((e) => message.error(e)); return; }
    setSubmittingForm(true);
    try {
      await submitTrimsQC(payload);
      message.success('QC submitted for approval');
      navigate('/inventory/qc');
    } catch {
      message.error('Failed to submit QC');
      setSubmittingForm(false);
    }
  };

  return (
    <div className="animate-fade-in-up inv-page">
      <PageHeader
        title={isNew ? 'New Accessories QC Inspection' : `Accessories QC — ${qcData?.qcNumber || ''}`}
        backPath="/inventory/qc"
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        <Space wrap>
          {!readOnly && !isReferredBack && (
            <ActionButton action="save" variant="draft" text="Save Draft" icon={<SaveOutlined />} onClick={handleSaveDraft} loading={savingDraft} />
          )}
          {!readOnly && (
            <ActionButton action="save" text="Submit" icon={<SendOutlined />} onClick={handleSubmit} loading={submittingForm} />
          )}
        </Space>
      </PageHeader>

      <Card
        size="small"
        style={{ marginBottom: 24, borderLeft: '3px solid var(--primary-color)' }}
        styles={{ body: { padding: '20px 24px' } }}
        title={<Space><FileSearchOutlined /><span>Inspection Header</span></Space>}
      >
        <Form form={form} layout="vertical" onValuesChange={() => setIsDirty(true)}>
          {!isNew && (
            <Form.Item label="QC #">
              <Input value={qcData?.qcNumber || ''} disabled />
            </Form.Item>
          )}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="GRN Number" name="grnId" rules={[{ required: true, message: 'Select GRN' }]}>
                <Select
                  placeholder="Select submitted GRN"
                  showSearch
                  optionFilterProp="label"
                  disabled={readOnly}
                  options={grns.map((g) => ({ label: g.grnNumber, value: g.id }))}
                  onChange={handleGRNChange}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="PO Line Item" name="poLineItemId" rules={[{ required: true, message: 'Pick a PO line item' }]}>
                <Select
                  placeholder={selectedGRN ? 'Select line item' : 'Pick a GRN first'}
                  disabled={!selectedGRN || readOnly}
                  options={lineItemOptions}
                  onChange={handleLineItemChange}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Inspection Date"
                name="inspectionDate"
                rules={[{ required: true, message: 'Select date' }]}
                initialValue={dayjs()}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  disabled={readOnly}
                  disabledDate={(d) => {
                    if (!d) return false;
                    if (d.isAfter(dayjs(), 'day')) return true;
                    if (selectedGRN?.grnDate && d.isBefore(dayjs(selectedGRN.grnDate).startOf('day'))) return true;
                    return false;
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Inspector Name"
                name="inspector"
                rules={[{ required: true, message: 'Enter inspector name' }]}
                tooltip="Name of the physical inspector performing the QC. May be an external contractor — not necessarily the ERP user filling this form."
              >
                <Input placeholder="e.g. Vimal Raj" disabled={readOnly} maxLength={100} />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        {selectedLineItem && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
              marginTop: 16,
              padding: '14px 20px',
              background: 'var(--bg-secondary, rgba(0,0,0,0.02))',
              border: '1px solid var(--border-color, rgba(0,0,0,0.06))',
              borderRadius: 'var(--radius-md, 8px)',
            }}
          >
            <QtyBadge
              label="Qty Ordered"
              value={selectedLineItem.poQty || selectedLineItem.orderedQty || 0}
              icon={<ShoppingCartOutlined />}
              color="var(--primary-color, #1677ff)"
            />
            <QtyBadge
              label="Qty Received"
              value={qtyReceived}
              icon={<InboxOutlined />}
              color="var(--success-color, #52c41a)"
            />
            <QtyBadge
              label="Qty Checked (AQL)"
              value={qtyChecked}
              icon={<ExperimentOutlined />}
              color="var(--warning-color, #faad14)"
            />
          </div>
        )}
      </Card>

      <TrimsQCCriteriaTable
        rows={criteriaRows}
        criteriaMaster={criteriaMaster}
        selectedIds={criteriaRows.map((r) => r.id)}
        onSelectedIdsChange={handleSelectedCriteriaChange}
        onChange={handleCriteriaChange}
        readOnly={readOnly}
        lineItemSelected={Boolean(poLineItemId)}
      />
    </div>
  );
};

export default TrimsQCInspection;
