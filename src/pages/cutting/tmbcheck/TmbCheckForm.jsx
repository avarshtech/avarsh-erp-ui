import { useState, useEffect, useCallback } from 'react';
import {
  App, Form, Input, Select, DatePicker, InputNumber, Button, Card,
  Row, Col, Table, Skeleton, Checkbox,
} from 'antd';
import { SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import {
  createTmbCheck, updateTmbCheck, getTmbCheckById,
  searchLayAudits,
} from '../../../services/cutting/cuttingService';
import {
  TMB_RESULT, PANEL_NAMES, TMB_COMMENTS, TMB_CORRECTIVE_ACTIONS,
} from '../../../utils/cuttingConstants';

const PANEL_OPTIONS = PANEL_NAMES.map((p) => ({ value: p, label: p }));

const TmbCheckForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState(null);
  const [layAuditOptions, setLayAuditOptions] = useState([]);
  const [layAuditSearching, setLayAuditSearching] = useState(false);
  const [details, setDetails] = useState([]);

  // Load record in edit mode
  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      getTmbCheckById(id)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            layAuditId: data.layAuditId,
            checkDate: data.checkDate ? dayjs(data.checkDate) : null,
            directionGrain: data.directionGrain,
            approvedPattern: data.approvedPattern,
            cuttingMachine: data.cuttingMachine,
            qcInspector: data.qcInspector,
            remarks: data.remarks,
          });
          setDetails(data.details || []);
          if (data.layAuditId) {
            setLayAuditOptions([{ value: data.layAuditId, label: data.auditNo || `Audit-${data.layAuditId}` }]);
          }
        })
        .catch(() => message.error('Failed to load TMB check'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, form]);

  // Search lay audits
  const handleLayAuditSearch = useCallback(async (search) => {
    if (!search || search.length < 2) return;
    setLayAuditSearching(true);
    try {
      const res = await searchLayAudits({ search, page: 0, size: 20 });
      setLayAuditOptions((res.content || []).map((a) => ({
        value: a.id,
        label: `${a.auditNo} — ${a.styleNo || ''} — ${a.color || ''}`,
        audit: a,
      })));
    } catch { /* ignore */ }
    finally { setLayAuditSearching(false); }
  }, []);

  // When lay audit is selected, auto-populate
  const handleLayAuditSelect = useCallback((value, option) => {
    const audit = option?.audit;
    if (!audit) return;
    form.setFieldsValue({
      checkDate: dayjs(),
    });
  }, [form]);

  // Detail management
  const addDetailRow = useCallback(() => {
    setDetails((prev) => [...prev, {
      partName: '', size: '',
      top1: null, top2: null, top3: null,
      mid1: null, mid2: null, mid3: null,
      bot1: null, bot2: null, bot3: null,
      numPieces: 0, withinTolerance: true,
      comments: null, correctiveAction: null,
    }]);
  }, []);

  const removeDetailRow = useCallback((index) => {
    setDetails((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateDetailRow = useCallback((index, field, value) => {
    setDetails((prev) => prev.map((row, i) => {
      if (i !== index) return row;
      const updated = { ...row, [field]: value };
      // Auto-calc withinTolerance: all top/mid/bot values should be close to each other
      // Simple logic: mark within tolerance if no measurement exceeds 2mm variance from first
      const measurements = [
        updated.top1, updated.top2, updated.top3,
        updated.mid1, updated.mid2, updated.mid3,
        updated.bot1, updated.bot2, updated.bot3,
      ].filter((v) => v != null && v !== '');
      if (measurements.length >= 2) {
        const min = Math.min(...measurements);
        const max = Math.max(...measurements);
        updated.withinTolerance = (max - min) <= 2;
      }
      return updated;
    }));
  }, []);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (details.length === 0) {
        message.warning('Add at least one detail row');
        return;
      }
      setSaving(true);
      const payload = {
        layAuditId: values.layAuditId,
        checkDate: values.checkDate?.format('YYYY-MM-DD'),
        directionGrain: values.directionGrain,
        approvedPattern: values.approvedPattern,
        cuttingMachine: values.cuttingMachine,
        qcInspector: values.qcInspector,
        remarks: values.remarks,
        details: details.map((d) => ({
          id: d.id,
          partName: d.partName,
          size: d.size,
          top1: d.top1, top2: d.top2, top3: d.top3,
          mid1: d.mid1, mid2: d.mid2, mid3: d.mid3,
          bot1: d.bot1, bot2: d.bot2, bot3: d.bot3,
          numPieces: d.numPieces || 0,
          withinTolerance: d.withinTolerance,
          comments: d.comments,
          correctiveAction: d.correctiveAction,
        })),
        version: record?.version,
      };
      if (isEdit) {
        await updateTmbCheck(id, payload);
        message.success('TMB check updated');
      } else {
        await createTmbCheck(payload);
        message.success('TMB check created');
      }
      navigate('/cutting/tmb-check/list');
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, details, record, isEdit, id, navigate]);

  const isEditable = !isEdit || (record && record.overallResult === TMB_RESULT.PENDING);

  const detailColumns = [
    {
      title: 'Part', dataIndex: 'partName', key: 'partName', width: 120, fixed: 'left',
      render: (val, _, index) => (
        <Select size="small" value={val} options={PANEL_OPTIONS} placeholder="Part"
          onChange={(v) => updateDetailRow(index, 'partName', v)} disabled={!isEditable} style={{ width: '100%' }} />
      ),
    },
    {
      title: 'Size', dataIndex: 'size', key: 'size', width: 80,
      render: (val, _, index) => (
        <Input size="small" value={val} placeholder="Size"
          onChange={(e) => updateDetailRow(index, 'size', e.target.value)} disabled={!isEditable} />
      ),
    },
    ...['top1', 'top2', 'top3', 'mid1', 'mid2', 'mid3', 'bot1', 'bot2', 'bot3'].map((field) => ({
      title: field.replace(/([A-Z])/g, ' $1').replace(/(\d)/, ' $1').trim().toUpperCase().replace('TOP', 'T').replace('MID', 'M').replace('BOT', 'B'),
      dataIndex: field, key: field, width: 70, align: 'right',
      render: (val, _, index) => (
        <InputNumber size="small" value={val} precision={2}
          onChange={(v) => updateDetailRow(index, field, v)} disabled={!isEditable} style={{ width: '100%' }} />
      ),
    })),
    {
      title: 'Pcs', dataIndex: 'numPieces', key: 'numPieces', width: 70, align: 'right',
      render: (val, _, index) => (
        <InputNumber size="small" min={0} value={val}
          onChange={(v) => updateDetailRow(index, 'numPieces', v)} disabled={!isEditable} style={{ width: '100%' }} />
      ),
    },
    {
      title: 'OK', dataIndex: 'withinTolerance', key: 'withinTolerance', width: 50, align: 'center',
      render: (val) => <Checkbox checked={val} disabled />,
    },
    {
      title: 'Comments', dataIndex: 'comments', key: 'comments', width: 130,
      render: (val, _, index) => (
        <Select size="small" value={val} options={TMB_COMMENTS} placeholder="Comment"
          onChange={(v) => updateDetailRow(index, 'comments', v)} disabled={!isEditable} style={{ width: '100%' }} allowClear />
      ),
    },
    {
      title: 'Action', dataIndex: 'correctiveAction', key: 'correctiveAction', width: 150,
      render: (val, _, index) => (
        <Select size="small" value={val} options={TMB_CORRECTIVE_ACTIONS} placeholder="Action"
          onChange={(v) => updateDetailRow(index, 'correctiveAction', v)} disabled={!isEditable} style={{ width: '100%' }} allowClear />
      ),
    },
    ...(isEditable ? [{
      title: '', key: 'del', width: 50, fixed: 'right',
      render: (_, __, index) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeDetailRow(index)} />
      ),
    }] : []),
  ];

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <>
      <PageHeader
        title={isEdit ? `Edit TMB Check: ${record?.checkNo || ''}` : 'New TMB Check'}
        onBack={() => navigate('/cutting/tmb-check/list')}
        extra={isEditable && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            {isEdit ? 'Update' : 'Save'}
          </Button>
        )}
      />

      <Card title="Check Details" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" disabled={!isEditable}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="layAuditId" label="Lay Audit" rules={[{ required: true, message: 'Select a lay audit' }]}>
                <Select
                  showSearch
                  filterOption={false}
                  onSearch={handleLayAuditSearch}
                  onSelect={handleLayAuditSelect}
                  loading={layAuditSearching}
                  options={layAuditOptions}
                  placeholder="Search lay audits..."
                  disabled={isEdit}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="checkDate" label="Check Date" rules={[{ required: true, message: 'Select check date' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="directionGrain" label="Direction / Grain">
                <Input placeholder="Direction / Grain" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="approvedPattern" label="Approved Pattern">
                <Input placeholder="Approved Pattern" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="cuttingMachine" label="Cutting Machine">
                <Input placeholder="Cutting Machine" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="qcInspector" label="QC Inspector">
                <Input placeholder="QC Inspector" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="remarks" label="Remarks">
                <Input.TextArea rows={2} placeholder="Remarks" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card
        title="TMB Measurements"
        extra={isEditable && (
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addDetailRow}>Add Row</Button>
        )}
      >
        <Table
          rowKey={(_, index) => index}
          columns={detailColumns}
          dataSource={details}
          pagination={false}
          size="small"
          scroll={{ x: 1600 }}
        />
      </Card>
    </>
  );
};

export default TmbCheckForm;
