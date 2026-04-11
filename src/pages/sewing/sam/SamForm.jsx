import { useState, useEffect, useCallback } from 'react';
import {
  App, Form, Input, Select, InputNumber, Button, Card,
  Row, Col, Skeleton,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import {
  createSamStandard, updateSamStandard, getSamStandardById,
} from '../../../services/sewingService';
import { MACHINE_TYPES, SAM_SOURCE_OPTIONS } from '../../../utils/sewingConstants';

const { TextArea } = Input;

const SamForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState(null);

  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      getSamStandardById(id)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            styleNo: data.styleNo,
            operationName: data.operationName,
            machineType: data.machineType,
            samMinutes: data.samMinutes,
            sequenceNo: data.sequenceNo,
            source: data.source,
            remarks: data.remarks,
          });
        })
        .catch(() => message.error('Failed to load SAM standard'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, form]);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        ...values,
        version: record?.version,
      };
      if (isEdit) {
        await updateSamStandard(id, payload);
        message.success('SAM standard updated');
      } else {
        await createSamStandard(payload);
        message.success('SAM standard created');
      }
      navigate('/sewing/sam/list');
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, record, isEdit, id, navigate]);

  if (loading) return <Skeleton active paragraph={{ rows: 8 }} />;

  return (
    <>
      <PageHeader
        title={isEdit ? `Edit SAM: ${record?.operationName || ''}` : 'New SAM Standard'}
        onBack={() => navigate('/sewing/sam/list')}
        extra={
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            {isEdit ? 'Update' : 'Save'}
          </Button>
        }
      />

      <Card title="SAM Details">
        <Form form={form} layout="vertical" initialValues={{ source: 'ESTIMATED' }}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="styleNo" label="Style No" rules={[{ required: true, message: 'Style is required' }]}>
                <Input placeholder="e.g. AV-SS25-001" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="operationName" label="Operation Name" rules={[{ required: true, message: 'Operation is required' }]}>
                <Input placeholder="e.g. Collar Attach" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="machineType" label="Machine Type">
                <Select allowClear options={MACHINE_TYPES} placeholder="Select machine type" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="samMinutes" label="SAM (minutes)" rules={[{ required: true, message: 'SAM value is required' }]}>
                <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="sequenceNo" label="Sequence No">
                <InputNumber min={1} style={{ width: '100%' }} placeholder="Operation order" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="source" label="Source">
                <Select options={SAM_SOURCE_OPTIONS} placeholder="Select source" />
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
    </>
  );
};

export default SamForm;
