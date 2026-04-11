import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Form, Input, Select, DatePicker, InputNumber, Button, Card,
  Row, Col, Table, Checkbox, Skeleton,
} from 'antd';
import { SaveOutlined, ArrowLeftOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import {
  createFabricReceipt,
  updateFabricReceipt,
  getFabricReceiptById,
  searchCutOrderPlans,
} from '../../../services/cuttingService';
import {
  FABRIC_RECEIPT_STATUS,
  FABRIC_TYPES,
} from '../../../utils/cuttingConstants';

const { TextArea } = Input;

const FabricReceiptForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState(null);
  const [planOptions, setPlanOptions] = useState([]);
  const [planSearching, setPlanSearching] = useState(false);
  const [rolls, setRolls] = useState([]);

  // Load record in edit mode
  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      getFabricReceiptById(id)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            cutOrderPlanId: data.cutOrderPlanId,
            styleNo: data.styleNo,
            buyerName: data.buyerName,
            orderNo: data.orderNo,
            color: data.color,
            fabricIssueNo: data.fabricIssueNo,
            receiptDate: data.receiptDate ? dayjs(data.receiptDate) : dayjs(),
            receivedBy: data.receivedBy,
            remarks: data.remarks,
          });
          setRolls(data.rolls || []);
          // Populate plan dropdown with current value
          if (data.cutOrderPlanId) {
            setPlanOptions([{
              value: data.cutOrderPlanId,
              label: `${data.planNo || data.cutOrderPlanId} — ${data.styleNo || ''}`,
            }]);
          }
        })
        .catch(() => message.error('Failed to load fabric receipt'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, form]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search approved cut order plans
  const handlePlanSearch = useCallback(async (search) => {
    if (!search || search.length < 2) return;
    setPlanSearching(true);
    try {
      const res = await searchCutOrderPlans({ search, status: 'APPROVED', page: 0, size: 20 });
      setPlanOptions((res.content || []).map((p) => ({
        value: p.id,
        label: `${p.planNo} — ${p.styleNo || ''} — ${p.buyerName || ''}`,
        plan: p,
      })));
    } catch { /* ignore */ }
    finally { setPlanSearching(false); }
  }, []);

  // When plan is selected, auto-populate fields
  const handlePlanSelect = useCallback((value, option) => {
    const plan = option?.plan;
    if (!plan) return;
    form.setFieldsValue({
      styleNo: plan.styleNo || '',
      buyerName: plan.buyerName || '',
      orderNo: plan.orderNo || '',
      color: plan.color || '',
    });
  }, [form]);

  // Add a roll row
  const addRoll = useCallback(() => {
    setRolls((prev) => [...prev, {
      rollNo: '',
      fabricType: undefined,
      weightKg: null,
      color: '',
      shadeLot: '',
      received: false,
    }]);
  }, []);

  // Remove a roll row
  const removeRoll = useCallback((index) => {
    setRolls((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Update a roll field
  const updateRoll = useCallback((index, field, value) => {
    setRolls((prev) => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }, []);

  // Calculated totals
  const totalRolls = rolls.length;
  const totalWeightKg = useMemo(
    () => rolls.reduce((sum, r) => sum + (r.weightKg || 0), 0),
    [rolls],
  );

  const isEditable = !isEdit || (record && record.status === FABRIC_RECEIPT_STATUS.PENDING);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (rolls.length === 0) {
        message.warning('Add at least one roll');
        return;
      }
      setSaving(true);
      const payload = {
        cutOrderPlanId: values.cutOrderPlanId,
        fabricIssueNo: values.fabricIssueNo,
        receiptDate: values.receiptDate?.format('YYYY-MM-DD'),
        receivedBy: values.receivedBy,
        remarks: values.remarks,
        totalRolls,
        totalWeightKg,
        rolls: rolls.map((r, idx) => ({
          id: r.id,
          rollNo: r.rollNo,
          fabricType: r.fabricType,
          weightKg: r.weightKg,
          color: r.color,
          shadeLot: r.shadeLot,
          received: r.received || false,
          sortOrder: idx,
        })),
        version: record?.version,
      };
      if (isEdit) {
        await updateFabricReceipt(id, payload);
        message.success('Fabric receipt updated');
      } else {
        await createFabricReceipt(payload);
        message.success('Fabric receipt created');
      }
      navigate('/cutting/fabric-receipt/list');
    } catch (err) {
      if (err?.errorFields) return; // form validation
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, rolls, totalRolls, totalWeightKg, record, isEdit, id, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const rollColumns = useMemo(() => [
    {
      title: 'Roll No',
      dataIndex: 'rollNo',
      key: 'rollNo',
      width: 120,
      render: (val, _, index) => (
        <Input
          size="small"
          value={val}
          placeholder="e.g. R001"
          onChange={(e) => updateRoll(index, 'rollNo', e.target.value)}
          disabled={!isEditable}
        />
      ),
    },
    {
      title: 'Fabric Type',
      dataIndex: 'fabricType',
      key: 'fabricType',
      width: 150,
      render: (val, _, index) => (
        <Select
          size="small"
          value={val}
          options={FABRIC_TYPES}
          placeholder="Type"
          onChange={(v) => updateRoll(index, 'fabricType', v)}
          disabled={!isEditable}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Weight (kg)',
      dataIndex: 'weightKg',
      key: 'weightKg',
      width: 120,
      align: 'right',
      render: (val, _, index) => (
        <InputNumber
          size="small"
          min={0}
          precision={3}
          value={val}
          onChange={(v) => updateRoll(index, 'weightKg', v)}
          disabled={!isEditable}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Color',
      dataIndex: 'color',
      key: 'color',
      width: 110,
      render: (val, _, index) => (
        <Input
          size="small"
          value={val}
          placeholder="Color"
          onChange={(e) => updateRoll(index, 'color', e.target.value)}
          disabled={!isEditable}
        />
      ),
    },
    {
      title: 'Shade Lot',
      dataIndex: 'shadeLot',
      key: 'shadeLot',
      width: 110,
      render: (val, _, index) => (
        <Input
          size="small"
          value={val}
          placeholder="Shade lot"
          onChange={(e) => updateRoll(index, 'shadeLot', e.target.value)}
          disabled={!isEditable}
        />
      ),
    },
    {
      title: 'Received',
      dataIndex: 'received',
      key: 'received',
      width: 80,
      align: 'center',
      render: (val, _, index) => (
        <Checkbox
          checked={!!val}
          onChange={(e) => updateRoll(index, 'received', e.target.checked)}
          disabled={!isEditable}
        />
      ),
    },
    ...(isEditable ? [{
      title: '',
      key: 'action',
      width: 50,
      render: (_, __, index) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => removeRoll(index)}
        />
      ),
    }] : []),
  ], [isEditable, updateRoll, removeRoll]);

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <>
      <PageHeader
        title={isEdit ? `Edit Receipt: ${record?.receiptNo || ''}` : 'New Fabric Receipt'}
        onBack={() => navigate('/cutting/fabric-receipt/list')}
        extra={isEditable && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            {isEdit ? 'Update' : 'Save'}
          </Button>
        )}
      />

      <Card title="Receipt Details" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" disabled={!isEditable}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="cutOrderPlanId"
                label="Cut Order Plan"
                rules={[{ required: true, message: 'Select a Cut Order Plan' }]}
              >
                <Select
                  showSearch
                  filterOption={false}
                  onSearch={handlePlanSearch}
                  onSelect={handlePlanSelect}
                  loading={planSearching}
                  options={planOptions}
                  placeholder="Search approved plans..."
                  disabled={isEdit}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="styleNo" label="Style No">
                <Input disabled placeholder="Auto-populated" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="buyerName" label="Buyer">
                <Input disabled placeholder="Auto-populated" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="orderNo" label="Order No">
                <Input disabled placeholder="Auto-populated" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="color" label="Color">
                <Input disabled placeholder="Auto-populated" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="fabricIssueNo" label="Fabric Issue No">
                <Input placeholder="Issue reference no" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="receiptDate" label="Receipt Date">
                <DatePicker style={{ width: '100%' }} defaultValue={dayjs()} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="receivedBy" label="Received By">
                <Input placeholder="Name of receiver" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="remarks" label="Remarks">
                <TextArea rows={2} placeholder="Remarks" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card
        title="Rolls"
        extra={isEditable && (
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addRoll}>
            Add Roll
          </Button>
        )}
      >
        <Table
          rowKey={(_, index) => index}
          columns={rollColumns}
          dataSource={rolls}
          pagination={false}
          size="small"
          scroll={{ x: 750 }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}><strong>Total</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={1} />
              <Table.Summary.Cell index={2} align="right">
                <strong>{totalWeightKg.toFixed(3)} kg</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} />
              <Table.Summary.Cell index={4} />
              <Table.Summary.Cell index={5}>
                <strong>{totalRolls} rolls</strong>
              </Table.Summary.Cell>
              {isEditable && <Table.Summary.Cell index={6} />}
            </Table.Summary.Row>
          )}
        />
      </Card>
    </>
  );
};

export default FabricReceiptForm;
