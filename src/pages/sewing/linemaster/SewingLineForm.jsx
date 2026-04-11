import { useState, useEffect, useCallback } from 'react';
import {
  App, Form, Input, Select, InputNumber, Button, Card,
  Row, Col, Skeleton,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import {
  createSewingLine, updateSewingLine, getSewingLineById,
} from '../../../services/sewing/sewingService';
import { LINE_STATUS_OPTIONS } from '../../../utils/sewingConstants';

const { TextArea } = Input;

const SewingLineForm = () => {
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
      getSewingLineById(id)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            lineCode: data.lineCode,
            lineName: data.lineName,
            floor: data.floor,
            capacity: data.capacity,
            machineCount: data.machineCount,
            supervisorName: data.supervisorName,
            status: data.status,
            remarks: data.remarks,
          });
        })
        .catch(() => message.error('Failed to load sewing line'))
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
        await updateSewingLine(id, payload);
        message.success('Sewing line updated');
      } else {
        await createSewingLine(payload);
        message.success('Sewing line created');
      }
      navigate('/sewing/lines/list');
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
        title={isEdit ? `Edit Line: ${record?.lineCode || ''}` : 'New Sewing Line'}
        onBack={() => navigate('/sewing/lines/list')}
        extra={
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            {isEdit ? 'Update' : 'Save'}
          </Button>
        }
      />

      <Card title="Line Details">
        <Form form={form} layout="vertical" initialValues={{ status: 'ACTIVE' }}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="lineCode" label="Line Code" tooltip="Leave blank for auto-generation">
                <Input placeholder="Auto-generated if empty" disabled={isEdit} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="lineName" label="Line Name" rules={[{ required: true, message: 'Line name is required' }]}>
                <Input placeholder="e.g. Line A1" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="floor" label="Floor">
                <Input placeholder="e.g. 2nd Floor" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="capacity" label="Capacity (operators)">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="machineCount" label="Machine Count">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="supervisorName" label="Supervisor">
                <Input placeholder="Supervisor name" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="status" label="Status">
                <Select options={LINE_STATUS_OPTIONS} />
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

export default SewingLineForm;
