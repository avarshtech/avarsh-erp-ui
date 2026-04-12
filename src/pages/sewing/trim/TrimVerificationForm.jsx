import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Form, Input, DatePicker, Button, Card,
  Row, Col, Table, Skeleton, Select,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import {
  createTrimVerification, getTrimVerificationById, searchSewingPlans,
} from '../../../services/sewing/sewingService';
import { TRIM_CHECK_TYPES, TRIM_ITEM_STATUS } from '../../../utils/sewingConstants';

const DEFAULT_MATERIALS = [
  { name: 'Fabric', status: null, remarks: '' },
  { name: 'Main Label', status: null, remarks: '' },
  { name: 'Size Label', status: null, remarks: '' },
  { name: 'Thread', status: null, remarks: '' },
  { name: 'Buttons', status: null, remarks: '' },
  { name: 'Zipper', status: null, remarks: '' },
  { name: 'Interlining', status: null, remarks: '' },
  { name: 'Drawcord', status: null, remarks: '' },
];

const DEFAULT_APPROVALS = [
  { name: 'Washing Approval', status: null, remarks: '' },
  { name: 'Sample Approval', status: null, remarks: '' },
  { name: 'PP Comment', status: null, remarks: '' },
  { name: 'GPT', status: null, remarks: '' },
  { name: 'FPT', status: null, remarks: '' },
  { name: 'Shrinkage Test', status: null, remarks: '' },
  { name: 'Shade Band', status: null, remarks: '' },
];

const TrimVerificationForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isView = !!id;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState(null);
  const [planOptions, setPlanOptions] = useState([]);
  const [planSearching, setPlanSearching] = useState(false);
  const [materials, setMaterials] = useState(DEFAULT_MATERIALS);
  const [approvals, setApprovals] = useState(DEFAULT_APPROVALS);

  useEffect(() => {
    if (isView) {
      setLoading(true);
      getTrimVerificationById(id)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            sewingPlanId: data.sewingPlanId,
            verificationDate: data.verificationDate ? dayjs(data.verificationDate) : null,
            checkType: data.checkType,
            verifiedBy: data.verifiedBy,
          });
          setMaterials(data.materials || DEFAULT_MATERIALS);
          setApprovals(data.approvals || DEFAULT_APPROVALS);
          setPlanOptions([{ value: data.sewingPlanId, label: `${data.planNo || ''} - ${data.styleNo || ''}` }]);
        })
        .catch(() => message.error('Failed to load trim verification'))
        .finally(() => setLoading(false));
    } else {
      form.setFieldsValue({ verificationDate: dayjs() });
    }
  }, [id, isView, form]);

  const handlePlanSearch = useCallback(async (search) => {
    if (!search || search.length < 2) return;
    setPlanSearching(true);
    try {
      const res = await searchSewingPlans({ search, status: 'APPROVED', page: 0, size: 20 });
      setPlanOptions((res.content || []).map((p) => ({
        value: p.id,
        label: `${p.planNo} - ${p.styleNo || ''} - ${p.color || ''}`,
      })));
    } catch { /* ignore */ }
    finally { setPlanSearching(false); }
  }, []);

  const updateChecklist = useCallback((setter, index, field, value) => {
    setter((prev) => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }, []);

  // Derive overall status from all items
  const overallStatus = useMemo(() => {
    const all = [...materials, ...approvals];
    const statuses = all.map((it) => it.status).filter(Boolean);
    if (statuses.length === 0) return 'PENDING';
    if (statuses.some((s) => s === 'MISSING')) return 'ISSUES_FOUND';
    return 'ALL_CLEAR';
  }, [materials, approvals]);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        sewingPlanId: values.sewingPlanId,
        verificationDate: values.verificationDate?.format('YYYY-MM-DD'),
        checkType: values.checkType,
        verifiedBy: values.verifiedBy,
        overallStatus,
        materials: materials.map((m) => ({ name: m.name, status: m.status, remarks: m.remarks })),
        approvals: approvals.map((a) => ({ name: a.name, status: a.status, remarks: a.remarks })),
      };
      await createTrimVerification(payload);
      message.success('Trim verification created');
      navigate('/sewing/trim-verification/list');
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, materials, approvals, overallStatus, navigate]);

  const makeChecklistColumns = useCallback((setter, disabled) => [
    { title: 'Item', dataIndex: 'name', key: 'name', width: 180 },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (val, _, index) => (
        <Select
          size="small"
          value={val}
          onChange={(v) => updateChecklist(setter, index, 'status', v)}
          options={TRIM_ITEM_STATUS}
          placeholder="Select"
          style={{ width: '100%' }}
          allowClear
          disabled={disabled}
        />
      ),
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      key: 'remarks',
      render: (val, _, index) => (
        <Input
          size="small"
          value={val}
          onChange={(e) => updateChecklist(setter, index, 'remarks', e.target.value)}
          placeholder="Remarks"
          disabled={disabled}
        />
      ),
    },
  ], [updateChecklist]);

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <>
      <PageHeader
        title={isView ? `Trim Verification: ${record?.verificationNo || ''}` : 'New Trim Verification'}
        onBack={() => navigate('/sewing/trim-verification/list')}
        extra={!isView && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            Save
          </Button>
        )}
      />

      <Card title="Verification Details" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" disabled={isView}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="sewingPlanId" label="Sewing Plan" rules={[{ required: true, message: 'Select a plan' }]}>
                <Select
                  showSearch
                  filterOption={false}
                  onSearch={handlePlanSearch}
                  loading={planSearching}
                  options={planOptions}
                  placeholder="Search sewing plans..."
                  disabled={isView}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="verificationDate" label="Verification Date" rules={[{ required: true, message: 'Select date' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="checkType" label="Check Type" rules={[{ required: true, message: 'Select check type' }]}>
                <Select options={TRIM_CHECK_TYPES} placeholder="Select check type" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="verifiedBy" label="Verified By" rules={[{ required: true, message: 'Enter name' }]}>
                <Input placeholder="Verified By" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card title="Materials Checklist" style={{ marginBottom: 16 }}>
        <Table
          rowKey={(_, index) => `mat-${index}`}
          columns={makeChecklistColumns(setMaterials, isView)}
          dataSource={materials}
          pagination={false}
          size="small"
        />
      </Card>

      <Card title="Approvals Checklist">
        <Table
          rowKey={(_, index) => `apr-${index}`}
          columns={makeChecklistColumns(setApprovals, isView)}
          dataSource={approvals}
          pagination={false}
          size="small"
        />
      </Card>
    </>
  );
};

export default TrimVerificationForm;
