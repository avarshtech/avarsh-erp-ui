import { useState, useCallback, useEffect, useMemo } from 'react';
import { App, Form, Input, Select, DatePicker, Card, Row, Col, Typography, Space, Tag, Skeleton } from 'antd';
import { SaveOutlined, SendOutlined, FileSearchOutlined, InboxOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import FileUpload from '../../../components/FileUpload';
import {
  getPurchaseOrdersForGRN,
  getAccessoriesGRN,
  saveTrimsGRNDraft,
  submitTrimsGRN,
  getItemVariantsBulk,
  getPurchaseOrderByIdAnyStatus,
  enrichPOWithReceipts,
} from '../../../services/inventory/inventoryService';
import { getFilesByEntity } from '../../../services/core/fileService';
import { processGrnAttachments } from './grnAttachments';
import { validateTrimsGRN } from '../../../utils/grnValidation';
import { DATE_FORMAT } from '../../../utils/uiConstants';
import { GRN_STATUS, GRN_CATEGORY, matchesGrnCategory, getInventoryStatusLabel } from '../../../utils/inventoryConstants';
import { GRN_STATUS_CONFIG } from '../../../utils/statusConfig';
import StatusTag from '../../../components/StatusTag';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import POLineItemPicker from './POLineItemPicker';
import AccessoriesGRNItemTable from './AccessoriesGRNItemTable';
import AccessoriesGRNCartonTable from './AccessoriesGRNCartonTable';
import AccessoriesGRNSummaryPanel from './AccessoriesGRNSummaryPanel';

const { Title } = Typography;
const { TextArea } = Input;

const CHALLAN_REGEX = /^[A-Za-z0-9\-/]+$/;

// Everything that is not fabric is received here as cartons — trims (local and
// imported), packing materials, and any other user-defined category. See
// matchesGrnCategory in utils/inventoryConstants.
const PO_CATEGORY = GRN_CATEGORY.ACCESSORIES;

const AccessoriesGRNForm = () => {
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
  const [items, setItems] = useState([]);
  const [cartons, setCartons] = useState([]);
  // File attachment state — same shape as Fabric form.
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

  // Trims POs only. A PO is eligible here if at least one of its line items
  // belongs to the Trims category.
  useEffect(() => {
    getPurchaseOrdersForGRN()
      .then((pos) => setPurchaseOrders(pos.filter((p) => (p.items || []).some((li) => matchesGrnCategory(li.categoryName, PO_CATEGORY)))))
      .catch(() => message.error('Failed to load purchase orders'));
  }, [message]);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    setEditLoading(true);
    (async () => {
      try {
        const grn = await getAccessoriesGRN(id);
        if (!grn || cancelled) return;
        const fullPO = await getPurchaseOrderByIdAnyStatus(grn.poId);
        if (cancelled) return;

        setGrnRecord(grn);
        const enriched = fullPO ? await enrichPOWithReceipts(fullPO, grn.id) : null;
        if (cancelled) return;
        setSelectedPO(enriched || { id: grn.poId, poNumber: grn.poNumber, supplier: grn.supplier, buyerName: grn.buyerName, styleNumber: grn.styleNumber, items: [] });

        // lineItems may be either an array of ids or an array of objects — handle both
        const lineIds = (grn.lineItems || []).map((li) => (typeof li === 'number' ? li : li.poLineItemId || li.id));
        // Fall back to items[].poLineItemId if no explicit lineItems array
        const fallbackIds = (grn.items || []).map((it) => it.poLineItemId).filter(Boolean);
        setSelectedLineItemIds(lineIds.length ? lineIds : fallbackIds);

        setItems(grn.items || []);
        setCartons(grn.cartons || []);

        form.setFieldsValue({
          poId: grn.poId,
          challanNo: grn.challanNo,
          invoiceDate: grn.invoiceDate ? dayjs(grn.invoiceDate) : null,
          deliveryChallanDate: grn.deliveryChallanDate ? dayjs(grn.deliveryChallanDate) : null,
          vehicleNumber: grn.vehicleNumber,
          transporter: grn.transporter,
          remarks: grn.remarks,
        });

        // Populate attachment state from file storage
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
    const enriched = po ? await enrichPOWithReceipts(po, grnRecord?.id) : null;
    setSelectedPO(enriched);
    setSelectedLineItemIds([]);
    setItems([]);
    setCartons([]);
    setIsDirty(true);
  }, [purchaseOrders, grnRecord?.id]);

  // Merge items + cartons when selection changes — preserving user-entered Receiving Qty,
  // Carton #, and Quantity for line items that remain selected.
  useEffect(() => {
    if (!selectedPO) return;
    let cancelled = false;
    // Resolve variant identity up front (async API), then reconcile items + cartons.
    const variantIds = selectedLineItemIds.map(
      (id) => (selectedPO.items || []).find((i) => i.id === id)?.variantId,
    );
    getItemVariantsBulk(variantIds).then((variants) => {
      if (cancelled) return;
      const variantByLineId = new Map(selectedLineItemIds.map((id, i) => [id, variants[i]]));

    setItems((prevItems) => {
      const kept = prevItems.filter((it) => selectedLineItemIds.includes(it.poLineItemId));
      const existingIds = new Set(prevItems.map((it) => it.poLineItemId));
      const newIds = selectedLineItemIds.filter((id) => !existingIds.has(id));
      if (newIds.length === 0 && kept.length === prevItems.length) return prevItems;
      const freshItems = newIds.map((id) => {
        const li = (selectedPO.items || []).find((i) => i.id === id);
        const v = variantByLineId.get(id);
        return {
          poLineItemId: id,
          variantId: li?.variantId,
          variantName: li?.variantName,
          variantCode: li?.variantCode,
          itemCode: li?.itemCode,
          description: li?.description,
          color: v?.color || '—',
          size: v?.size || '—',
          poQty: li?.orderedQty,
          alreadyReceived: li?.receivedQty,
          balance: li?.pendingQty,
          receivingQty: null,
          uom: v?.primaryUom || li?.uom,
          rate: li?.rate,
          defaultAllowance: li?.defaultAllowance,
        };
      });
      const byId = new Map();
      [...kept, ...freshItems].forEach((it) => byId.set(it.poLineItemId, it));
      return selectedLineItemIds.map((id) => byId.get(id)).filter(Boolean);
    });

    setCartons((prevCartons) => {
      const kept = prevCartons.filter((c) => selectedLineItemIds.includes(c.poLineItemId));
      const existingLineItemIds = new Set(prevCartons.map((c) => c.poLineItemId));
      const newLineIds = selectedLineItemIds.filter((id) => !existingLineItemIds.has(id));
      if (newLineIds.length === 0 && kept.length === prevCartons.length) return prevCartons;
      const freshCartons = newLineIds.map((id) => {
        const li = (selectedPO.items || []).find((i) => i.id === id);
        const v = variantByLineId.get(id);
        return {
          poLineItemId: id,
          cartonNumber: '',
          itemCode: li?.itemCode,
          itemDescription: li?.description,
          color: v?.color || '—',
          size: v?.size || '—',
          quantity: null,
          // A carton's quantity is part of the receipt — validation requires the cartons
          // to add up to the received quantity — so it is counted in the SAME unit the
          // line was received in. Preferring the secondary UOM labelled 210 cones of
          // thread as metres.
          uom: v?.primaryUom || li?.uom,
        };
      });
      // Preserve multiple cartons per line item (for edit mode)
      const result = [];
      selectedLineItemIds.forEach((id) => {
        const keptForLine = kept.filter((c) => c.poLineItemId === id);
        if (keptForLine.length > 0) result.push(...keptForLine);
        else {
          const fresh = freshCartons.find((c) => c.poLineItemId === id);
          if (fresh) result.push(fresh);
        }
      });
      return result;
    });
    });
    return () => { cancelled = true; };
  }, [selectedPO, selectedLineItemIds]);

  const handleItemChange = useCallback((idx, field, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
    setIsDirty(true);
  }, []);

  const handleCartonChange = useCallback((idx, field, value) => {
    setCartons((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
    setIsDirty(true);
  }, []);

  const buildPayload = () => {
    const values = form.getFieldsValue();
    return {
      id: grnRecord?.id,
      grnNumber: grnRecord?.grnNumber,
      type: 'Accessories',
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
      lineItems: selectedLineItemIds,
      items,
      cartons,
      version: grnRecord?.version,
      // File attachments live in fil_file_storage — see FabricGRNForm notes.
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
    const errors = validateTrimsGRN(payload, false, { po: selectedPO });
    if (errors.length) { errors.slice(0, 3).forEach((e) => message.error(e)); return; }
    setSavingDraft(true);
    try {
      const saved = await saveTrimsGRNDraft(payload);
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
    const errors = validateTrimsGRN(payload, true, { po: selectedPO });
    if (errors.length) { errors.slice(0, 5).forEach((e) => message.error(e)); return; }
    setSubmittingForm(true);
    try {
      const saved = await submitTrimsGRN(payload);
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
              <span>Edit Accessories GRN</span>
              {grnRecord?.grnNumber && (
                <Tag
                  color="purple"
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
            'New Accessories GRN'
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
                        format={DATE_FORMAT}
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
                      format={DATE_FORMAT}
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
                      format={DATE_FORMAT}
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
                    <Input placeholder="e.g. MH-12-QW-3344" disabled={readOnly} />
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
                      infoMessage="This file is saved together with the GRN when you submit — it is not uploaded on its own."
                      onSelect={(file) => {
                        if (dcImage.previewUrl) URL.revokeObjectURL(dcImage.previewUrl);
                        setDcImage((prev) => ({
                          file,
                          previewUrl: URL.createObjectURL(file),
                          existingFile: null,
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
                      infoMessage="This file is saved together with the GRN when you submit — it is not uploaded on its own."
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
            <AccessoriesGRNSummaryPanel selectedPO={selectedPO} items={items} cartons={cartons} createdBy={grnRecord?.createdByName} />
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

        <Card title={<Space><InboxOutlined /><span>Accessories Details</span></Space>} size="small" style={{ marginBottom: 24 }}>
          <AccessoriesGRNItemTable items={items} onItemChange={handleItemChange} readOnly={readOnly} />
        </Card>

        <Card title={<Space><InboxOutlined /><span>Carton Details</span></Space>} size="small" style={{ marginBottom: 24 }}>
          <AccessoriesGRNCartonTable cartons={cartons} items={items} onCartonChange={handleCartonChange} readOnly={readOnly} />
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

export default AccessoriesGRNForm;
