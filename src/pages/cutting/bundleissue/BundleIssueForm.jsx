import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Form, Input, Select, Button, Card, Row, Col, Table, Skeleton, DatePicker, InputNumber,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import {
  createBundleIssue, getBundleIssueById, getAvailableBundles,
} from '../../../services/cuttingService';
import { searchCutOrderPlans } from '../../../services/cuttingService';

const { TextArea } = Input;

const BundleIssueForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewId = searchParams.get('view');
  const isViewMode = !!viewId;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState(null);
  const [availableBundles, setAvailableBundles] = useState([]);
  const [selectedBundleIds, setSelectedBundleIds] = useState([]);
  const [bundlesLoading, setBundlesLoading] = useState(false);

  const [planOptions, setPlanOptions] = useState([]);
  const [planSearching, setPlanSearching] = useState(false);

  // View mode: load existing issue
  useEffect(() => {
    if (isViewMode) {
      setLoading(true);
      getBundleIssueById(viewId)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            planId: data.planId,
            issuedToLine: data.issuedToLine,
            issuedBy: data.issuedBy,
            receivedBy: data.receivedBy,
            issueDate: data.issueDate ? dayjs(data.issueDate) : null,
            remarks: data.remarks,
          });
        })
        .catch(() => message.error('Failed to load bundle issue'))
        .finally(() => setLoading(false));
    }
  }, [viewId, isViewMode, form]);

  const handlePlanSearch = useCallback(async (search) => {
    if (!search || search.length < 2) return;
    setPlanSearching(true);
    try {
      const res = await searchCutOrderPlans({ search, page: 0, size: 20 });
      setPlanOptions((res.content || []).map((p) => ({
        value: p.id,
        label: `${p.planNo} — ${p.styleNo || ''} — ${p.color || ''}`,
        plan: p,
      })));
    } catch { /* ignore */ }
    finally { setPlanSearching(false); }
  }, []);

  const handlePlanSelect = useCallback(async (_value, option) => {
    const plan = option?.plan;
    if (!plan) return;
    // Load available CREATED bundles
    setBundlesLoading(true);
    try {
      const bundles = await getAvailableBundles({ status: 'CREATED' });
      setAvailableBundles(bundles || []);
    } catch {
      message.error('Failed to load available bundles');
    } finally {
      setBundlesLoading(false);
    }
  }, []);

  const selectedBundles = useMemo(
    () => availableBundles.filter((b) => selectedBundleIds.includes(b.id)),
    [availableBundles, selectedBundleIds]
  );
  const totalBundles = selectedBundles.length;
  const totalPieces = selectedBundles.reduce((sum, b) => sum + (b.qty || 0), 0);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (selectedBundleIds.length === 0) {
        message.warning('Select at least one bundle');
        return;
      }
      setSaving(true);
      const payload = {
        planId: values.planId,
        issuedToLine: values.issuedToLine,
        issuedBy: values.issuedBy,
        receivedBy: values.receivedBy,
        issueDate: values.issueDate?.format('YYYY-MM-DD'),
        remarks: values.remarks,
        items: selectedBundleIds.map((bid) => ({ bundleId: bid })),
      };
      await createBundleIssue(payload);
      message.success('Bundle issue created');
      navigate('/cutting/bundle-issue/list');
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, selectedBundleIds, navigate]);

  const bundleColumns = useMemo(() => [
    { title: 'Bundle No', dataIndex: 'bundleNo', key: 'bundleNo', width: 160, render: (t) => <span style={{ fontFamily: 'monospace' }}>{t}</span> },
    { title: 'Size', dataIndex: 'size', key: 'size', width: 80 },
    { title: 'Color', dataIndex: 'color', key: 'color', width: 100 },
    { title: 'Qty', dataIndex: 'qty', key: 'qty', width: 80, align: 'right' },
  ], []);

  const viewItemColumns = useMemo(() => [
    { title: 'Bundle ID', dataIndex: 'bundleId', key: 'bundleId', width: 100 },
    { title: 'Size', dataIndex: 'size', key: 'size', width: 80 },
    { title: 'Qty', dataIndex: 'qty', key: 'qty', width: 80, align: 'right' },
  ], []);

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <>
      <PageHeader
        title={isViewMode ? `Bundle Issue: ${record?.issueNo || ''}` : 'New Bundle Issue'}
        onBack={() => navigate('/cutting/bundle-issue/list')}
        extra={!isViewMode && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            Save
          </Button>
        )}
      />

      <Card title="Issue Details" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" disabled={isViewMode}>
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
                  disabled={isViewMode}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="issuedToLine" label="Issued To Line" rules={[{ required: true, message: 'Enter line' }]}>
                <Input placeholder="e.g. Line 5" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="issueDate" label="Issue Date" initialValue={dayjs()}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="issuedBy" label="Issued By">
                <Input placeholder="Name of issuer" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="receivedBy" label="Received By">
                <Input placeholder="Name of receiver" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item label="Totals">
                <span style={{ marginRight: 16 }}>Bundles: <strong>{isViewMode ? record?.totalBundles : totalBundles}</strong></span>
                <span>Pieces: <strong>{isViewMode ? record?.totalPieces : totalPieces}</strong></span>
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

      {isViewMode ? (
        <Card title="Issued Bundles">
          <Table
            rowKey="id"
            columns={viewItemColumns}
            dataSource={record?.items || []}
            pagination={false}
            size="small"
          />
        </Card>
      ) : (
        <Card title={`Available Bundles (${availableBundles.length})`}>
          <Table
            rowKey="id"
            columns={bundleColumns}
            dataSource={availableBundles}
            loading={bundlesLoading}
            pagination={availableBundles.length > 50 ? { pageSize: 50 } : false}
            size="small"
            scroll={{ x: 500 }}
            rowSelection={{
              selectedRowKeys: selectedBundleIds,
              onChange: setSelectedBundleIds,
            }}
          />
        </Card>
      )}
    </>
  );
};

export default BundleIssueForm;
