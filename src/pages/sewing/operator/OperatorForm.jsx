import { useState, useEffect, useCallback } from 'react';
import {
  App, Form, Input, Select, DatePicker, InputNumber, Button, Card,
  Row, Col, Skeleton,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import {
  createOperator, updateOperator, getOperatorById, getAllActiveLines,
} from '../../../services/sewing/sewingService';

const { TextArea } = Input;

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_LEAVE', label: 'On Leave' },
  { value: 'TERMINATED', label: 'Terminated' },
];

const OperatorForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState(null);
  const [lineOptions, setLineOptions] = useState([]);

  // Load active lines
  useEffect(() => {
    getAllActiveLines()
      .then((lines) => {
        setLineOptions((lines || []).map((l) => ({ value: l.id, label: l.lineName || l.lineCode })));
      })
      .catch(() => { /* ignore */ });
  }, []);

  // Load record in edit mode
  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      getOperatorById(id)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            empCode: data.empCode,
            operatorName: data.operatorName,
            lineId: data.lineId,
            designation: data.designation,
            primarySkill: data.primarySkill,
            joinDate: data.joinDate ? dayjs(data.joinDate) : null,
            status: data.status,
            remarks: data.remarks,
          });
        })
        .catch(() => message.error('Failed to load operator'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, form]);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        ...values,
        joinDate: values.joinDate?.format('YYYY-MM-DD'),
        version: record?.version,
      };
      if (isEdit) {
        await updateOperator(id, payload);
        message.success('Operator updated');
      } else {
        await createOperator(payload);
        message.success('Operator created');
      }
      navigate('/sewing/operators/list');
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
        title={isEdit ? `Edit Operator: ${record?.empCode || ''}` : 'New Operator'}
        onBack={() => navigate('/sewing/operators/list')}
        extra={
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            {isEdit ? 'Update' : 'Save'}
          </Button>
        }
      />

      <Card title="Operator Details">
        <Form form={form} layout="vertical" initialValues={{ status: 'ACTIVE' }}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="empCode" label="Emp Code" tooltip="Leave blank for auto-generation">
                <Input placeholder="Auto-generated if empty" disabled={isEdit} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="operatorName" label="Operator Name" rules={[{ required: true, message: 'Name is required' }]}>
                <Input placeholder="Full name" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="lineId" label="Sewing Line">
                <Select
                  showSearch
                  optionFilterProp="label"
                  allowClear
                  options={lineOptions}
                  placeholder="Select line"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="designation" label="Designation">
                <Input placeholder="e.g. Operator, Helper, QC" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="primarySkill" label="Primary Skill">
                <Input placeholder="e.g. SNLS, Overlock" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="joinDate" label="Join Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="status" label="Status">
                <Select options={STATUS_OPTIONS} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={16} md={16}>
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

export default OperatorForm;
