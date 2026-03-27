import { useState, useCallback, useEffect } from 'react';
import { App, Form, Input, Select, DatePicker, Card, Row, Col, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { hasPermission } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { getPurchaseOrdersForGRN, getFabricGRN } from '../../../services/inventoryService';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import FabricGRNRollTable from './FabricGRNRollTable';
import FabricGRNSummaryPanel from './FabricGRNSummaryPanel';

const { Title } = Typography;
const { TextArea } = Input;

const FabricGRNForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const isEdit = Boolean(id);

  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [rolls, setRolls] = useState([]);
  const [isDirty, setIsDirty] = useState(false);
  const { clearDirty } = useUnsavedChanges(isDirty);

  useEffect(() => {
    getPurchaseOrdersForGRN()
      .then((pos) => setPurchaseOrders(pos.filter((p) => p.poNumber.startsWith('PO-FAB'))))
      .catch(() => message.error('Failed to load purchase orders'));
  }, [message]);

  useEffect(() => {
    if (isEdit) {
      getFabricGRN(id)
        .then((grn) => {
          if (grn) {
            form.setFieldsValue({
              poNumber: grn.poId,
              grnDate: dayjs(grn.grnDate),
              challanNo: grn.challanNo,
              invoiceDate: grn.invoiceDate ? dayjs(grn.invoiceDate) : undefined,
              vehicleNumber: grn.vehicleNumber,
              transporter: grn.transporter,
              remarks: grn.remarks,
            });
            setRolls(grn.rolls || []);
            setSelectedPO({ poNumber: grn.poNumber, supplier: grn.supplier, poDate: grn.grnDate, items: grn.rolls });
          }
        })
        .catch(() => message.error('Failed to load GRN'));
    }
  }, [id, isEdit, form, message]);

  const handlePOChange = useCallback(
    (poId) => {
      const po = purchaseOrders.find((p) => p.id === poId);
      setSelectedPO(po || null);
      if (po) {
        setRolls(po.items.map((item) => ({
          fabricDescription: item.description, width: 0, weight: 0, shadeLot: '', gsm: 0,
        })));
      }
      setIsDirty(true);
    },
    [purchaseOrders],
  );

  const handleRollChange = useCallback((index, field, value) => {
    setRolls((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
    setIsDirty(true);
  }, []);

  const handleAddRoll = useCallback(() => {
    setRolls((prev) => [...prev, { fabricDescription: '', width: 0, weight: 0, shadeLot: '', gsm: 0 }]);
    setIsDirty(true);
  }, []);

  const handleRemoveRoll = useCallback((index) => {
    setRolls((prev) => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  }, []);

  const handleSubmit = useCallback(
    (status) => {
      form.validateFields().then((values) => {
        const payload = { ...values, type: 'Fabric', status, rolls };
        message.success(`Fabric GRN ${status === 'Draft' ? 'saved as draft' : 'submitted'} successfully`);
        clearDirty();
        navigate('/inventory/grn');
      }).catch(() => message.warning('Please fill all required fields'));
    },
    [form, rolls, message, navigate, clearDirty],
  );

  const poOptions = purchaseOrders.map((po) => ({ label: `${po.poNumber} - ${po.supplier}`, value: po.id }));

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={isEdit ? 'Edit Fabric GRN' : 'New Fabric GRN'} backPath="/inventory/grn/list" style={{ position: 'sticky', top: 64, zIndex: 10 }}>
        {hasPermission('inventory', 'add') && (
          <>
            <ActionButton action="save" variant="draft" text="Save as Draft" onClick={() => handleSubmit('Draft')} />
            <ActionButton action="save" text="Submit GRN" onClick={() => handleSubmit('Submitted')} />
          </>
        )}
      </PageHeader>

      <Form form={form} layout="vertical" initialValues={{ grnDate: dayjs() }} onValuesChange={() => setIsDirty(true)}>
        <Row gutter={24} align="stretch" style={{ marginBottom: 24 }}>
          <Col xs={24} lg={16}>
            <Card style={{ height: '100%' }}>
              <Title level={5} style={{ marginBottom: 24 }}>GRN Details</Title>
              <Row gutter={24}>
                <Col xs={24} md={12}><Form.Item name="poNumber" label="Purchase Order" rules={[{ required: true, message: 'Select a PO' }]}><Select placeholder="Select PO" options={poOptions} onChange={handlePOChange} showSearch optionFilterProp="label" /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="grnDate" label="GRN Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Row gutter={24}>
                <Col xs={24} md={12}><Form.Item name="challanNo" label="Challan / Invoice Number" rules={[{ required: true }]}><Input placeholder="Enter challan or invoice number" /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="invoiceDate" label="Invoice Date"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Row gutter={24}>
                <Col xs={24} md={12}><Form.Item name="vehicleNumber" label="Vehicle Number"><Input placeholder="e.g., TN-07-AZ-4521" /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="transporter" label="Transporter"><Input placeholder="Transporter name" /></Form.Item></Col>
              </Row>
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <FabricGRNSummaryPanel selectedPO={selectedPO} rolls={rolls} />
          </Col>
        </Row>

        <Card style={{ marginBottom: 24 }}>
          <Title level={5} style={{ marginBottom: 16 }}>Roll Details</Title>
          <FabricGRNRollTable rolls={rolls} onRollChange={handleRollChange} onAddRoll={handleAddRoll} onRemoveRoll={handleRemoveRoll} />
        </Card>

        <Card>
          <Title level={5} style={{ marginBottom: 16 }}>Remarks</Title>
          <Form.Item name="remarks" noStyle><TextArea rows={3} placeholder="Quality remarks or special notes" /></Form.Item>
        </Card>
      </Form>
    </div>
  );
};

export default FabricGRNForm;
