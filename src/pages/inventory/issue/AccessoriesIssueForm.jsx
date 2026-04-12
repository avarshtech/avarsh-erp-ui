import { useState, useCallback, useEffect, useMemo } from 'react';
import { App, Form, Input, Select, DatePicker, Card, Row, Col, Typography, Divider, Progress, Alert } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { InboxOutlined } from '@ant-design/icons';
import { hasPermission } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { getProductionOrders, getAccessoriesStock } from '../../../services/inventory/inventoryService';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import AccessoriesIssueItemTable from './AccessoriesIssueItemTable';

const { Title, Text } = Typography;
const { TextArea } = Input;

const SummaryRow = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
    <Text type="secondary">{label}</Text><Text strong style={color ? { color } : undefined}>{value}</Text>
  </div>
);

const AccessoriesIssueForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const isEdit = Boolean(id);
  const [productionOrders, setProductionOrders] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [items, setItems] = useState([]);
  const [isDirty, setIsDirty] = useState(false);
  const { clearDirty } = useUnsavedChanges(isDirty);

  useEffect(() => {
    getProductionOrders().then(setProductionOrders).catch(() => message.error('Failed to load production orders'));
  }, [message]);

  const handlePOChange = useCallback(async (poId) => {
    const po = productionOrders.find((p) => p.id === poId);
    setSelectedPO(po || null);
    if (po?.bomItems) {
      try {
        const stockRes = await getAccessoriesStock();
        const stockMap = new Map((stockRes.content || []).map((s) => [s.itemCode, s.availableQty || 0]));
        setItems(po.bomItems.map((item) => ({ ...item, availableStock: stockMap.get(item.itemCode) || 0, issueQty: 0 })));
      } catch { message.error('Failed to load stock data'); }
    } else { setItems([]); }
    setIsDirty(true);
  }, [productionOrders, message]);

  const handleItemChange = useCallback((index, field, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
    setIsDirty(true);
  }, []);

  const handleSubmit = useCallback((status) => {
    form.validateFields().then((values) => {
      message.success(`Accessories issue ${status === 'Draft' ? 'saved as draft' : 'issued'} successfully`);
      clearDirty();
      navigate('/inventory/issue/accessories');
    }).catch(() => message.warning('Please fill all required fields'));
  }, [form, message, navigate, clearDirty]);

  const poOptions = useMemo(() => productionOrders.map((po) => ({ label: `${po.poNumber} - ${po.style}`, value: po.id })), [productionOrders]);

  const stats = useMemo(() => {
    const withStock = items.filter((i) => (i.availableStock || 0) >= (i.bomQty || 0)).length;
    const shortage = items.filter((i) => (i.availableStock || 0) < (i.bomQty || 0)).length;
    const totalIssue = items.reduce((sum, i) => sum + (i.issueQty || 0), 0);
    const totalBom = items.reduce((sum, i) => sum + (i.bomQty || 0), 0);
    const pct = totalBom > 0 ? Math.min((totalIssue / totalBom) * 100, 100) : 0;
    return { total: items.length, withStock, shortage, pct };
  }, [items]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={isEdit ? 'Edit Accessories Issue' : 'New Accessories Issue'} backPath="/inventory/issue" style={{ position: 'sticky', top: 64, zIndex: 10 }}>
        {hasPermission('inventory', 'add') && (<>
          <ActionButton action="save" variant="draft" text="Save Draft" onClick={() => handleSubmit('Draft')} />
          <ActionButton action="save" text="Issue" onClick={() => handleSubmit('Issued')} />
        </>)}
      </PageHeader>
      <Form form={form} layout="vertical" initialValues={{ issueDate: dayjs() }} onValuesChange={() => setIsDirty(true)}>
        <Row gutter={24} align="stretch" style={{ marginBottom: 24 }}>
          <Col xs={24} lg={16}>
            <Card style={{ height: '100%' }}>
              <Title level={5} style={{ marginBottom: 24 }}>Issue Details</Title>
              <Row gutter={24}>
                <Col xs={24} md={12}><Form.Item name="productionOrder" label="Production Order" rules={[{ required: true, message: 'Select a production order' }]}><Select placeholder="Select production order" options={poOptions} onChange={handlePOChange} showSearch optionFilterProp="label" /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="issueDate" label="Issue Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Row gutter={24}>
                <Col xs={24} md={12}><Form.Item name="issuedBy" label="Issued By" rules={[{ required: true }]}><Input placeholder="Name of issuer" /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="receivedBy" label="Received By" rules={[{ required: true }]}><Input placeholder="Name of receiver" /></Form.Item></Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card style={{ height: '100%' }}>
              <Title level={5} style={{ marginBottom: 16 }}>Production Order</Title>
              {selectedPO ? (<>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  <SummaryRow label="PO #" value={selectedPO.poNumber} />
                  <SummaryRow label="Style" value={selectedPO.style} />
                  <SummaryRow label="Buyer" value={selectedPO.buyer} />
                </div>
                <Divider style={{ margin: '12px 0' }} />
                <Title level={5} style={{ marginBottom: 12 }}>Items Summary</Title>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <SummaryRow label="Total BOM Items" value={stats.total} />
                  <SummaryRow label="Items with Stock" value={stats.withStock} color="var(--success-color)" />
                  <SummaryRow label="Shortage Items" value={stats.shortage} color={stats.shortage > 0 ? 'var(--error-color)' : undefined} />
                </div>
                <Divider style={{ margin: '12px 0' }} />
                <Text type="secondary" style={{ fontSize: 13 }}>Issue Progress</Text>
                <Progress percent={Number(stats.pct.toFixed(1))} status={stats.pct >= 100 ? 'success' : 'active'} style={{ marginTop: 4 }} />
                {stats.shortage > 0 && <Alert type="warning" showIcon message={`${stats.shortage} item(s) have insufficient stock`} style={{ marginTop: 12 }} />}
              </>) : (
                <div style={{ textAlign: 'center', padding: '24px 0' }}><InboxOutlined style={{ fontSize: 32, marginBottom: 8, color: 'var(--text-secondary)' }} /><br /><Text type="secondary">Select a Production Order</Text></div>
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
    </div>
  );
};

export default AccessoriesIssueForm;
