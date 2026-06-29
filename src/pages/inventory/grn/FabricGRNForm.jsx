import { useState, useCallback, useEffect, useMemo } from 'react';
import { App, Form, Input, Select, DatePicker, Card, Row, Col, Typography, Space, Tag, Skeleton } from 'antd';
import { SaveOutlined, SendOutlined, FileSearchOutlined, BranchesOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import FileUpload from '../../../components/FileUpload';
import {
  getPurchaseOrdersForGRN,
  getFabricGRN,
  saveFabricGRNDraft,
  submitFabricGRN,
  getItemVariantsBulk,
  getPurchaseOrderByIdAnyStatus,
  enrichPOWithReceipts,
} from '../../../services/inventory/inventoryService';
import { getFilesByEntity } from '../../../services/core/fileService';
import { processGrnAttachments } from './grnAttachments';
import { validateFabricGRN } from '../../../utils/grnValidation';
import { GRN_STATUS, getInventoryStatusLabel } from '../../../utils/inventoryConstants';
import { GRN_STATUS_CONFIG } from '../../../utils/statusConfig';
import StatusTag from '../../../components/StatusTag';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import POLineItemPicker from './POLineItemPicker';
import FabricGRNRollTable from './FabricGRNRollTable';
import FabricGRNSummaryPanel from './FabricGRNSummaryPanel';

const { Title } = Typography;
const { TextArea } = Input;

const CHALLAN_REGEX = /^[A-Za-z0-9\-/]+$/;

// Exact mst_categories.name denormalized onto each PO line item as categoryName.
const PO_CATEGORY = 'Fabric';

const FabricGRNForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const isEdit = Boolean(id);

  const [savingDraft, setSavingDraft] = useState(false);
  const [submittingForm, setSubmittingForm] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [selectedLineItemIds, setSelectedLineItemIds] = useState([]);
  const [rolls, setRolls] = useState([]);
  // File attachment state. Each slot tracks:
  //   file         — newly-selected File pending upload (staged)
  //   previewUrl   — object URL for the new file preview
  //   existingFile — FileStorageDTO already persisted in GCS (populated on edit)
  //   toDelete     — fileId queued for deletion on next save (user replaced or removed)
  const [dcImage, setDcImage] = useState({ file: null, previewUrl: null, existingFile: null, toDelete: null });
  const [supplierInvoice, setSupplierInvoice] = useState({ file: null, previewUrl: null, existingFile: null, toDelete: null });
  const [grnRecord, setGrnRecord] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const { clearDirty } = useUnsavedChanges(isDirty);

  // Editable when the GRN is a fresh Draft or has been Reversed (reopened for edits).
  // QC_PENDING and CLOSED are read-only — only the Reverse action (on QC_PENDING)
  // can reopen it via the approval-actions bar.
  const readOnly =
    grnRecord && grnRecord.status !== GRN_STATUS.DRAFT && grnRecord.status !== GRN_STATUS.REVERSED;
  const isReferredBack = grnRecord?.status === GRN_STATUS.REVERSED;

  // Load fabric POs (Sent_To_Supplier only — service handles filter). A PO is eligible
  // here if at least one of its line items belongs to the Fabric category.
  useEffect(() => {
    getPurchaseOrdersForGRN()
      .then((pos) => setPurchaseOrders(pos.filter((p) => (p.items || []).some((li) => li.categoryName === PO_CATEGORY))))
      .catch(() => message.error('Failed to load purchase orders'));
  }, [message]);

  // Load existing GRN — fetches BOTH the GRN record AND the full PO (any status)
  // so that the line item picker has data to render and rolls map to real line items.
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    setEditLoading(true);
    (async () => {
      try {
        const grn = await getFabricGRN(id);
        if (!grn || cancelled) return;
        const fullPO = await getPurchaseOrderByIdAnyStatus(grn.poId);
        if (cancelled) return;

        setGrnRecord(grn);
        // Use the FULL PO enriched with historical receipts (excluding the current GRN
        // so its own lines aren't double-counted). Fall back to a stub if PO is missing.
        const enriched = fullPO ? await enrichPOWithReceipts(fullPO, grn.id) : null;
        if (cancelled) return;
        setSelectedPO(enriched || { id: grn.poId, poNumber: grn.poNumber, supplier: grn.supplier, buyerName: grn.buyerName, styleNumber: grn.styleNumber, items: [] });

        // Resolve selectedLineItemIds from the saved lineItems array.
        const lineIds = (grn.lineItems || []).map((li) => (typeof li === 'number' ? li : li.poLineItemId || li.id));
        setSelectedLineItemIds(lineIds);

        // Materialise rolls from the saved lineItems[].rolls — each roll already has poLineItemId,
        // itemCode, description, width, gsm, poQty, balance, rate, uom, rollNumber, receivingQty, shadeLot
        const savedRolls = (grn.lineItems || []).flatMap((li) => (typeof li === 'object' ? li.rolls || [] : []));
        setRolls(savedRolls);

        form.setFieldsValue({
          poId: grn.poId,
          challanNo: grn.challanNo,
          invoiceDate: grn.invoiceDate ? dayjs(grn.invoiceDate) : null,
          deliveryChallanDate: grn.deliveryChallanDate ? dayjs(grn.deliveryChallanDate) : null,
          vehicleNumber: grn.vehicleNumber,
          transporter: grn.transporter,
          remarks: grn.remarks,
        });

        // Populate attachment state from file storage so the user sees what's
        // already uploaded and can replace / remove it. We only fetch metadata —
        // previews are lazy-loaded on click via the view modal.
        try {
          const files = await getFilesByEntity('GRN', grn.id);
          if (cancelled) return;
          const dcFile = (files || []).find((f) => f.fileCategory === 'ATTACHMENT');
          const invFile = (files || []).find((f) => f.fileCategory === 'INVOICE');
          if (dcFile) setDcImage({ file: null, previewUrl: null, existingFile: dcFile, toDelete: null });
          if (invFile) setSupplierInvoice({ file: null, previewUrl: null, existingFile: invFile, toDelete: null });
        } catch (err) {
          console.warn('Failed to load GRN attachments:', err);
        }
      } catch {
        if (!cancelled) message.error('Failed to load GRN');
      } finally {
        if (!cancelled) setEditLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isEdit, form, message]);

  const handlePOChange = useCallback(async (poId) => {
    const po = purchaseOrders.find((p) => p.id === poId);
    // Enrich with historical receipts so the picker shows the real remaining balance
    // and disables fully-received line items.
    const enriched = po ? await enrichPOWithReceipts(po, grnRecord?.id) : null;
    setSelectedPO(enriched);
    setSelectedLineItemIds([]);
    setRolls([]);
    setIsDirty(true);
  }, [purchaseOrders, grnRecord?.id]);

  // When line item selection changes within the same PO, merge — preserving any
  // user-entered Roll #, Receiving Qty, Shade Lot for line items that remain selected.
  // - keep ALL rolls whose poLineItemId is still in selectedLineItemIds (supports many rolls per line item)
  // - add ONE fresh empty row for newly-selected line items
  // - drop rolls for deselected line items
  // - maintain selection order; group rolls per line item
  useEffect(() => {
    if (!selectedPO) return;
    setRolls((prevRolls) => {
      const kept = prevRolls.filter((r) => selectedLineItemIds.includes(r.poLineItemId));
      const existingLineItemIds = new Set(prevRolls.map((r) => r.poLineItemId));
      const newLineIds = selectedLineItemIds.filter((id) => !existingLineItemIds.has(id));
      if (newLineIds.length === 0 && kept.length === prevRolls.length) {
        // No structural change — bail out to avoid unnecessary re-renders
        return prevRolls;
      }
      const newVariantIds = newLineIds.map((id) => (selectedPO.items || []).find((i) => i.id === id)?.variantId);
      const newVariants = getItemVariantsBulk(newVariantIds);
      const freshRows = newLineIds.map((id, idx) => {
        const li = (selectedPO.items || []).find((i) => i.id === id);
        const v = newVariants[idx];
        return {
          poLineItemId: id,
          variantId: li?.variantId,
          itemCode: li?.itemCode,
          description: li?.description,
          width: v?.attributes?.width ?? '—',
          gsm: v?.attributes?.gsm ?? '—',
          poQty: li?.orderedQty,
          receivedQty: li?.receivedQty,
          balance: li?.pendingQty,
          rate: li?.rate,
          uom: li?.uom,
          defaultAllowance: li?.defaultAllowance,
          rollNumber: '',
          receivingQty: null,
          shadeLot: '',
        };
      });
      // Build result: for each selected line item id, include all kept rolls (preserves
      // multiple rolls per line item) OR the single fresh row if this is a new selection.
      const result = [];
      selectedLineItemIds.forEach((id) => {
        const keptForLine = kept.filter((r) => r.poLineItemId === id);
        if (keptForLine.length > 0) {
          result.push(...keptForLine);
        } else {
          const fresh = freshRows.find((r) => r.poLineItemId === id);
          if (fresh) result.push(fresh);
        }
      });
      return result;
    });
  }, [selectedPO, selectedLineItemIds]);

  const handleRollChange = useCallback((idx, field, value) => {
    setRolls((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
    setIsDirty(true);
  }, []);

  const buildPayload = () => {
    const values = form.getFieldsValue();
    return {
      id: grnRecord?.id,
      grnNumber: grnRecord?.grnNumber,
      type: 'Fabric',
      poId: selectedPO?.id,
      poNumber: selectedPO?.poNumber,
      supplier: selectedPO?.supplier,
      buyerName: selectedPO?.buyerName,
      styleNumber: selectedPO?.styleNumber,
      grnDate: grnRecord?.grnDate || dayjs().format('YYYY-MM-DD'),
      challanNo: values.challanNo,
      invoiceDate: values.invoiceDate ? dayjs(values.invoiceDate).format('YYYY-MM-DD') : null,
      deliveryChallanDate: values.deliveryChallanDate ? dayjs(values.deliveryChallanDate).format('YYYY-MM-DD') : null,
      vehicleNumber: values.vehicleNumber,
      transporter: values.transporter,
      remarks: values.remarks,
      lineItems: selectedLineItemIds.map((lineId) => {
        const li = (selectedPO?.items || []).find((i) => i.id === lineId);
        return {
          poLineItemId: lineId,
          itemCode: li?.itemCode,
          description: li?.description,
          rolls: rolls.filter((r) => r.poLineItemId === lineId),
        };
      }),
      rolls,
      version: grnRecord?.version,
      // File attachments live in the global file storage (fil_file_storage).
      // We surface `hasSupplierInvoice` here so the client-side validator can
      // enforce the "supplier invoice mandatory on submit" rule without
      // leaking a filename column onto the GRN record.
      hasSupplierInvoice: Boolean(supplierInvoice.file || supplierInvoice.existingFile),
    };
  };

  const processAttachments = (grnId) =>
    processGrnAttachments({ grnId, dcImage, supplierInvoice, message });

  const handleSaveDraft = async () => {
    if (savingDraft || submittingForm) return;
    if (isEdit && !isDirty) {
      message.warning('No changes detected.');
      return;
    }
    const payload = buildPayload();
    // Cross-GRN duplicate-roll-number check + balance check now run server-side.
    const errors = validateFabricGRN(payload, false, { po: selectedPO, currentGrnId: grnRecord?.id });
    if (errors.length) { errors.slice(0, 3).forEach((e) => message.error(e)); return; }
    setSavingDraft(true);
    try {
      const saved = await saveFabricGRNDraft(payload);
      await processAttachments(saved?.id || grnRecord?.id);
      message.success('Draft saved');
      clearDirty();
      navigate('/inventory/grn/list');
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to save draft');
      setSavingDraft(false);
    }
  };

  const handleSubmit = async () => {
    if (savingDraft || submittingForm) return;
    const payload = buildPayload();
    const errors = validateFabricGRN(payload, true, { po: selectedPO, currentGrnId: grnRecord?.id });
    if (errors.length) { errors.slice(0, 5).forEach((e) => message.error(e)); return; }
    setSubmittingForm(true);
    try {
      const saved = await submitFabricGRN(payload);
      await processAttachments(saved?.id || grnRecord?.id);
      message.success('GRN submitted');
      clearDirty();
      navigate('/inventory/grn/list');
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to submit GRN');
      setSubmittingForm(false);
    }
  };

  const poOptions = purchaseOrders.map((po) => ({ label: `${po.poNumber} — ${po.supplier}`, value: po.id }));

  return (
    <div className="animate-fade-in-up inv-page">
      <PageHeader
        title={
          isEdit ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, lineHeight: 1, flexWrap: 'wrap' }}>
              <span>Edit Fabric GRN</span>
              {grnRecord?.grnNumber && (
                <Tag
                  color="blue"
                  style={{
                    fontSize: 13,
                    lineHeight: 1.4,
                    padding: '4px 12px',
                    borderRadius: 999,
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    margin: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  {grnRecord.grnNumber}
                </Tag>
              )}
              {grnRecord?.status && (
                <StatusTag
                  status={grnRecord.status}
                  config={GRN_STATUS_CONFIG}
                  getLabel={getInventoryStatusLabel}
                />
              )}
            </span>
          ) : (
            'New Fabric GRN'
          )
        }
        backPath="/inventory/grn/list"
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

      {editLoading ? (
        <div style={{ padding: 24 }}>
          <Card style={{ marginBottom: 24, borderRadius: 12 }}>
            <Skeleton active title={{ width: '40%' }} paragraph={{ rows: 4 }} />
          </Card>
          <Card style={{ marginBottom: 24, borderRadius: 12 }}>
            <Skeleton active paragraph={{ rows: 3 }} />
          </Card>
          <Card style={{ borderRadius: 12 }}>
            <Skeleton active paragraph={{ rows: 6 }} />
          </Card>
        </div>
      ) : (
      <Form form={form} layout="vertical" onValuesChange={() => setIsDirty(true)}>
        <Row gutter={24} align="stretch" style={{ marginBottom: 24 }}>
          <Col xs={24} lg={16}>
            <Card style={{ height: '100%', borderLeft: '3px solid var(--primary-color)' }} title={<Space><FileSearchOutlined /><span>GRN Details</span></Space>}>
              {isEdit && (
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item label="GRN #">
                      <Input value={grnRecord?.grnNumber || ''} disabled />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="GRN Date">
                      <DatePicker
                        style={{ width: '100%' }}
                        value={grnRecord?.grnDate ? dayjs(grnRecord.grnDate) : null}
                        disabled
                      />
                    </Form.Item>
                  </Col>
                </Row>
              )}
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="poId" label="Purchase Order" rules={[{ required: true, message: 'Select a PO' }]}>
                    <Select placeholder="Select PO" options={poOptions} onChange={handlePOChange} showSearch optionFilterProp="label" disabled={readOnly} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="challanNo"
                    label="Challan / Invoice Number"
                    required
                    rules={[
                      { required: true, message: 'Challan / Invoice Number is required' },
                      { pattern: CHALLAN_REGEX, message: 'Letters, digits, hyphen and slash only' },
                    ]}
                  >
                    <Input placeholder="e.g. INV-2026/0123" disabled={readOnly} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="invoiceDate"
                    label="Invoice Date"
                    required
                    rules={[{ required: true, message: 'Invoice Date is required' }]}
                  >
                    <DatePicker
                      style={{ width: '100%' }}
                      disabled={readOnly || !selectedPO}
                      disabledDate={(d) => {
                        if (!d) return false;
                        if (d.isAfter(dayjs(), 'day')) return true;
                        if (selectedPO?.createdDate && d.isBefore(dayjs(selectedPO.createdDate).startOf('day'))) return true;
                        if (selectedPO?.expectedDeliveryDate && d.isAfter(dayjs(selectedPO.expectedDeliveryDate).endOf('day'))) return true;
                        return false;
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="deliveryChallanDate"
                    label="Delivery Challan Date"
                    required
                    rules={[{ required: true, message: 'Delivery Challan Date is required' }]}
                  >
                    <DatePicker
                      style={{ width: '100%' }}
                      disabled={readOnly || !selectedPO}
                      disabledDate={(d) => {
                        if (!d) return false;
                        if (d.isAfter(dayjs(), 'day')) return true;
                        if (selectedPO?.createdDate && d.isBefore(dayjs(selectedPO.createdDate).startOf('day'))) return true;
                        if (selectedPO?.expectedDeliveryDate && d.isAfter(dayjs(selectedPO.expectedDeliveryDate).endOf('day'))) return true;
                        return false;
                      }}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="vehicleNumber"
                    label="Vehicle Number"
                    required
                    rules={[{ required: true, message: 'Vehicle Number is required' }]}
                  >
                    <Input placeholder="e.g. TN-07-AZ-4521" disabled={readOnly} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="transporter"
                    label="Transporter"
                    required
                    rules={[{ required: true, message: 'Transporter is required' }]}
                  >
                    <Input placeholder="Transporter name" disabled={readOnly} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item label="Upload Delivery Challan">
                    <FileUpload
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      maxSizeMB={10}
                      previewUrl={dcImage.previewUrl}
                      fileName={dcImage.file?.name || dcImage.existingFile?.originalFilename}
                      fileType={dcImage.file?.type || dcImage.existingFile?.fileType}
                      compact
                      placeholder="Upload DC image or PDF"
                      disabled={readOnly}
                      onSelect={(file) => {
                        if (dcImage.previewUrl) URL.revokeObjectURL(dcImage.previewUrl);
                        setDcImage((prev) => ({
                          file,
                          previewUrl: URL.createObjectURL(file),
                          existingFile: null,
                          // queue the previously-persisted file (if any) for deletion
                          toDelete: prev.existingFile?.fileId || prev.toDelete,
                        }));
                        setIsDirty(true);
                      }}
                      onRemove={() => {
                        if (dcImage.previewUrl) URL.revokeObjectURL(dcImage.previewUrl);
                        setDcImage((prev) => ({
                          file: null,
                          previewUrl: null,
                          existingFile: null,
                          toDelete: prev.existingFile?.fileId || prev.toDelete,
                        }));
                        setIsDirty(true);
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label={<span>Upload Supplier Invoice <span style={{ color: 'var(--error-color)' }}>*</span></span>}
                    tooltip="Mandatory on submit. Image or PDF accepted."
                  >
                    <FileUpload
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      maxSizeMB={10}
                      previewUrl={supplierInvoice.previewUrl}
                      fileName={supplierInvoice.file?.name || supplierInvoice.existingFile?.originalFilename}
                      fileType={supplierInvoice.file?.type || supplierInvoice.existingFile?.fileType}
                      compact
                      placeholder="Upload invoice image or PDF"
                      disabled={readOnly}
                      onSelect={(file) => {
                        if (supplierInvoice.previewUrl) URL.revokeObjectURL(supplierInvoice.previewUrl);
                        setSupplierInvoice((prev) => ({
                          file,
                          previewUrl: URL.createObjectURL(file),
                          existingFile: null,
                          toDelete: prev.existingFile?.fileId || prev.toDelete,
                        }));
                        setIsDirty(true);
                      }}
                      onRemove={() => {
                        if (supplierInvoice.previewUrl) URL.revokeObjectURL(supplierInvoice.previewUrl);
                        setSupplierInvoice((prev) => ({
                          file: null,
                          previewUrl: null,
                          existingFile: null,
                          toDelete: prev.existingFile?.fileId || prev.toDelete,
                        }));
                        setIsDirty(true);
                      }}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <FabricGRNSummaryPanel selectedPO={selectedPO} rolls={rolls} createdBy={grnRecord?.createdByName} />
          </Col>
        </Row>

        {selectedPO && (
          <POLineItemPicker
            category={PO_CATEGORY}
            poLineItems={selectedPO.items || []}
            selectedIds={selectedLineItemIds}
            onSelectionChange={setSelectedLineItemIds}
            readOnly={readOnly}
          />
        )}

        <Card title={<Space><BranchesOutlined /><span>Roll Details</span></Space>} size="small" style={{ marginBottom: 24 }}>
          <FabricGRNRollTable rolls={rolls} onRollChange={handleRollChange} readOnly={readOnly} />
        </Card>

        <Card size="small">
          <Title level={5} style={{ marginBottom: 16 }}>Remarks</Title>
          <Form.Item name="remarks" noStyle>
            <TextArea rows={3} placeholder="Quality remarks or special notes" disabled={readOnly} />
          </Form.Item>
        </Card>
      </Form>
      )}
    </div>
  );
};

export default FabricGRNForm;
