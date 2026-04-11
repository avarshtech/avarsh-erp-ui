import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Form, Input, Select, Button, Card, Row, Col, Table, Skeleton, Tag, InputNumber,
} from 'antd';
import { SaveOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import {
  createBundling, getBundlingById, generateBundles,
  searchCutOrderPlans, searchCuttingReports,
} from '../../../services/cutting/cuttingService';
import { BUNDLE_SIZE_OPTIONS, getBundleStatusLabel, getBundleStatusColor } from '../../../utils/cuttingConstants';

const { TextArea } = Input;

const BundlingForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [record, setRecord] = useState(null);
  const [bundles, setBundles] = useState([]);

  const [planOptions, setPlanOptions] = useState([]);
  const [planSearching, setPlanSearching] = useState(false);
  const [reportOptions, setReportOptions] = useState([]);
  const [reportSearching, setReportSearching] = useState(false);

  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      getBundlingById(id)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            planId: data.planId,
            reportId: data.reportId,
            bundleSize: data.bundleSize,
            remarks: data.remarks,
          });
          setBundles(data.bundles || []);
          if (data.planId) {
            setPlanOptions([{ value: data.planId, label: `Plan #${data.planId} — ${data.styleNo || ''}` }]);
          }
          if (data.reportId) {
            setReportOptions([{ value: data.reportId, label: `Report #${data.reportId}` }]);
          }
        })
        .catch(() => message.error('Failed to load bundling record'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, form]);

  const handlePlanSearch = useCallback(async (search) => {
    if (!search || search.length < 2) return;
    setPlanSearching(true);
    try {
      const res = await searchCutOrderPlans({ search, status: 'APPROVED', page: 0, size: 20 });
      setPlanOptions((res.content || []).map((p) => ({
        value: p.id,
        label: `${p.planNo} — ${p.styleNo || ''} — ${p.color || ''}`,
        plan: p,
      })));
    } catch { /* ignore */ }
    finally { setPlanSearching(false); }
  }, []);

  const handleReportSearch = useCallback(async (search) => {
    if (!search || search.length < 2) return;
    setReportSearching(true);
    try {
      const res = await searchCuttingReports({ search, page: 0, size: 20 });
      setReportOptions((res.content || []).map((r) => ({
        value: r.id,
        label: `${r.reportNo} — ${r.styleNo || ''} — ${r.color || ''}`,
      })));
    } catch { /* ignore */ }
    finally { setReportSearching(false); }
  }, []);

  const handlePlanSelect = useCallback((_value, option) => {
    const plan = option?.plan;
    if (plan) {
      form.setFieldsValue({});
    }
  }, [form]);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        planId: values.planId,
        reportId: values.reportId,
        bundleSize: values.bundleSize || 20,
        remarks: values.remarks,
      };
      await createBundling(payload);
      message.success('Bundling record created');
      navigate('/cutting/bundling/list');
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, navigate]);

  const handleGenerate = useCallback(async () => {
    if (!record?.id) return;
    setGenerating(true);
    try {
      const data = await generateBundles(record.id);
      setRecord(data);
      setBundles(data.bundles || []);
      message.success(`Generated ${(data.bundles || []).length} bundles`);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Generate failed');
    } finally {
      setGenerating(false);
    }
  }, [record]);

  const isDraft = !isEdit || record?.status === 'DRAFT';

  const bundleColumns = useMemo(() => [
    { title: 'Bundle No', dataIndex: 'bundleNo', key: 'bundleNo', width: 160, render: (t) => <span style={{ fontFamily: 'monospace' }}>{t}</span> },
    { title: 'Size', dataIndex: 'size', key: 'size', width: 80 },
    { title: 'Color', dataIndex: 'color', key: 'color', width: 100 },
    { title: 'Qty', dataIndex: 'qty', key: 'qty', width: 80, align: 'right' },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 120,
      render: (s) => <Tag color={getBundleStatusColor(s)}>{getBundleStatusLabel(s)}</Tag>,
    },
  ], []);

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <>
      <PageHeader
        title={isEdit ? `Bundling: ${record?.styleNo || ''} — ${record?.color || ''}` : 'New Bundling Record'}
        onBack={() => navigate('/cutting/bundling/list')}
        extra={
          <span style={{ display: 'flex', gap: 8 }}>
            {isDraft && !isEdit && (
              <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
                Save
              </Button>
            )}
            {isDraft && isEdit && (
              <Button type="primary" icon={<ThunderboltOutlined />} loading={generating} onClick={handleGenerate}>
                Generate Bundles
              </Button>
            )}
          </span>
        }
      />

      <Card title="Bundling Details" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" disabled={isEdit}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="planId" label="Cut Order Plan" rules={[{ required: true, message: 'Select a plan' }]}>
                <Select
                  showSearch
                  filterOption={false}
                  onSearch={handlePlanSearch}
                  onSelect={handlePlanSelect}
                  loading={planSearching}
                  options={planOptions}
                  placeholder="Search approved plans..."
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="reportId" label="Cutting Report">
                <Select
                  showSearch
                  filterOption={false}
                  onSearch={handleReportSearch}
                  loading={reportSearching}
                  options={reportOptions}
                  placeholder="Search cutting reports..."
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="bundleSize" label="Bundle Size" initialValue={20}>
                <Select options={BUNDLE_SIZE_OPTIONS} placeholder="Select bundle size" />
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

      {bundles.length > 0 && (
        <Card title={`Generated Bundles (${bundles.length})`}>
          <Table
            rowKey="id"
            columns={bundleColumns}
            dataSource={bundles}
            pagination={bundles.length > 50 ? { pageSize: 50 } : false}
            size="small"
            scroll={{ x: 600 }}
          />
        </Card>
      )}
    </>
  );
};

export default BundlingForm;
