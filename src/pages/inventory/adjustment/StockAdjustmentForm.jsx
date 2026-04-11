import { useState, useCallback, useEffect } from 'react';
import { App, Form, Input, Select, DatePicker, Card, Row, Col } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { hasPermission } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { ADJUSTMENT_STATUS } from '../../../utils/inventoryConstants';
import { getAdjustmentList } from '../../../services/inventory/inventoryService';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import AdjustmentCountTable from './AdjustmentCountTable';
import AdjustmentApprovalPanel from './AdjustmentApprovalPanel';

const { TextArea } = Input;

const TYPE_OPTIONS = [
  { label: 'Fabric', value: 'Fabric' },
  { label: 'Accessories', value: 'Accessories' },
];

const REASON_OPTIONS = [
  { label: 'Cycle Count', value: 'Cycle Count' },
  { label: 'Physical Count', value: 'Physical Count' },
  { label: 'Damage Write-off', value: 'Damage Write-off' },
  { label: 'Other', value: 'Other' },
];

const MOCK_FABRIC_ITEMS = [
  { itemId: 1, description: 'Cotton Jersey 40s Reactive (Roll R001)', uom: 'kg', systemQty: 68.5, physicalCount: null, remarks: '' },
  { itemId: 2, description: 'CVC Pique 220 GSM (Roll R001)', uom: 'kg', systemQty: 75.0, physicalCount: null, remarks: '' },
  { itemId: 3, description: 'Viscose Rayon Twill (Roll R001)', uom: 'kg', systemQty: 85.0, physicalCount: null, remarks: '' },
];

const MOCK_ACCESSORIES_ITEMS = [
  { itemId: 10, description: 'Woven Main Label SS26 Collection', uom: 'pcs', systemQty: 18500, physicalCount: null, remarks: '' },
  { itemId: 11, description: 'Printed Care Label Polyester Standard', uom: 'pcs', systemQty: 23000, physicalCount: null, remarks: '' },
  { itemId: 12, description: 'Polyester Sewing Thread 40/2 White', uom: 'cones', systemQty: 87, physicalCount: null, remarks: '' },
];

const StockAdjustmentForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const isEdit = Boolean(id);

  const [items, setItems] = useState([]);
  const [status, setStatus] = useState(ADJUSTMENT_STATUS.DRAFT);
  const [approver, setApprover] = useState(null);
  const [approvalRemarks, setApprovalRemarks] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const { clearDirty } = useUnsavedChanges(isDirty);

  useEffect(() => {
    if (isEdit) {
      getAdjustmentList().then((res) => {
        const adj = (res.content || []).find((a) => a.id === Number(id));
        if (adj) {
          form.setFieldsValue({ type: adj.type, adjustmentDate: dayjs(adj.adjustmentDate), countedBy: adj.countedBy, reason: adj.reason });
          setItems(adj.items || []);
          setStatus(adj.status);
          setApprover(adj.approver);
          setApprovalRemarks(adj.approvalRemarks);
        }
      }).catch(() => message.error('Failed to load adjustment'));
    } else {
      form.setFieldsValue({ adjustmentDate: dayjs() });
    }
  }, [id, isEdit, form, message]);

  const handleTypeChange = useCallback((type) => {
    const mock = type === 'Fabric' ? MOCK_FABRIC_ITEMS : MOCK_ACCESSORIES_ITEMS;
    setItems(mock.map((i) => ({ ...i })));
    setIsDirty(true);
  }, []);

  const handleItemChange = useCallback((index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setIsDirty(true);
  }, []);

  const handleSave = useCallback((submit = false) => {
    form.validateFields().then((values) => {
      clearDirty();
      message.success(submit ? 'Adjustment submitted for approval' : 'Draft saved');
      if (submit) navigate('/inventory/adjustment');
    }).catch(() => message.warning('Please fill all required fields'));
  }, [form, message, navigate, clearDirty]);

  const handleApprove = useCallback(() => {
    setStatus(ADJUSTMENT_STATUS.APPROVED);
    setApprover('Current User');
    message.success('Adjustment approved');
  }, [message]);

  const handleReject = useCallback(() => {
    setStatus(ADJUSTMENT_STATUS.REJECTED);
    setApprover('Current User');
    message.info('Adjustment rejected');
  }, [message]);

  const readOnly = isEdit && status !== ADJUSTMENT_STATUS.DRAFT;

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={readOnly ? 'View Stock Adjustment' : isEdit ? 'Edit Stock Adjustment' : 'New Stock Adjustment'} backPath="/inventory/adjustment" style={{ position: 'sticky', top: 64, zIndex: 10 }}>
        {!readOnly && (
          <>
            <ActionButton action="save" variant="draft" text="Save Draft" onClick={() => handleSave(false)} />
            <ActionButton action="save" text="Submit" onClick={() => handleSave(true)} />
          </>
        )}
      </PageHeader>

      <Form form={form} layout="vertical" onValuesChange={() => setIsDirty(true)}>
        <Row gutter={24} align="stretch" style={{ marginBottom: 24 }}>
          <Col xs={24} lg={16}>
            <Card title="Adjustment Details" style={{ height: '100%' }}>
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item name="type" label="Type" rules={[{ required: true, message: 'Select type' }]}>
                    <Select options={TYPE_OPTIONS} placeholder="Select type" onChange={handleTypeChange} disabled={readOnly} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="adjustmentDate" label="Adjustment Date" rules={[{ required: true, message: 'Select date' }]}>
                    <DatePicker style={{ width: '100%' }} disabled={readOnly} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item name="countedBy" label="Counted By" rules={[{ required: true, message: 'Enter name' }]}>
                    <Input placeholder="Person name" disabled={readOnly} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="reason" label="Reason" rules={[{ required: true, message: 'Select reason' }]}>
                    <Select options={REASON_OPTIONS} placeholder="Select reason" disabled={readOnly} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <AdjustmentApprovalPanel
              items={items}
              status={status}
              approver={approver}
              approvalRemarks={approvalRemarks}
              onApprove={handleApprove}
              onReject={handleReject}
              readOnly={readOnly}
            />
          </Col>
        </Row>

        <Card title="Count Entry" style={{ marginBottom: 24 }}>
          <AdjustmentCountTable items={items} onItemChange={handleItemChange} readOnly={readOnly} />
        </Card>

        <Card title="Notes" style={{ marginBottom: 24 }}>
          <Form.Item name="notes" noStyle>
            <TextArea rows={3} placeholder="Additional notes..." disabled={readOnly} />
          </Form.Item>
        </Card>
      </Form>
    </div>
  );
};

export default StockAdjustmentForm;
