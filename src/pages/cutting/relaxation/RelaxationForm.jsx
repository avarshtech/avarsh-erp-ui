import { useState, useEffect, useCallback } from 'react';
import {
  App, Form, Input, Select, DatePicker, InputNumber, Button, Card,
  Row, Col, Skeleton, Typography,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import {
  createRelaxation,
  completeRelaxation,
  getRelaxationById,
  searchFabricReceipts,
} from '../../../services/cutting/cuttingService';
import { FABRIC_TYPES } from '../../../utils/cuttingConstants';

const { TextArea } = Input;
const { Text } = Typography;

const RelaxationForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState(null);
  const [receiptOptions, setReceiptOptions] = useState([]);
  const [receiptSearching, setReceiptSearching] = useState(false);

  // Watch start and end times for duration calculation
  const startTime = Form.useWatch('startTime', form);
  const endTime = Form.useWatch('endTime', form);

  // Compute duration display
  const durationDisplay = (() => {
    if (!startTime || !endTime) return null;
    const diffMs = endTime.valueOf() - startTime.valueOf();
    if (diffMs <= 0) return null;
    const hours = diffMs / (1000 * 60 * 60);
    return `${hours.toFixed(2)} hrs`;
  })();

  // Load record in edit mode
  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      getRelaxationById(id)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            fabricReceiptId: data.fabricReceiptId,
            buyerName: data.buyerName,
            styleNo: data.styleNo,
            orderNo: data.orderNo,
            fabricType: data.fabricType,
            relaxationDate: data.relaxationDate ? dayjs(data.relaxationDate) : dayjs(),
            startTime: data.startTime ? dayjs(data.startTime) : null,
            endTime: data.endTime ? dayjs(data.endTime) : null,
            shrinkageBeforePct: data.shrinkageBeforePct,
            shrinkageAfterPct: data.shrinkageAfterPct,
            inspectedBy: data.inspectedBy,
            remarks: data.remarks,
          });
          // Populate receipt dropdown with current value
          if (data.fabricReceiptId) {
            setReceiptOptions([{
              value: data.fabricReceiptId,
              label: `${data.receiptNo || data.fabricReceiptId} — ${data.styleNo || ''}`,
            }]);
          }
        })
        .catch(() => message.error('Failed to load relaxation record'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, form]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search fabric receipts with status=RECEIVED
  const handleReceiptSearch = useCallback(async (search) => {
    if (!search || search.length < 2) return;
    setReceiptSearching(true);
    try {
      const res = await searchFabricReceipts({ search, status: 'RECEIVED', page: 0, size: 20 });
      setReceiptOptions((res.content || []).map((r) => ({
        value: r.id,
        label: `${r.receiptNo} — ${r.styleNo || ''} — ${r.buyerName || ''}`,
        receipt: r,
      })));
    } catch { /* ignore */ }
    finally { setReceiptSearching(false); }
  }, []);

  // When receipt is selected, auto-populate fields
  const handleReceiptSelect = useCallback((value, option) => {
    const receipt = option?.receipt;
    if (!receipt) return;
    form.setFieldsValue({
      buyerName: receipt.buyerName || '',
      styleNo: receipt.styleNo || '',
      orderNo: receipt.orderNo || '',
    });
  }, [form]);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const hasEndTime = !!values.endTime;

      const payload = {
        fabricReceiptId: values.fabricReceiptId,
        fabricType: values.fabricType,
        relaxationDate: values.relaxationDate?.format('YYYY-MM-DD'),
        startTime: values.startTime?.toISOString(),
        endTime: hasEndTime ? values.endTime?.toISOString() : undefined,
        shrinkageBeforePct: values.shrinkageBeforePct,
        shrinkageAfterPct: hasEndTime ? values.shrinkageAfterPct : undefined,
        inspectedBy: values.inspectedBy,
        remarks: values.remarks,
        version: record?.version,
      };

      if (isEdit && hasEndTime) {
        await completeRelaxation(id, payload);
        message.success('Relaxation completed');
      } else if (isEdit) {
        // update existing without completing — completeRelaxation is the only update for relaxation
        await completeRelaxation(id, payload);
        message.success('Relaxation updated');
      } else {
        await createRelaxation(payload);
        message.success('Relaxation started');
      }
      navigate('/cutting/relaxation/list');
    } catch (err) {
      if (err?.errorFields) return; // form validation
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, record, isEdit, id, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <>
      <PageHeader
        title={isEdit ? `Edit Relaxation: ${record?.relaxationNo || ''}` : 'Start Fabric Relaxation'}
        onBack={() => navigate('/cutting/relaxation/list')}
        extra={
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            {isEdit ? 'Update' : 'Save'}
          </Button>
        }
      />

      <Card title="Relaxation Details">
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="fabricReceiptId"
                label="Fabric Receipt"
                rules={[{ required: true, message: 'Select a Fabric Receipt' }]}
              >
                <Select
                  showSearch
                  filterOption={false}
                  onSearch={handleReceiptSearch}
                  onSelect={handleReceiptSelect}
                  loading={receiptSearching}
                  options={receiptOptions}
                  placeholder="Search received fabric receipts..."
                  disabled={isEdit}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="buyerName" label="Buyer">
                <Input disabled placeholder="Auto-populated" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="styleNo" label="Style No">
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
              <Form.Item
                name="fabricType"
                label="Fabric Type"
                rules={[{ required: true, message: 'Select fabric type' }]}
              >
                <Select options={FABRIC_TYPES} placeholder="Select fabric type" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="relaxationDate" label="Relaxation Date">
                <DatePicker style={{ width: '100%' }} defaultValue={dayjs()} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="startTime"
                label="Start Time"
                rules={[{ required: true, message: 'Start time is required' }]}
              >
                <DatePicker showTime style={{ width: '100%' }} placeholder="Select start date & time" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="endTime" label="End Time (optional — to complete)">
                <DatePicker showTime style={{ width: '100%' }} placeholder="Select end date & time" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item label="Duration">
                <Text strong style={{ lineHeight: '32px', fontSize: 14 }}>
                  {durationDisplay || '—'}
                </Text>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="shrinkageBeforePct" label="Shrinkage Before (%)">
                <InputNumber
                  min={0}
                  max={100}
                  precision={2}
                  style={{ width: '100%' }}
                  placeholder="0.00"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="shrinkageAfterPct" label="Shrinkage After (%)">
                <InputNumber
                  min={0}
                  max={100}
                  precision={2}
                  style={{ width: '100%' }}
                  placeholder="0.00"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="inspectedBy" label="Inspected By">
                <Input placeholder="Name of inspector" />
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

export default RelaxationForm;
