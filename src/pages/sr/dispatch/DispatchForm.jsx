import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Card, Form, Typography, Alert, Button, Space, Skeleton, Row, Col,
} from 'antd';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { createDispatch, updateDispatch, markDispatched } from '../../../services/sr/srService';
import { uploadFile } from '../../../services/core/fileService';
import useSampleMasters from '../../../hooks/useSampleMasters';
import { DELIVERY_METHODS, DISPATCH_STATUS, getDispatchStatusLabel } from '../../../utils/sampleRequestConstants';
import { SR_DISPATCH_STATUS_CONFIG } from '../../../utils/statusConfig';
import { hasPermission, getCurrentUser } from '../../../utils/permissions';
import { toastUnlessHandled } from '../../../utils/apiError';
import { ActionButton } from '../../../components/buttons';
import PageHeader from '../../../components/PageHeader';
import StatusTag from '../../../components/StatusTag';
import DispatchFields from './DispatchFields';
import DispatchSrTable from './DispatchSrTable';
import useDispatchFormData from './useDispatchFormData';
import { invoiceRequiredModal } from './invoiceRequired';

const { Text } = Typography;
const LIST_PATH = '/sample-requests/dispatches/list';
// Sticky header card carrying the dispatch actions (Supplier PO form pattern)
const STICKY_HEADER = { position: 'sticky', top: 64, zIndex: 10 };

/**
 * Dispatch create/edit (R2): groups many In-Production SRs of ONE customer into
 * a single shipment. Overseas consignees are gated on an issued COMMERCIAL
 * invoice covering every SR (the server enforces it — INVOICE_REQUIRED names the
 * uncovered ones). Mark as Dispatched is irreversible; once dispatched the
 * record is immutable and opens in the list's read-only dialog instead.
 *
 * Only ids are sent: the buyer's name and country, the courier's name and the
 * buying-office label are resolved and snapshotted server-side.
 */
const DispatchForm = () => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();

  const { couriers, loading: couriersLoading } = useSampleMasters();
  const {
    loading, record, adopt, buyerId, setBuyerId,
    customers, customersLoading, srRows, srsLoading, locations, locationsLoading,
  } = useDispatchFormData({ id, message });

  const [selectedIds, setSelectedIds] = useState([]);
  // Saved documents come back on the DTO; newly picked ones are Files held here
  // until a save gives them an id to hang off.
  const [documents, setDocuments] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [dirty, setDirty] = useState(false);

  const canSave = id ? hasPermission('sample-dispatches', 'update') : hasPermission('sample-dispatches', 'add');

  const currentUserLabel = useMemo(() => {
    const u = getCurrentUser();
    const name = typeof u === 'string' ? u : (u?.name || u?.username || 'Logged-in user');
    return `${name} (logged-in)`;
  }, []);

  // Adopt the loaded dispatch's selection and documents once it arrives
  useEffect(() => {
    if (!record) return;
    setSelectedIds(record.srIds || []);
    setDocuments(record.documents || []);
  }, [record]);

  const overseas = Boolean(record
    ? record.overseas
    : customers.find((c) => c.buyerId === buyerId)?.overseas);

  const handleBuyerChange = useCallback((next) => {
    setBuyerId(next);
    setSelectedIds([]);
    setDirty(true);
  }, [setBuyerId]);

  const handleSelectionChange = useCallback((keys) => { setSelectedIds(keys); setDirty(true); }, []);

  const stageFiles = useCallback((updater) => { setPendingFiles(updater); setDirty(true); }, []);

  const buildDto = useCallback((values) => ({
    // Optimistic locking — the server rejects a stale version with 409
    version: record?.version,
    buyerId,
    srIds: selectedIds,
    deliveryMethod: values.deliveryMethod,
    dispatchedDate: values.dispatchedDate ? values.dispatchedDate.format('YYYY-MM-DD') : null,
    courierId: values.courierId,
    trackingNo: values.trackingNo || null,
    dispatchMode: values.dispatchMode,
    packages: values.packages ?? null,
    courierCost: values.courierCost ?? null,
    // The label is snapshotted server-side from the buyer's shipping location
    buyingOfficeLocationId: values.buyingOfficeLocationId ?? null,
    handedOverTo: values.handedOverTo || null,
    acknowledgement: values.acknowledgement || null,
    remarks: values.remarks || '',
  }), [record, buyerId, selectedIds]);

  /**
   * Files need an entity to hang off, so they go up after the dispatch has an
   * id. A failed upload does not roll the save back — the draft is still there
   * to retry from, which is better than losing the shipment details with it.
   */
  const uploadPending = useCallback(async (entityId) => {
    if (!pendingFiles.length) return [];
    const results = await Promise.allSettled(pendingFiles.map((file) => uploadFile(file, {
      module: 'SAMPLE_REQUEST',
      entity: 'SAMPLE_DISPATCH',
      entityId,
      fileCategory: 'DOCUMENT',
    })));
    setPendingFiles([]);
    const uploaded = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    const failed = results.length - uploaded.length;
    if (failed) {
      message.warning(`Dispatch saved, but ${failed} document${failed > 1 ? 's' : ''} failed to upload. Edit the dispatch to retry.`);
    }
    return uploaded;
  }, [pendingFiles, message]);

  const persistDraft = useCallback(async () => {
    const dto = buildDto(form.getFieldsValue());
    const saved = record?.id ? await updateDispatch(record.id, dto) : await createDispatch(dto);
    const uploaded = await uploadPending(saved.id);
    const next = uploaded.length
      ? { ...saved, documents: [...(saved.documents || []), ...uploaded] }
      : saved;
    // The effect above republishes the selection and the documents off the
    // adopted record, so the server's answer is the only authority for both.
    adopt(next);
    setDirty(false);
    return next;
  }, [buildDto, form, record, uploadPending, adopt]);

  const handleSaveDraft = useCallback(async () => {
    setSaving(true);
    try {
      const saved = await persistDraft();
      message.success(`${saved.dispatchNo} saved as draft`);
      navigate(LIST_PATH);
    } catch (e) { toastUnlessHandled(message, e, 'Failed to save'); } finally { setSaving(false); }
  }, [persistDraft, message, navigate]);

  const handleGenerateInvoice = useCallback(async () => {
    if (record?.id && !dirty) {
      navigate(`/sample-requests/invoices/new?dispatchId=${record.id}`);
      return;
    }
    setInvoicing(true);
    try {
      const saved = await persistDraft();
      message.success(`${saved.dispatchNo} saved as draft`);
      navigate(`/sample-requests/invoices/new?dispatchId=${saved.id}`);
    } catch (e) { toastUnlessHandled(message, e, 'Failed to save draft'); } finally { setInvoicing(false); }
  }, [record, dirty, persistDraft, message, navigate]);

  const handleMarkDispatched = useCallback(async () => {
    try { await form.validateFields(); } catch { return; /* validation errors shown inline */ }
    modal.confirm({
      title: 'Mark as Dispatched?',
      content: 'This is irreversible — the record locks permanently for audit integrity and every SR on it moves to Dispatched.',
      okText: 'Mark as Dispatched',
      onOk: async () => {
        setDispatching(true);
        try {
          const saved = await persistDraft();
          const done = await markDispatched(saved.id, saved.version);
          message.success(`${done.dispatchNo} dispatched — ${done.srCount} SR(s) moved to Dispatched`);
          navigate(LIST_PATH);
        } catch (e) {
          if (e.code === 'INVOICE_REQUIRED') {
            modal.warning(invoiceRequiredModal(e));
          } else {
            toastUnlessHandled(message, e, 'Failed to dispatch');
          }
        } finally { setDispatching(false); }
      },
    });
  }, [form, modal, persistDraft, message, navigate]);

  const handleCancel = useCallback(() => {
    if (!dirty) { navigate(LIST_PATH); return; }
    modal.confirm({
      title: 'Discard changes?',
      content: 'Unsaved changes to this dispatch will be lost.',
      okText: 'Discard',
      okButtonProps: { danger: true },
      onOk: () => navigate(LIST_PATH),
    });
  }, [dirty, modal, navigate]);

  const initialValues = useMemo(() => ({
    deliveryMethod: record?.deliveryMethod || DELIVERY_METHODS.COURIER,
    dispatchedDate: record?.dispatchedDate ? dayjs(record.dispatchedDate) : dayjs(),
    courierId: record?.courierId,
    trackingNo: record?.trackingNo,
    dispatchMode: record?.dispatchMode,
    packages: record?.packages ?? 1,
    courierCost: record?.courierCost,
    buyingOfficeLocationId: record?.buyingOfficeLocationId,
    handedOverTo: record?.handedOverTo,
    acknowledgement: record?.acknowledgement,
    remarks: record?.remarks,
  }), [record]);

  if (loading) {
    return (
      <div className="animate-fade-in-up">
        <div className="page-header" style={STICKY_HEADER}>
          <Space>
            <Skeleton.Button active size="small" style={{ width: 32, height: 32 }} />
            <Skeleton.Input active style={{ width: 200 }} />
            <Skeleton.Button active size="small" style={{ width: 70 }} />
          </Space>
          <Space>
            <Skeleton.Button active style={{ width: 90 }} />
            <Skeleton.Button active style={{ width: 110 }} />
            <Skeleton.Button active style={{ width: 170 }} />
          </Space>
        </div>
        <Card size="small">
          <Skeleton.Input active style={{ width: 180, marginBottom: 24 }} />
          <div style={{ maxWidth: 380, marginBottom: 12 }}>
            <Skeleton.Input active size="small" style={{ width: 80, marginBottom: 8 }} block={false} />
            <Skeleton.Input active block />
          </div>
          <Skeleton active title={false} paragraph={{ rows: 4 }} />
        </Card>
        <Card size="small" style={{ marginTop: 16 }}>
          <Skeleton.Input active style={{ width: 180, marginBottom: 24 }} />
          <div style={{ maxWidth: 240, marginBottom: 16 }}>
            <Skeleton.Input active size="small" style={{ width: 80, marginBottom: 8 }} block={false} />
            <Skeleton.Input active block />
          </div>
          <Row gutter={16}>
            {[
              { key: 'dispatchedDate', xs: 24, sm: 8 },
              { key: 'courier', xs: 24, sm: 8 },
              { key: 'trackingNo', xs: 24, sm: 8 },
              { key: 'dispatchMode', xs: 24, sm: 8 },
              { key: 'packages', xs: 12, sm: 4 },
              { key: 'courierCost', xs: 12, sm: 6 },
              { key: 'dispatchedBy', xs: 24, sm: 6 },
            ].map((f) => (
              <Col xs={f.xs} sm={f.sm} key={f.key} style={{ marginBottom: 16 }}>
                <Skeleton.Input active size="small" style={{ width: 80, marginBottom: 8 }} block={false} />
                <Skeleton.Input active block />
              </Col>
            ))}
          </Row>
          <div style={{ marginBottom: 16 }}>
            <Skeleton.Input active size="small" style={{ width: 80, marginBottom: 8 }} block={false} />
            <Skeleton.Input active block />
          </div>
          <div>
            <Skeleton.Input active size="small" style={{ width: 80, marginBottom: 8, display: 'block' }} block={false} />
            <Skeleton.Button active style={{ width: 140 }} />
          </div>
        </Card>
      </div>
    );
  }

  // A dispatched record is immutable — there is nothing to edit, so send it to
  // the list's read-only dialog instead of rendering a full-screen page.
  if (record && record.status === DISPATCH_STATUS.DISPATCHED) {
    return <Navigate to={`${LIST_PATH}?viewId=${record.id}`} replace />;
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={record ? `Dispatch ${record.dispatchNo}` : 'New Dispatch'}
        backPath={LIST_PATH}
        style={STICKY_HEADER}
        status={record && <StatusTag status={record.status} config={SR_DISPATCH_STATUS_CONFIG} getLabel={getDispatchStatusLabel} />}
      >
        <ActionButton action="close" text="Cancel" onClick={handleCancel} />
        {canSave && (
          <ActionButton action="save" variant="draft" text="Save Draft" loading={saving} onClick={handleSaveDraft} />
        )}
        {canSave && (
          <ActionButton action="send" text="Mark as Dispatched" loading={dispatching} onClick={handleMarkDispatched} />
        )}
      </PageHeader>

      {overseas && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Overseas consignee — an issued Commercial invoice must cover every SR before Mark as Dispatched"
          action={(
            <Button size="small" loading={invoicing} onClick={handleGenerateInvoice}>
              Generate Commercial Invoice
            </Button>
          )}
        />
      )}

      {record?.companyCountryMissing && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="No company country configured — every consignee is treated as domestic and the invoice gate stays open. Set it under Admin → Company Profile."
        />
      )}

      <DispatchSrTable
        customers={customers}
        customersLoading={customersLoading}
        buyerId={buyerId}
        onBuyerChange={handleBuyerChange}
        locked={Boolean(record)}
        current={record}
        rows={srRows}
        rowsLoading={srsLoading}
        selectedIds={selectedIds}
        onSelectionChange={handleSelectionChange}
      />

      <Card size="small" title="Dispatch Details" style={{ marginTop: 16 }}>
        <Form form={form} layout="vertical" initialValues={initialValues} onValuesChange={() => setDirty(true)}>
          <DispatchFields
            form={form}
            couriers={couriers}
            locations={locations}
            mastersLoading={locationsLoading || couriersLoading}
            documents={documents}
            pendingFiles={pendingFiles}
            setPendingFiles={stageFiles}
            currentUserLabel={currentUserLabel}
          />
        </Form>
        {!record && pendingFiles.length > 0 && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Documents upload when the draft is saved.
          </Text>
        )}
      </Card>

    </div>
  );
};

export default DispatchForm;
