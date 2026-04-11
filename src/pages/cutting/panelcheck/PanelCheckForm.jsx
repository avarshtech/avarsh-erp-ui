import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Form, Input, Select, Button, Card, Row, Col, Table, Skeleton, DatePicker, InputNumber, Checkbox,
} from 'antd';
import { SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import {
  createPanelCheck, getPanelCheckById, searchPanelIssues,
} from '../../../services/cuttingService';
import { PANEL_CHECK_RESULT } from '../../../utils/cuttingConstants';

const { TextArea } = Input;

const RESULT_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'PASSED', label: 'Passed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'PARTIAL', label: 'Partial' },
];

const PanelCheckForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewId = searchParams.get('view');
  const isViewMode = !!viewId;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState(null);
  const [details, setDetails] = useState([]);

  const [issueOptions, setIssueOptions] = useState([]);
  const [issueSearching, setIssueSearching] = useState(false);

  useEffect(() => {
    if (isViewMode) {
      setLoading(true);
      getPanelCheckById(viewId)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            panelIssueId: data.panelIssueId,
            processName: data.processName,
            qcInspector: data.qcInspector,
            checkDate: data.checkDate ? dayjs(data.checkDate) : null,
            overallResult: data.overallResult,
            remarks: data.remarks,
          });
          setDetails(data.details || []);
        })
        .catch(() => message.error('Failed to load panel check'))
        .finally(() => setLoading(false));
    }
  }, [viewId, isViewMode, form]);

  const handleIssueSearch = useCallback(async (search) => {
    if (!search || search.length < 2) return;
    setIssueSearching(true);
    try {
      const res = await searchPanelIssues({ search, status: 'ISSUED', page: 0, size: 20 });
      setIssueOptions((res.content || []).map((p) => ({
        value: p.id,
        label: `${p.issueNo} — ${p.processName || ''} — ${p.styleNo || ''}`,
        issue: p,
      })));
    } catch { /* ignore */ }
    finally { setIssueSearching(false); }
  }, []);

  const handleIssueSelect = useCallback((_value, option) => {
    const issue = option?.issue;
    if (issue) {
      form.setFieldsValue({ processName: issue.processName });
    }
  }, [form]);

  const addDetail = useCallback(() => {
    setDetails((prev) => [...prev, { size: '', bundleRange: '', verified: false, qualityStatus: '', comments: '', correctiveAction: '' }]);
  }, []);

  const removeDetail = useCallback((index) => {
    setDetails((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateDetail = useCallback((index, field, value) => {
    setDetails((prev) => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }, []);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (details.length === 0) {
        message.warning('Add at least one check detail');
        return;
      }
      setSaving(true);
      const totalChecked = details.length;
      const totalPassed = details.filter((d) => d.verified).length;
      const totalFailed = totalChecked - totalPassed;
      const payload = {
        panelIssueId: values.panelIssueId,
        processName: values.processName,
        qcInspector: values.qcInspector,
        checkDate: values.checkDate?.format('YYYY-MM-DD'),
        overallResult: values.overallResult || 'PENDING',
        totalChecked,
        totalPassed,
        totalFailed,
        remarks: values.remarks,
        details: details.map((d) => ({
          size: d.size,
          bundleRange: d.bundleRange,
          verified: d.verified || false,
          qualityStatus: d.qualityStatus,
          comments: d.comments,
          correctiveAction: d.correctiveAction,
        })),
      };
      await createPanelCheck(payload);
      message.success('Panel check created');
      navigate('/cutting/panel-check/list');
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, details, navigate]);

  const detailColumns = useMemo(() => [
    {
      title: 'Size', dataIndex: 'size', key: 'size', width: 80,
      render: (val, _, index) => isViewMode ? val : (
        <Input size="small" value={val} placeholder="Size"
          onChange={(e) => updateDetail(index, 'size', e.target.value)} />
      ),
    },
    {
      title: 'Bundle Range', dataIndex: 'bundleRange', key: 'bundleRange', width: 120,
      render: (val, _, index) => isViewMode ? val : (
        <Input size="small" value={val} placeholder="e.g. 1-50"
          onChange={(e) => updateDetail(index, 'bundleRange', e.target.value)} />
      ),
    },
    {
      title: 'Verified', dataIndex: 'verified', key: 'verified', width: 80, align: 'center',
      render: (val, _, index) => (
        <Checkbox checked={val} disabled={isViewMode}
          onChange={(e) => updateDetail(index, 'verified', e.target.checked)} />
      ),
    },
    {
      title: 'Quality Status', dataIndex: 'qualityStatus', key: 'qualityStatus', width: 120,
      render: (val, _, index) => isViewMode ? val : (
        <Select size="small" value={val} onChange={(v) => updateDetail(index, 'qualityStatus', v)}
          placeholder="Status" style={{ width: '100%' }} allowClear
          options={[{ value: 'OK', label: 'OK' }, { value: 'REJECT', label: 'Reject' }, { value: 'REWORK', label: 'Rework' }]} />
      ),
    },
    {
      title: 'Comments', dataIndex: 'comments', key: 'comments', width: 150,
      render: (val, _, index) => isViewMode ? val : (
        <Input size="small" value={val} placeholder="Comments"
          onChange={(e) => updateDetail(index, 'comments', e.target.value)} />
      ),
    },
    {
      title: 'Corrective Action', dataIndex: 'correctiveAction', key: 'correctiveAction', width: 150,
      render: (val, _, index) => isViewMode ? val : (
        <Input size="small" value={val} placeholder="Action"
          onChange={(e) => updateDetail(index, 'correctiveAction', e.target.value)} />
      ),
    },
    ...(!isViewMode ? [{
      title: '', key: 'action', width: 50,
      render: (_, __, index) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeDetail(index)} />
      ),
    }] : []),
  ], [isViewMode, updateDetail, removeDetail]);

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <>
      <PageHeader
        title={isViewMode ? `Panel Check: ${record?.checkNo || ''}` : 'New Panel Check'}
        onBack={() => navigate('/cutting/panel-check/list')}
        extra={!isViewMode && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            Save
          </Button>
        )}
      />

      <Card title="Check Details" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" disabled={isViewMode}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="panelIssueId" label="Panel Issue" rules={[{ required: true, message: 'Select a panel issue' }]}>
                <Select
                  showSearch filterOption={false}
                  onSearch={handleIssueSearch}
                  onSelect={handleIssueSelect}
                  loading={issueSearching}
                  options={issueOptions}
                  placeholder="Search panel issues..."
                  disabled={isViewMode}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="processName" label="Process">
                <Input placeholder="Auto-filled from issue" disabled />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="checkDate" label="Check Date" initialValue={dayjs()}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="qcInspector" label="QC Inspector">
                <Input placeholder="Inspector name" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="overallResult" label="Overall Result" initialValue="PENDING">
                <Select options={RESULT_OPTIONS} />
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
        title="Verification Grid"
        extra={!isViewMode && (
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addDetail}>Add Row</Button>
        )}
      >
        <Table
          rowKey={(_, index) => index}
          columns={detailColumns}
          dataSource={details}
          pagination={false}
          size="small"
          scroll={{ x: 800 }}
        />
      </Card>
    </>
  );
};

export default PanelCheckForm;
