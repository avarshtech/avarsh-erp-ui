import { useState, useCallback, useEffect, useMemo } from 'react';
import { App, Form, Input, Select, DatePicker, Card, Row, Col, Typography, Divider, Progress, Alert, Tag, Skeleton } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { InboxOutlined } from '@ant-design/icons';
import { hasPermission, getCurrentUser } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import {
  getIssueWorkOrders,
  getIssue,
  createAccessoriesIssue,
} from '../../../services/inventory/materialIssueService';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import { formatNumber } from '../../../utils/formatters';
import AccessoriesIssueItemTable from './AccessoriesIssueItemTable';

const { Title, Text } = Typography;
const { TextArea } = Input;

const SummaryRow = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
    <Text type="secondary">{label}</Text>
    <Text strong style={color ? { color } : undefined}>{value}</Text>
  </div>
);

const ReadOnlyField = ({ label, value }) => (
  <div>
    <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>{label}</Text>
    <Text strong>{value || '—'}</Text>
  </div>
);

const AccessoriesIssueForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const isEdit = Boolean(id);

  const [workOrders, setWorkOrders] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);
  const [items, setItems] = useState([]);
  const [editRecord, setEditRecord] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(Boolean(id));
  const [isDirty, setIsDirty] = useState(false);
  const { clearDirty } = useUnsavedChanges(isDirty);

  useEffect(() => {
    getIssueWorkOrders()
      .then((res) => setWorkOrders(res.content || []))
      .catch(() => message.error('Failed to load approved Work Orders'));
  }, [message]);

  // Edit-mode hydration: once work orders load, fetch the issue record and
  // replay the WO selection + issued quantities per BOM item.
  useEffect(() => {
    if (!isEdit || !workOrders.length) return;
    let cancelled = false;
    (async () => {
      try {
        const record = await getIssue(id);
        if (cancelled || !record) return;
        setEditRecord(record);
        setLoadingEdit(false);
        const wo = workOrders.find((w) => w.workOrderNumber === record.workOrder);
        if (!wo) return;
        setSelectedWO(wo);
        const issuedByCode = new Map(
          (record.items || []).map((it) => [it.itemCode, Number(it.issuedQty) || 0]),
        );
        setItems(wo.bomItems.map((bi) => ({
          ...bi,
          issueQty: issuedByCode.has(bi.itemCode) ? issuedByCode.get(bi.itemCode) : null,
        })));
        form.setFieldsValue({
          workOrder: wo.id,
          receivedBy: record.receivedBy,
          issueDate: record.issueDate ? dayjs(record.issueDate) : dayjs(),
          issuedBy: record.issuedBy,
          remarks: record.remarks,
        });
      } catch {
        message.error('Failed to load issue for edit');
        setLoadingEdit(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, id, workOrders, form, message]);

  const handleWOChange = useCallback((woId) => {
    const wo = workOrders.find((w) => w.id === woId) || null;
    setSelectedWO(wo);
    if (wo?.bomItems) {
      setItems(wo.bomItems.map((bi) => ({
        ...bi,
        issueQty: null,
      })));
    } else {
      setItems([]);
    }
    setIsDirty(true);
  }, [workOrders]);

  const handleItemChange = useCallback((index, field, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
    setIsDirty(true);
  }, []);

  const [saving, setSaving] = useState(false);

  const handleSubmit = useCallback(() => {
    // Issues are physical stock movements — once COMPLETED they cannot be
    // amended, only viewed (a cancel/reversal flow is a future enhancement).
    if (isEdit) {
      message.info('Completed issues cannot be amended — create a new issue instead');
      return;
    }
    form.validateFields().then(async (values) => {
      const withQty = items.filter((it) => (it.issueQty || 0) > 0);
      if (!withQty.length) {
        message.warning('Enter Issue Qty for at least one BOM item');
        return;
      }
      setSaving(true);
      try {
        const saved = await createAccessoriesIssue({
          workOrderId: selectedWO.id,
          receivedBy: values.receivedBy,
          issueDate: values.issueDate?.format('YYYY-MM-DD'),
          remarks: values.remarks,
          items: withQty.map((it) => ({
            itemId: it.id,
            itemCode: it.itemCode,
            issueQty: it.issueQty,
          })),
        });
        message.success(`${saved.issueNumber} issued — stock cleared from inventory`);
        clearDirty();
        navigate('/inventory/issue');
      } catch (e) {
        message.error(e.errorMessage || e.message || 'Failed to save issue');
      } finally {
        setSaving(false);
      }
    }).catch(() => message.warning('Please fill all required fields'));
  }, [form, message, navigate, clearDirty, items, selectedWO, isEdit]);

  const woOptions = useMemo(
    () => workOrders.map((wo) => ({ label: `${wo.workOrderNumber} — ${wo.style}`, value: wo.id })),
    [workOrders],
  );

  const stats = useMemo(() => {
    const withStock = items.filter((i) => (i.availableStock || 0) >= (i.bomQty || 0)).length;
    const shortage = items.filter((i) => (i.availableStock || 0) < (i.bomQty || 0)).length;
    // BOM fulfillment = sum(min(bomQty, priorIssued + thisIssue)) / sum(bomQty).
    // Priors (`issuedCumulative` from earlier issues against the same WO) are
    // included so the bar advances beyond what this single issue contributes.
    // Each line caps at its own bomQty to keep over-issues from inflating %.
    const totalFulfilled = items.reduce((sum, i) => {
      const bom = i.bomQty || 0;
      const total = (i.issuedCumulative || 0) + (i.issueQty || 0);
      return sum + Math.min(bom, total);
    }, 0);
    const totalBom = items.reduce((sum, i) => sum + (i.bomQty || 0), 0);
    const pct = totalBom > 0 ? (totalFulfilled / totalBom) * 100 : 0;
    return { total: items.length, withStock, shortage, pct };
  }, [items]);

  const currentUserName = getCurrentUser()?.name || '—';

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={
          isEdit ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span>Edit Accessories Issue</span>
              {editRecord?.issueNumber && (
                <Tag
                  color="processing"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 26,
                    padding: '0 10px',
                    fontSize: 13,
                    lineHeight: 1,
                    margin: 0,
                  }}
                >
                  {editRecord.issueNumber}
                </Tag>
              )}
            </span>
          ) : 'New Accessories Issue'
        }
        backPath="/inventory/issue"
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        {hasPermission('inventory-issue', isEdit ? 'update' : 'add') && (
          <ActionButton action="save" text="Issue" loading={saving} onClick={handleSubmit} />
        )}
      </PageHeader>
      {isEdit && loadingEdit ? (
        <>
          <Card style={{ marginBottom: 24 }}>
            <Skeleton active paragraph={{ rows: 4 }} />
          </Card>
          <Card style={{ marginBottom: 24 }}>
            <Skeleton active paragraph={{ rows: 6 }} />
          </Card>
        </>
      ) : (
      <Form form={form} layout="vertical" onValuesChange={() => setIsDirty(true)}>
        <Row gutter={24} align="stretch" style={{ marginBottom: 24 }}>
          <Col xs={24} lg={16}>
            <Card style={{ height: '100%' }}>
              <Title level={5} style={{ marginBottom: 24 }}>Issue Details</Title>
              <Row gutter={24}>
                <Col xs={24} sm={24} md={12} lg={12}>
                  <Form.Item name="workOrder" label="Work Order" rules={[{ required: true, message: 'Select a Work Order' }]}>
                    <Select placeholder="Select Work Order" options={woOptions} onChange={handleWOChange} showSearch optionFilterProp="label" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={24} md={12} lg={12}>
                  <Form.Item name="receivedBy" label="Received By" rules={[{ required: true, message: 'Enter receiver name' }]}>
                    <Input placeholder="Name of receiver" />
                  </Form.Item>
                </Col>
              </Row>
              {isEdit && (
                <Row gutter={24}>
                  <Col xs={24}>
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                      <ReadOnlyField label="Issue Date" value={form.getFieldValue('issueDate')?.format?.('DD-MMM-YYYY')} />
                      <ReadOnlyField label="Issued By" value={form.getFieldValue('issuedBy') || currentUserName} />
                    </div>
                  </Col>
                </Row>
              )}
              <Form.Item name="issueDate" initialValue={dayjs()} hidden><DatePicker /></Form.Item>
              <Form.Item name="issuedBy" initialValue={currentUserName} hidden><Input /></Form.Item>
              {selectedWO && (
                <>
                  <Divider style={{ margin: '20px 0 16px' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>Issue Progress</Text>
                    <Text strong style={{ fontSize: 13 }}>{formatNumber(stats.pct, 1)}%</Text>
                  </div>
                  <Progress
                    percent={Number(stats.pct.toFixed(1))}
                    status={stats.pct >= 100 ? 'success' : 'active'}
                    showInfo={false}
                  />
                </>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card style={{ height: '100%' }}>
              <Title level={5} style={{ marginBottom: 16 }}>Work Order</Title>
              {selectedWO ? (<>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  <SummaryRow label="Work Order" value={selectedWO.workOrderNumber} />
                  <SummaryRow label="Style" value={selectedWO.style} />
                  <SummaryRow label="Buyer" value={selectedWO.buyer} />
                  <SummaryRow label="Order Qty" value={selectedWO.orderQty} />
                  <SummaryRow label="Production Unit" value={selectedWO.productionUnit || '—'} />
                </div>
                <Divider style={{ margin: '12px 0' }} />
                <Title level={5} style={{ marginBottom: 12 }}>Items Summary</Title>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <SummaryRow label="Total BOM Items" value={stats.total} />
                  <SummaryRow label="Items with Stock" value={stats.withStock} color="var(--success-color)" />
                  <SummaryRow label="Shortage Items" value={stats.shortage} color={stats.shortage > 0 ? 'var(--error-color)' : undefined} />
                </div>
                {stats.shortage > 0 && (
                  <Alert type="warning" showIcon message={`${stats.shortage} item(s) have insufficient stock`} style={{ marginTop: 12 }} />
                )}
              </>) : (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <InboxOutlined style={{ fontSize: 32, marginBottom: 8, color: 'var(--text-secondary)' }} />
                  <br />
                  <Text type="secondary">Select a Work Order</Text>
                </div>
              )}
            </Card>
          </Col>
        </Row>
        <Card style={{ marginBottom: 24 }}>
          <Title level={5} style={{ marginBottom: 16 }}>BOM Items</Title>
          <AccessoriesIssueItemTable items={items} onItemChange={handleItemChange} />
        </Card>
        <Card>
          <Title level={5} style={{ marginBottom: 16 }}>Remarks</Title>
          <Form.Item name="remarks" noStyle><TextArea rows={3} placeholder="Issue remarks or special instructions" /></Form.Item>
        </Card>
      </Form>
      )}
    </div>
  );
};

export default AccessoriesIssueForm;
