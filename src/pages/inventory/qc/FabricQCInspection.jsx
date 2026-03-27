import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Form, Card, Row, Col, Input, Select, DatePicker, Space } from 'antd';
import { SaveOutlined, SendOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FABRIC_QC_PARAMETERS, DEFECT_SIZES } from '../../../utils/inventoryConstants';
import { getFabricQCById } from '../../../services/inventoryService';
import FabricQCParameters from './FabricQCParameters';
import FabricQCDefectTable from './FabricQCDefectTable';
import FabricQCResultPanel from './FabricQCResultPanel';

const FabricQCInspection = () => {
  const { message } = App.useApp();
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(false);
  const [parameters, setParameters] = useState({});
  const [defects, setDefects] = useState([]);
  const [qcData, setQcData] = useState(null);

  const loadData = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const data = await getFabricQCById(id);
      if (data) {
        setQcData(data);
        setParameters(data.parameters || {});
        setDefects(data.defects || []);
        form.setFieldsValue({
          grnNumber: data.grnNumber,
          inspector: data.inspector,
          inspectionDate: data.inspectionDate ? dayjs(data.inspectionDate) : null,
        });
      }
    } catch {
      message.error('Failed to load QC inspection');
    } finally {
      setLoading(false);
    }
  }, [id, isNew, form, message]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleParameterChange = useCallback((key, value) => {
    setParameters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleDefectChange = useCallback((index, field, value) => {
    setDefects((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
  }, []);

  const handleAddDefect = useCallback(() => {
    setDefects((prev) => [...prev, { rollNumber: '', defectType: null, defectSize: null, points: 0, location: '', remarks: '' }]);
  }, []);

  const handleRemoveDefect = useCallback((index) => {
    setDefects((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const totalDefectPoints = useMemo(() => defects.reduce((sum, d) => sum + (d.points || 0), 0), [defects]);
  const pointsPer100SqYd = useMemo(() => (qcData?.rollCount ? (totalDefectPoints / qcData.rollCount) * 10 : 0), [totalDefectPoints, qcData]);

  const parameterResults = useMemo(() => {
    let passCount = 0;
    FABRIC_QC_PARAMETERS.forEach((param) => {
      const val = parameters[param.key];
      if (param.type === 'rating') {
        if (typeof val === 'number' && val >= 3) passCount++;
      } else if (val && typeof val === 'object' && val.result === 'Pass') {
        passCount++;
      }
    });
    return { passCount, total: FABRIC_QC_PARAMETERS.length };
  }, [parameters]);

  const overallResult = useMemo(() => {
    if (!qcData && isNew) return 'Pending';
    if (pointsPer100SqYd > 40) return 'Fail';
    if (parameterResults.passCount < parameterResults.total) return 'Conditional Pass';
    if (pointsPer100SqYd > 28) return 'Conditional Pass';
    return 'Pass';
  }, [pointsPer100SqYd, parameterResults, qcData, isNew]);

  const handleSave = useCallback(() => { message.success('Draft saved successfully'); }, [message]);
  const handleSubmit = useCallback(() => { message.success('Inspection submitted for approval'); }, [message]);
  const handleApprove = useCallback(() => { message.success('Inspection approved'); }, [message]);
  const handleReject = useCallback(() => { message.error('Inspection rejected'); }, [message]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={isNew ? 'New Fabric QC Inspection' : `Fabric QC — ${qcData?.qcNumber || ''}`} backPath="/inventory/qc" style={{ position: 'sticky', top: 64, zIndex: 10 }}>
        <Space>
          <ActionButton action="save" variant="draft" text="Save Draft" icon={<SaveOutlined />} onClick={handleSave} loading={loading} />
          <ActionButton action="save" text="Submit" icon={<SendOutlined />} onClick={handleSubmit} loading={loading} />
        </Space>
      </PageHeader>

      <Row gutter={24} align="stretch" style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card title="Inspection Details" size="small" style={{ height: '100%' }}>
            <Form form={form} layout="vertical">
              <Form.Item label="GRN Number" name="grnNumber" rules={[{ required: true, message: 'Select GRN' }]}>
                <Select placeholder="Select GRN" showSearch optionFilterProp="label" options={[
                  { label: 'GRN-F-2026-0001', value: 'GRN-F-2026-0001' },
                  { label: 'GRN-F-2026-0002', value: 'GRN-F-2026-0002' },
                  { label: 'GRN-F-2026-0003', value: 'GRN-F-2026-0003' },
                ]} />
              </Form.Item>
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
          <FabricQCResultPanel
            totalDefectPoints={totalDefectPoints}
            pointsPer100SqYd={pointsPer100SqYd}
            overallResult={isNew ? overallResult : (qcData?.overallResult || overallResult)}
            parametersPassCount={parameterResults.passCount}
            parametersTotalCount={parameterResults.total}
            approvalStatus={qcData?.approvalStatus || 'Pending'}
            approver={qcData?.approver}
            approvalRemarks={qcData?.approvalRemarks}
            onApprove={handleApprove}
            onReject={handleReject}
            readOnly={!isNew && qcData?.approvalStatus !== 'Pending'}
          />
        </Col>
      </Row>

      <div style={{ marginBottom: 24 }}>
        <FabricQCParameters parameters={parameters} onParameterChange={handleParameterChange} readOnly={!isNew && qcData?.approvalStatus === 'Approved'} />
      </div>

      <Card title="Defect Analysis (4-Point System)" size="small">
        <FabricQCDefectTable
          defects={defects}
          onDefectChange={handleDefectChange}
          onAddDefect={handleAddDefect}
          onRemoveDefect={handleRemoveDefect}
          totalPoints={totalDefectPoints}
          pointsPer100SqYd={pointsPer100SqYd}
        />
      </Card>
    </div>
  );
};

export default FabricQCInspection;
