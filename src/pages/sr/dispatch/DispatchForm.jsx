import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Card, Form, Table, Select, Tag, Typography, Alert, Button, Space, Skeleton, Row, Col,
} from 'antd';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  getDispatch, createDispatch, updateDispatch, markDispatched,
  listDispatchableSrs, listDispatchableCustomers, listCouriers, listBuyingOffices,
} from '../../../services/sr/srService';
import {
  DELIVERY_METHODS, DISPATCH_STATUS, getDispatchStatusLabel,
} from '../../../utils/sampleRequestConstants';
import { SR_DISPATCH_STATUS_CONFIG } from '../../../utils/statusConfig';
import { hasPermission, getCurrentUser } from '../../../utils/permissions';
import { ActionButton } from '../../../components/buttons';
import PageHeader from '../../../components/PageHeader';
import StatusTag from '../../../components/StatusTag';
import DaysRemainingTag from '../DaysRemainingTag';
import DispatchFields from './DispatchFields';

const { Text } = Typography;
const LIST_PATH = '/sample-requests/dispatches/list';
// Sticky header card carrying the dispatch actions (Supplier PO form pattern)
const STICKY_HEADER = { position: 'sticky', top: 64, zIndex: 10 };

/**
 * Dispatch create/edit (R2): groups many In-Production SRs of ONE customer into
 * a single shipment. Overseas consignees are gated on an issued COMMERCIAL
 * invoice covering every SR (service enforces — INVOICE_REQUIRED names the
 * uncovered ones). Mark as Dispatched is irreversible; once dispatched the
 * record is immutable and opens in the list's read-only dialog instead.
 */
const DispatchForm = () => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(Boolean(id));
  const [record, setRecord] = useState(null);
  const [couriers, setCouriers] = useState([]);
  const [offices, setOffices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [mastersLoading, setMastersLoading] = useState(true);
  const [customer, setCustomer] = useState(undefined);
  const [srRows, setSrRows] = useState([]);
  const [srsLoading, setSrsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [docs, setDocs] = useState([]);
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

  const loadSrs = useCallback(async (buyer, ownSrs = []) => {
    setSrsLoading(true);
    try {
      // The service excludes SRs on ANY dispatch (own included) — merge the
      // dispatch's own SRs back in as pre-checked selectable rows on edit.
      const rows = await listDispatchableSrs(buyer);
      setSrRows([...ownSrs, ...rows.filter((r) => !ownSrs.some((s) => s.id === r.id))]);
    } catch (e) {
      message.error(e.message || 'Failed to load dispatchable SRs');
    } finally { setSrsLoading(false); }
  }, [message]);

  useEffect(() => {
    Promise.all([
      listCouriers().then(setCouriers).catch(() => {}),
      listBuyingOffices().then(setOffices).catch(() => {}),
      listDispatchableCustomers().then(setCustomers).catch(() => {}),
    ]).finally(() => setMastersLoading(false));
  }, []);

  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    getDispatch(id)
      .then((d) => {
        if (cancelled) return;
        setRecord(d);
        setCustomer(d.buyerName);
        setSelectedIds(d.srIds || []);
        setDocs(d.documents || []);
        if (d.status === DISPATCH_STATUS.DRAFT) loadSrs(d.buyerName, d.srs || []);
      })
      .catch((e) => { if (!cancelled) message.error(e.message || 'Failed to load dispatch'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, loadSrs, message]);

  const buyerCountry = useMemo(() => {
    if (record) return record.buyerCountry || '';
    return customers.find((c) => c.name === customer)?.country || '';
  }, [record, customers, customer]);
  const overseas = Boolean(buyerCountry) && buyerCountry.trim().toLowerCase() !== 'india';

  const handleCustomerChange = useCallback((name) => {
    setCustomer(name);
    setSelectedIds([]);
    setDirty(true);
    loadSrs(name);
  }, [loadSrs]);

  const setDocsDirty = useCallback((updater) => { setDocs(updater); setDirty(true); }, []);

  const buildDto = useCallback((values) => ({
    buyerName: customer,
    buyerCountry,
    srIds: selectedIds,
    deliveryMethod: values.deliveryMethod,
    dispatchedDate: values.dispatchedDate ? values.dispatchedDate.format('YYYY-MM-DD') : null,
    courierId: values.courierId,
    courierName: couriers.find((c) => c.id === values.courierId)?.name || '',
    trackingNo: values.trackingNo || null,
    dispatchMode: values.dispatchMode,
    packages: values.packages ?? null,
    courierCost: values.courierCost ?? null,
    buyingOffice: values.buyingOffice || null,
    handedOverTo: values.handedOverTo || null,
    acknowledgement: values.acknowledgement || null,
    remarks: values.remarks || '',
    documents: docs,
  }), [customer, buyerCountry, selectedIds, couriers, docs]);

  const persistDraft = useCallback(async () => {
    const dto = buildDto(form.getFieldsValue());
    const saved = record?.id ? await updateDispatch(record.id, dto) : await createDispatch(dto);
    setRecord(saved);
    setDirty(false);
    return saved;
  }, [buildDto, form, record]);

  const handleSaveDraft = useCallback(async () => {
    setSaving(true);
    try {
      const saved = await persistDraft();
      message.success(`${saved.dispatchNo} saved as draft`);
      navigate(LIST_PATH);
    } catch (e) { message.error(e.message || 'Failed to save'); } finally { setSaving(false); }
  }, [persistDraft, message, navigate]);

  const handleGenerateInvoice = useCallback(async () => {
    if (record?.id) {
      navigate(`/sample-requests/invoices/new?dispatchId=${record.id}`);
      return;
    }
    setInvoicing(true);
    try {
      const saved = await persistDraft();
      message.success(`${saved.dispatchNo} saved as draft`);
      navigate(`/sample-requests/invoices/new?dispatchId=${saved.id}`);
    } catch (e) { message.error(e.message || 'Failed to save draft'); } finally { setInvoicing(false); }
  }, [record, persistDraft, message, navigate]);

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
          const done = await markDispatched(saved.id);
          message.success(`${done.dispatchNo} dispatched — ${done.srCount} SR(s) moved to Dispatched`);
          navigate(LIST_PATH);
        } catch (e) {
          if (e.code === 'INVOICE_REQUIRED') {
            modal.warning({ title: 'Commercial invoice required', content: e.message });
          } else {
            message.error(e.message || 'Failed to dispatch');
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

  const srColumns = useMemo(() => [
    {
      title: 'SR No', dataIndex: 'srNo', key: 'srNo', width: 140,
      render: (t) => <Text strong style={{ whiteSpace: 'nowrap' }}>{t}</Text>,
    },
    { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 120 },
    { title: 'Garment', dataIndex: 'garmentName', key: 'garmentName', ellipsis: true },
    {
      title: 'Sample Type', dataIndex: 'sampleTypeName', key: 'sampleTypeName', width: 160,
      render: (n) => <Tag color="purple" style={{ whiteSpace: 'nowrap', marginInlineEnd: 0 }}>{n}</Tag>,
    },
    { title: 'Qty', dataIndex: 'quantity', key: 'quantity', width: 70, align: 'right' },
    {
      title: 'Dispatch Deadline', dataIndex: 'dispatchDeadline', key: 'dispatchDeadline', width: 210,
      render: (d) => <DaysRemainingTag date={d} showDate />,
    },
  ], []);

  const customerOptions = useMemo(() => {
    const opts = customers.map((c) => ({ value: c.name, label: c.country ? `${c.name} · ${c.country}` : c.name }));
    if (record && !opts.some((o) => o.value === record.buyerName)) {
      opts.unshift({ value: record.buyerName, label: record.buyerCountry ? `${record.buyerName} · ${record.buyerCountry}` : record.buyerName });
    }
    return opts;
  }, [customers, record]);

  const initialValues = useMemo(() => ({
    deliveryMethod: record?.deliveryMethod || DELIVERY_METHODS.COURIER,
    dispatchedDate: record?.dispatchedDate ? dayjs(record.dispatchedDate) : dayjs(),
    courierId: record?.courierId,
    trackingNo: record?.trackingNo,
    dispatchMode: record?.dispatchMode,
    packages: record?.packages ?? 1,
    courierCost: record?.courierCost,
    buyingOffice: record?.buyingOffice,
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

      <Card size="small" title="Customer & Sample Requests">
        <div style={{ maxWidth: 380, marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: 0.4 }}>Customer</Text>
          <Select
            style={{ width: '100%' }}
            placeholder="Customers with dispatchable SRs"
            showSearch
            optionFilterProp="label"
            loading={mastersLoading}
            value={customer}
            onChange={handleCustomerChange}
            disabled={Boolean(record)}
            options={customerOptions}
          />
        </div>
        <Table
          rowKey="id"
          size="small"
          columns={srColumns}
          dataSource={srRows}
          loading={srsLoading}
          pagination={false}
          scroll={{ x: 860 }}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => { setSelectedIds(keys); setDirty(true); },
          }}
          locale={{ emptyText: customer ? 'No dispatchable In-Production SRs for this customer' : 'Select a customer to list its dispatchable SRs' }}
        />
        <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>{`${selectedIds.length} SR(s) selected`}</Text>
      </Card>

      <Card size="small" title="Dispatch Details" style={{ marginTop: 16 }}>
        <Form form={form} layout="vertical" initialValues={initialValues} onValuesChange={() => setDirty(true)}>
          <DispatchFields
            form={form}
            couriers={couriers}
            offices={offices}
            mastersLoading={mastersLoading}
            docs={docs}
            setDocs={setDocsDirty}
            currentUserLabel={currentUserLabel}
          />
        </Form>
      </Card>

    </div>
  );
};

export default DispatchForm;
