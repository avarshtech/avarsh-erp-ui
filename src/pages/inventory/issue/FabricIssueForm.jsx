import { useState, useCallback, useEffect, useMemo } from 'react';
import { App, Form, Input, Select, DatePicker, Card, Row, Col, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { hasPermission } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { getProductionOrders, getFabricStock } from '../../../services/inventoryService';
import { STOCK_STATUS } from '../../../utils/inventoryConstants';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import FabricIssueRollPicker from './FabricIssueRollPicker';
import FabricIssueSummaryPanel from './FabricIssueSummaryPanel';

const { Title } = Typography;
const { TextArea } = Input;

const FabricIssueForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const isEdit = Boolean(id);

  const [productionOrders, setProductionOrders] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [availableRolls, setAvailableRolls] = useState([]);
  const [selectedRollIds, setSelectedRollIds] = useState([]);
  const [bomRequired, setBomRequired] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const { clearDirty } = useUnsavedChanges(isDirty);

  useEffect(() => {
    getProductionOrders().then(setProductionOrders).catch(() => message.error('Failed to load production orders'));
  }, [message]);

  const handlePOChange = useCallback(async (poId) => {
    const po = productionOrders.find((p) => p.id === poId);
    setSelectedPO(po || null);
    setSelectedRollIds([]);
    if (po) {
      setBomRequired(po.bomFabricWeight || 0);
      try {
        const res = await getFabricStock({ status: STOCK_STATUS.IN_STOCK, fabric: po.fabricType });
        setAvailableRolls(res.content || []);
      } catch { message.error('Failed to load available rolls'); }
    } else { setBomRequired(0); setAvailableRolls([]); }
    setIsDirty(true);
  }, [productionOrders, message]);

  const handleSelectionChange = useCallback((keys) => {
    setSelectedRollIds(keys);
    setIsDirty(true);
  }, []);

  const selectedRolls = useMemo(
    () => availableRolls.filter((r) => selectedRollIds.includes(r.id)),
    [availableRolls, selectedRollIds],
  );

  const handleSubmit = useCallback((status) => {
    form.validateFields().then((values) => {
      message.success(`Fabric issue ${status === 'Draft' ? 'saved as draft' : 'issued'} successfully`);
      clearDirty();
      navigate('/inventory/issue/fabric');
    }).catch(() => message.warning('Please fill all required fields'));
  }, [form, message, navigate, clearDirty]);

  const poOptions = useMemo(() => productionOrders.map((po) => ({ label: `${po.poNumber} - ${po.style}`, value: po.id })), [productionOrders]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={isEdit ? 'Edit Fabric Issue' : 'New Fabric Issue'} backPath="/inventory/issue" style={{ position: 'sticky', top: 64, zIndex: 10 }}>
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
                <Col xs={24} md={8}><Form.Item name="issuedBy" label="Issued By" rules={[{ required: true }]}><Input placeholder="Name of issuer" /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name="receivedBy" label="Received By" rules={[{ required: true }]}><Input placeholder="Name of receiver" /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name="productionLine" label="Production Line"><Input placeholder="e.g., Line 3" /></Form.Item></Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <FabricIssueSummaryPanel productionOrder={selectedPO} selectedRolls={selectedRolls} bomRequired={bomRequired} />
          </Col>
        </Row>
        <Card style={{ marginBottom: 24 }}>
          <Title level={5} style={{ marginBottom: 16 }}>Roll Selection</Title>
          <FabricIssueRollPicker availableRolls={availableRolls} selectedRollIds={selectedRollIds} onSelectionChange={handleSelectionChange} bomRequired={bomRequired} />
        </Card>
        <Card>
          <Title level={5} style={{ marginBottom: 16 }}>Remarks</Title>
          <Form.Item name="remarks" noStyle><TextArea rows={3} placeholder="Issue remarks or special instructions" /></Form.Item>
        </Card>
      </Form>
    </div>
  );
};

export default FabricIssueForm;
