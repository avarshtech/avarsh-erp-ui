import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Form, Input, Select, Button, Card, Row, Col, Table, Skeleton, InputNumber, Statistic,
} from 'antd';
import { SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import {
  createWastage, updateWastage, getWastageById, searchCutOrderPlans,
} from '../../../services/cuttingService';

const { TextArea } = Input;

const WastageForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState(null);
  const [rollDetails, setRollDetails] = useState([]);

  const [planOptions, setPlanOptions] = useState([]);
  const [planSearching, setPlanSearching] = useState(false);

  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      getWastageById(id)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            planId: data.planId,
            fabricReceivedKg: data.fabricReceivedKg,
            fabricUsedKg: data.fabricUsedKg,
            endBitsKg: data.endBitsKg,
            recutFabricKg: data.recutFabricKg,
            reconciledBy: data.reconciledBy,
            remarks: data.remarks,
          });
          setRollDetails(data.rollDetails || []);
          if (data.planId) {
            setPlanOptions([{ value: data.planId, label: `Plan #${data.planId}` }]);
          }
        })
        .catch(() => message.error('Failed to load wastage record'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, form]);

  const handlePlanSearch = useCallback(async (search) => {
    if (!search || search.length < 2) return;
    setPlanSearching(true);
    try {
      const res = await searchCutOrderPlans({ search, page: 0, size: 20 });
      setPlanOptions((res.content || []).map((p) => ({
        value: p.id,
        label: `${p.planNo} — ${p.styleNo || ''} — ${p.color || ''}`,
      })));
    } catch { /* ignore */ }
    finally { setPlanSearching(false); }
  }, []);

  const addRoll = useCallback(() => {
    setRollDetails((prev) => [...prev, { rollNo: '', receivedKg: 0, usedKg: 0, endBitKg: 0, varianceKg: 0 }]);
  }, []);

  const removeRoll = useCallback((index) => {
    setRollDetails((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateRoll = useCallback((index, field, value) => {
    setRollDetails((prev) => prev.map((row, i) => {
      if (i !== index) return row;
      const updated = { ...row, [field]: value };
      updated.varianceKg = (updated.receivedKg || 0) - (updated.usedKg || 0) - (updated.endBitKg || 0);
      return updated;
    }));
  }, []);

  // Compute KPIs
  const fabricReceivedKg = Form.useWatch('fabricReceivedKg', form) || 0;
  const fabricUsedKg = Form.useWatch('fabricUsedKg', form) || 0;
  const endBitsKg = Form.useWatch('endBitsKg', form) || 0;
  const recutFabricKg = Form.useWatch('recutFabricKg', form) || 0;
  const wasteKg = fabricReceivedKg - fabricUsedKg - endBitsKg - recutFabricKg;
  const utilizationPct = fabricReceivedKg > 0
    ? (((fabricUsedKg + recutFabricKg) / fabricReceivedKg) * 100).toFixed(2)
    : '0.00';

  const isEditable = !isEdit || (record && record.status === 'DRAFT');

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        planId: values.planId,
        fabricReceivedKg: values.fabricReceivedKg || 0,
        fabricUsedKg: values.fabricUsedKg || 0,
        endBitsKg: values.endBitsKg || 0,
        recutFabricKg: values.recutFabricKg || 0,
        reconciledBy: values.reconciledBy,
        remarks: values.remarks,
        rollDetails: rollDetails.map((r) => ({
          rollNo: r.rollNo,
          receivedKg: r.receivedKg || 0,
          usedKg: r.usedKg || 0,
          endBitKg: r.endBitKg || 0,
          varianceKg: r.varianceKg || 0,
        })),
        version: record?.version,
      };
      if (isEdit) {
        await updateWastage(id, payload);
        message.success('Wastage record updated');
      } else {
        await createWastage(payload);
        message.success('Wastage record created');
      }
      navigate('/cutting/wastage/list');
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, rollDetails, record, isEdit, id, navigate]);

  const rollColumns = useMemo(() => [
    {
      title: 'Roll No', dataIndex: 'rollNo', key: 'rollNo', width: 120,
      render: (val, _, index) => !isEditable ? val : (
        <Input size="small" value={val} placeholder="Roll No"
          onChange={(e) => updateRoll(index, 'rollNo', e.target.value)} />
      ),
    },
    {
      title: 'Received (kg)', dataIndex: 'receivedKg', key: 'receivedKg', width: 120, align: 'right',
      render: (val, _, index) => !isEditable ? val : (
        <InputNumber size="small" min={0} precision={3} value={val}
          onChange={(v) => updateRoll(index, 'receivedKg', v)} style={{ width: '100%' }} />
      ),
    },
    {
      title: 'Used (kg)', dataIndex: 'usedKg', key: 'usedKg', width: 120, align: 'right',
      render: (val, _, index) => !isEditable ? val : (
        <InputNumber size="small" min={0} precision={3} value={val}
          onChange={(v) => updateRoll(index, 'usedKg', v)} style={{ width: '100%' }} />
      ),
    },
    {
      title: 'End Bit (kg)', dataIndex: 'endBitKg', key: 'endBitKg', width: 120, align: 'right',
      render: (val, _, index) => !isEditable ? val : (
        <InputNumber size="small" min={0} precision={3} value={val}
          onChange={(v) => updateRoll(index, 'endBitKg', v)} style={{ width: '100%' }} />
      ),
    },
    {
      title: 'Variance (kg)', dataIndex: 'varianceKg', key: 'varianceKg', width: 120, align: 'right',
      render: (val) => <span style={{ color: val < 0 ? '#ff4d4f' : '#52c41a' }}>{val?.toFixed?.(3) || val}</span>,
    },
    ...(isEditable ? [{
      title: '', key: 'action', width: 50,
      render: (_, __, index) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeRoll(index)} />
      ),
    }] : []),
  ], [isEditable, updateRoll, removeRoll]);

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <>
      <PageHeader
        title={isEdit ? `Wastage Record #${record?.id || ''}` : 'New Wastage Record'}
        onBack={() => navigate('/cutting/wastage/list')}
        extra={isEditable && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            {isEdit ? 'Update' : 'Save'}
          </Button>
        )}
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} md={4}>
          <Card><Statistic title="Received (kg)" value={fabricReceivedKg} precision={3} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card><Statistic title="Used (kg)" value={fabricUsedKg} precision={3} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card><Statistic title="End Bits (kg)" value={endBitsKg} precision={3} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card><Statistic title="Recut (kg)" value={recutFabricKg} precision={3} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card><Statistic title="Waste (kg)" value={wasteKg} precision={3} valueStyle={{ color: wasteKg > 0 ? '#ff4d4f' : '#52c41a' }} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card><Statistic title="Utilization %" value={utilizationPct} suffix="%" /></Card>
        </Col>
      </Row>

      <Card title="Wastage Details" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" disabled={!isEditable}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="planId" label="Cut Order Plan" rules={[{ required: true, message: 'Select a plan' }]}>
                <Select
                  showSearch filterOption={false}
                  onSearch={handlePlanSearch}
                  loading={planSearching}
                  options={planOptions}
                  placeholder="Search plans..."
                  disabled={isEdit}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="fabricReceivedKg" label="Fabric Received (kg)">
                <InputNumber min={0} precision={3} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="fabricUsedKg" label="Fabric Used (kg)">
                <InputNumber min={0} precision={3} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="endBitsKg" label="End Bits (kg)">
                <InputNumber min={0} precision={3} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="recutFabricKg" label="Recut Fabric (kg)">
                <InputNumber min={0} precision={3} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="reconciledBy" label="Reconciled By">
                <Input placeholder="Name" />
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
        title="Roll Details"
        extra={isEditable && (
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addRoll}>Add Roll</Button>
        )}
      >
        <Table
          rowKey={(_, index) => index}
          columns={rollColumns}
          dataSource={rollDetails}
          pagination={false}
          size="small"
          scroll={{ x: 650 }}
        />
      </Card>
    </>
  );
};

export default WastageForm;
