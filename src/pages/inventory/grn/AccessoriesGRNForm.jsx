import { useState, useCallback, useEffect } from 'react';
import { App, Form, Input, Select, DatePicker, Card, Row, Col, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { hasPermission } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { getPurchaseOrdersForGRN, getAccessoriesGRN } from '../../../services/inventoryService';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import AccessoriesGRNItemTable from './AccessoriesGRNItemTable';
import AccessoriesGRNCartonTable from './AccessoriesGRNCartonTable';
import AccessoriesGRNSummaryPanel from './AccessoriesGRNSummaryPanel';

const { Title } = Typography;
const { TextArea } = Input;

const AccessoriesGRNForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const isEdit = Boolean(id);

  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [items, setItems] = useState([]);
  const [cartons, setCartons] = useState([]);
  const [isDirty, setIsDirty] = useState(false);
  const { clearDirty } = useUnsavedChanges(isDirty);

  useEffect(() => {
    getPurchaseOrdersForGRN()
      .then((pos) => setPurchaseOrders(pos.filter((p) => p.poNumber.startsWith('PO-ACC'))))
      .catch(() => message.error('Failed to load purchase orders'));
  }, [message]);

  useEffect(() => {
    if (isEdit) {
      getAccessoriesGRN(id)
        .then((grn) => {
          if (grn) {
            form.setFieldsValue({
              poNumber: grn.poId,
              grnDate: dayjs(grn.grnDate),
              challanNo: grn.challanNo,
              invoiceDate: grn.invoiceDate ? dayjs(grn.invoiceDate) : undefined,
              vehicleNumber: grn.vehicleNumber,
              remarks: grn.remarks,
            });
            setItems(grn.items || []);
            setCartons(grn.cartons || []);
            setSelectedPO({ poNumber: grn.poNumber, supplier: grn.supplier, poDate: grn.grnDate, items: grn.items });
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
        setItems(po.items.map((item) => ({
          ...item, alreadyReceived: item.receivedQty || 0, balance: item.pendingQty, receivingQty: 0,
        })));
        setCartons([]);
      }
      setIsDirty(true);
    },
    [purchaseOrders],
  );

  const handleItemChange = useCallback((index, field, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
    setIsDirty(true);
  }, []);

  const handleCartonChange = useCallback((index, field, value) => {
    setCartons((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
    setIsDirty(true);
  }, []);

  const handleAddCarton = useCallback(() => {
    setCartons((prev) => [...prev, { itemCode: '', itemDescription: '', color: '', size: '', quantity: 0, uom: 'pcs', batchNo: '' }]);
    setIsDirty(true);
  }, []);

  const handleRemoveCarton = useCallback((index) => {
    setCartons((prev) => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  }, []);

  const handleSubmit = useCallback(
    (status) => {
      form.validateFields().then((values) => {
        const payload = { ...values, type: 'Accessories', status, items, cartons };
        message.success(`Accessories GRN ${status === 'Draft' ? 'saved as draft' : 'submitted'} successfully`);
        clearDirty();
        navigate('/inventory/grn');
      }).catch(() => message.warning('Please fill all required fields'));
    },
    [form, items, cartons, message, navigate, clearDirty],
  );

  const poOptions = purchaseOrders.map((po) => ({ label: `${po.poNumber} - ${po.supplier}`, value: po.id }));

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={isEdit ? 'Edit Accessories GRN' : 'New Accessories GRN'} backPath="/inventory/grn/list" style={{ position: 'sticky', top: 64, zIndex: 10 }}>
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
                <Col xs={24} md={12}><Form.Item name="vehicleNumber" label="Vehicle Number"><Input placeholder="e.g., MH-12-QW-3344" /></Form.Item></Col>
              </Row>
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <AccessoriesGRNSummaryPanel selectedPO={selectedPO} items={items} cartons={cartons} />
          </Col>
        </Row>

        <Card style={{ marginBottom: 24 }}>
          <Title level={5} style={{ marginBottom: 16 }}>Items</Title>
          <AccessoriesGRNItemTable items={items} onItemChange={handleItemChange} />
        </Card>

        <Card style={{ marginBottom: 24 }}>
          <Title level={5} style={{ marginBottom: 16 }}>Carton Details</Title>
          <AccessoriesGRNCartonTable cartons={cartons} onCartonChange={handleCartonChange} onAddCarton={handleAddCarton} onRemoveCarton={handleRemoveCarton} />
        </Card>

        <Card>
          <Title level={5} style={{ marginBottom: 16 }}>Remarks</Title>
          <Form.Item name="remarks" noStyle><TextArea rows={3} placeholder="Quality remarks or special notes" /></Form.Item>
        </Card>
      </Form>
    </div>
  );
};

export default AccessoriesGRNForm;
