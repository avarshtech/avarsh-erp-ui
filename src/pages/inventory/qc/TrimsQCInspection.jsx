import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Form, Card, Row, Col, Input, Select, DatePicker, InputNumber } from 'antd';
import { SaveOutlined, SendOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { AQL_LEVELS } from '../../../utils/inventoryConstants';
import { numericInputProps } from '../../../utils/inputHelpers';
import { getTrimsQCById } from '../../../services/inventoryService';
import TrimsQCAQLTable from './TrimsQCAQLTable';
import TrimsQCResultPanel from './TrimsQCResultPanel';

const CATEGORY_OPTIONS = [
  { label: 'Buttons', value: 'Buttons' },
  { label: 'Zippers', value: 'Zippers' },
  { label: 'Labels', value: 'Labels' },
  { label: 'Thread', value: 'Thread' },
  { label: 'Elastic', value: 'Elastic' },
  { label: 'Interlining', value: 'Interlining' },
  { label: 'Hangtags', value: 'Hangtags' },
  { label: 'Packaging', value: 'Packaging' },
];

const INSPECTION_LEVELS = [
  { label: 'Level I (Reduced)', value: 'I' },
  { label: 'Level II (Normal)', value: 'II' },
  { label: 'Level III (Tightened)', value: 'III' },
];

const getSampleSize = (lotSize) => {
  if (!lotSize || lotSize <= 0) return 0;
  if (lotSize <= 150) return 20;
  if (lotSize <= 500) return 50;
  if (lotSize <= 1200) return 80;
  if (lotSize <= 3200) return 125;
  if (lotSize <= 10000) return 200;
  if (lotSize <= 35000) return 315;
  if (lotSize <= 150000) return 500;
  return 800;
};

const TrimsQCInspection = () => {
  const { message } = App.useApp();
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(false);
  const [qcData, setQcData] = useState(null);
  const [items, setItems] = useState([]);
  const [lotSize, setLotSize] = useState(0);
  const [aqlLevel, setAqlLevel] = useState('2.5');

  const sampleSize = useMemo(() => getSampleSize(lotSize), [lotSize]);

  const loadData = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const data = await getTrimsQCById(id);
      if (data) {
        setQcData(data);
        setItems(data.items || []);
        setLotSize(data.lotSize || 0);
        setAqlLevel(data.aqlLevel || '2.5');
        form.setFieldsValue({
          grnNumber: data.grnNumber,
          inspector: data.inspector,
          inspectionDate: data.inspectionDate ? dayjs(data.inspectionDate) : null,
          category: data.category,
          inspectionLevel: 'II',
          aqlLevel: data.aqlLevel,
          lotSize: data.lotSize,
        });
      }
    } catch {
      message.error('Failed to load trims QC inspection');
    } finally {
      setLoading(false);
    }
  }, [id, isNew, form, message]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleItemChange = useCallback((index, field, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }, []);

  const defectSummary = useMemo(() => {
    const totalDefects = items.reduce((s, i) => s + (i.defectsFound || 0), 0);
    const majorDefects = items.reduce((s, i) => s + (i.majorDefects || 0), 0);
    const minorDefects = items.reduce((s, i) => s + (i.minorDefects || 0), 0);
    return { totalDefects, majorDefects, minorDefects };
  }, [items]);

  const overallResult = useMemo(() => {
    if (!qcData && isNew) return 'Pending';
    if (qcData?.overallResult) return qcData.overallResult;
    const { totalDefects } = defectSummary;
    const acceptNum = qcData?.acceptNumber || 14;
    if (totalDefects <= acceptNum) return 'Pass';
    return 'Fail';
  }, [qcData, isNew, defectSummary]);

  const handleSave = useCallback(() => { message.success('Draft saved successfully'); }, [message]);
  const handleSubmit = useCallback(() => { message.success('Inspection submitted for approval'); }, [message]);
  const handleApprove = useCallback(() => { message.success('Inspection approved'); }, [message]);
  const handleReject = useCallback(() => { message.error('Inspection rejected'); }, [message]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={isNew ? 'New Trims QC Inspection' : `Trims QC — ${qcData?.qcNumber || ''}`} backPath="/inventory/qc" style={{ position: 'sticky', top: 64, zIndex: 10 }}>
        <span style={{ display: 'flex', gap: 8 }}>
          <ActionButton action="save" variant="draft" text="Save Draft" icon={<SaveOutlined />} onClick={handleSave} loading={loading} />
          <ActionButton action="save" text="Submit" icon={<SendOutlined />} onClick={handleSubmit} loading={loading} />
        </span>
      </PageHeader>

      <Row gutter={24} align="stretch" style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card title="Inspection Details" size="small" style={{ height: '100%' }}>
            <Form form={form} layout="vertical">
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item label="GRN Number" name="grnNumber" rules={[{ required: true, message: 'Select GRN' }]}>
                    <Select placeholder="Select GRN" showSearch optionFilterProp="label" options={[
                      { label: 'GRN-A-2026-0001', value: 'GRN-A-2026-0001' },
                      { label: 'GRN-A-2026-0002', value: 'GRN-A-2026-0002' },
                      { label: 'GRN-A-2026-0003', value: 'GRN-A-2026-0003' },
                    ]} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Category" name="category" rules={[{ required: true, message: 'Select category' }]}>
                    <Select placeholder="Select category" options={CATEGORY_OPTIONS} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item label="Inspector" name="inspector" rules={[{ required: true, message: 'Enter inspector name' }]}>
                    <Input placeholder="Inspector name" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Inspection Date" name="inspectionDate" rules={[{ required: true, message: 'Select date' }]}>
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <TrimsQCResultPanel
            overallResult={overallResult}
            totalDefects={defectSummary.totalDefects}
            majorDefects={defectSummary.majorDefects}
            minorDefects={defectSummary.minorDefects}
            aqlLevel={aqlLevel}
            lotSize={qcData?.lotSize || lotSize}
            sampleSize={qcData?.sampleSize || sampleSize}
            approvalStatus={qcData?.approvalStatus || 'Pending'}
            approver={qcData?.approver}
            approvalRemarks={qcData?.approvalRemarks}
            onApprove={handleApprove}
            onReject={handleReject}
            readOnly={!isNew && qcData?.approvalStatus !== 'Pending'}
          />
        </Col>
      </Row>

      <Card title="AQL Setup" size="small" style={{ marginBottom: 24 }}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item label="Inspection Level" name="inspectionLevel" initialValue="II">
                <Select options={INSPECTION_LEVELS} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="AQL Level" name="aqlLevel" initialValue="2.5">
                <Select options={AQL_LEVELS} onChange={setAqlLevel} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Lot Size" name="lotSize">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="Enter lot size" onChange={setLotSize} {...numericInputProps} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item label="Sample Size (auto)">
                <InputNumber style={{ width: '100%' }} value={sampleSize} disabled />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card title="Inspection Results" size="small">
        <TrimsQCAQLTable items={items} onItemChange={handleItemChange} aqlLevel={aqlLevel} sampleSize={qcData?.sampleSize || sampleSize} />
      </Card>
    </div>
  );
};

export default TrimsQCInspection;
