import { useState, useEffect, useCallback } from 'react';
import {
  App, Form, Input, Select, DatePicker, InputNumber, Button, Card,
  Row, Col, Table, Skeleton,
} from 'antd';
import { SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import {
  createLayAudit, updateLayAudit, getLayAuditById,
  searchCutOrderPlans, searchMarkers,
} from '../../../services/cutting/cuttingService';
import { LAY_AUDIT_STATUS } from '../../../utils/cuttingConstants';

const LAY_AUDIT_EDITABLE = [LAY_AUDIT_STATUS.DRAFT];

const LayAuditForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState(null);
  const [planOptions, setPlanOptions] = useState([]);
  const [planSearching, setPlanSearching] = useState(false);
  const [markerOptions, setMarkerOptions] = useState([]);
  const [markerSearching, setMarkerSearching] = useState(false);
  const [rolls, setRolls] = useState([]);

  // Load record in edit mode
  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      getLayAuditById(id)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            planId: data.planId,
            markerId: data.markerId,
            layNo: data.layNo,
            layDate: data.layDate ? dayjs(data.layDate) : null,
            layLengthM: data.layLengthM,
            layHeightM: data.layHeightM,
            endToEndWidthM: data.endToEndWidthM,
            layStartTime: data.layStartTime ? dayjs(data.layStartTime) : null,
            layEndTime: data.layEndTime ? dayjs(data.layEndTime) : null,
            remarks: data.remarks,
          });
          setRolls(data.rolls || []);
          if (data.planId) {
            setPlanOptions([{ value: data.planId, label: data.planNo || `Plan-${data.planId}` }]);
          }
          if (data.markerId) {
            setMarkerOptions([{ value: data.markerId, label: data.markerNo || `Marker-${data.markerId}` }]);
          }
        })
        .catch(() => message.error('Failed to load lay audit'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, form]);

  // Search plans
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

  // Search markers
  const handleMarkerSearch = useCallback(async (search) => {
    if (!search || search.length < 2) return;
    setMarkerSearching(true);
    try {
      const res = await searchMarkers({ search, page: 0, size: 20 });
      setMarkerOptions((res.content || []).map((m) => ({
        value: m.id,
        label: `${m.markerNo} — ${m.styleNo || ''}`,
      })));
    } catch { /* ignore */ }
    finally { setMarkerSearching(false); }
  }, []);

  // Roll management
  const addRollRow = useCallback(() => {
    setRolls((prev) => [...prev, { rollNo: '', weightKg: 0, weightPerLayKg: 0, numLays: 0, totalLayWeightKg: 0, shortExcessKg: 0 }]);
  }, []);

  const removeRollRow = useCallback((index) => {
    setRolls((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateRollRow = useCallback((index, field, value) => {
    setRolls((prev) => prev.map((row, i) => {
      if (i !== index) return row;
      const updated = { ...row, [field]: value };
      // Auto-calc total_lay_weight = weight_per_lay * num_lays
      const wpl = field === 'weightPerLayKg' ? value : updated.weightPerLayKg;
      const nl = field === 'numLays' ? value : updated.numLays;
      updated.totalLayWeightKg = parseFloat(((wpl || 0) * (nl || 0)).toFixed(3));
      // Auto-calc short_excess = weight - total_lay_weight
      const wt = field === 'weightKg' ? value : updated.weightKg;
      updated.shortExcessKg = parseFloat(((wt || 0) - updated.totalLayWeightKg).toFixed(3));
      return updated;
    }));
  }, []);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (rolls.length === 0) {
        message.warning('Add at least one roll');
        return;
      }
      setSaving(true);
      const payload = {
        planId: values.planId,
        markerId: values.markerId,
        layNo: values.layNo,
        layDate: values.layDate?.format('YYYY-MM-DD'),
        layLengthM: values.layLengthM,
        layHeightM: values.layHeightM,
        endToEndWidthM: values.endToEndWidthM,
        layStartTime: values.layStartTime?.toISOString(),
        layEndTime: values.layEndTime?.toISOString(),
        remarks: values.remarks,
        rolls: rolls.map((r) => ({
          id: r.id,
          rollNo: r.rollNo,
          weightKg: r.weightKg || 0,
          weightPerLayKg: r.weightPerLayKg || 0,
          numLays: r.numLays || 0,
          totalLayWeightKg: r.totalLayWeightKg || 0,
          shortExcessKg: r.shortExcessKg || 0,
        })),
        version: record?.version,
      };
      if (isEdit) {
        await updateLayAudit(id, payload);
        message.success('Lay audit updated');
      } else {
        await createLayAudit(payload);
        message.success('Lay audit created');
      }
      navigate('/cutting/lay-audit/list');
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, rolls, record, isEdit, id, navigate]);

  const isEditable = !isEdit || (record && LAY_AUDIT_EDITABLE.includes(record.status));

  const rollColumns = [
    {
      title: 'Roll No', dataIndex: 'rollNo', key: 'rollNo', width: 120,
      render: (val, _, index) => (
        <Input size="small" value={val} placeholder="Roll No"
          onChange={(e) => updateRollRow(index, 'rollNo', e.target.value)} disabled={!isEditable} />
      ),
    },
    {
      title: 'Weight (kg)', dataIndex: 'weightKg', key: 'weightKg', width: 120, align: 'right',
      render: (val, _, index) => (
        <InputNumber size="small" min={0} precision={3} value={val}
          onChange={(v) => updateRollRow(index, 'weightKg', v)} disabled={!isEditable} style={{ width: '100%' }} />
      ),
    },
    {
      title: 'Wt/Lay (kg)', dataIndex: 'weightPerLayKg', key: 'weightPerLayKg', width: 120, align: 'right',
      render: (val, _, index) => (
        <InputNumber size="small" min={0} precision={3} value={val}
          onChange={(v) => updateRollRow(index, 'weightPerLayKg', v)} disabled={!isEditable} style={{ width: '100%' }} />
      ),
    },
    {
      title: 'Num Lays', dataIndex: 'numLays', key: 'numLays', width: 100, align: 'right',
      render: (val, _, index) => (
        <InputNumber size="small" min={0} value={val}
          onChange={(v) => updateRollRow(index, 'numLays', v)} disabled={!isEditable} style={{ width: '100%' }} />
      ),
    },
    {
      title: 'Total Lay Wt', dataIndex: 'totalLayWeightKg', key: 'totalLayWeightKg', width: 120, align: 'right',
      render: (val) => <span>{(val || 0).toFixed(3)}</span>,
    },
    {
      title: 'Short/Excess', dataIndex: 'shortExcessKg', key: 'shortExcessKg', width: 120, align: 'right',
      render: (val) => <span style={{ color: val < 0 ? 'red' : 'inherit' }}>{(val || 0).toFixed(3)}</span>,
    },
    ...(isEditable ? [{
      title: '', key: 'action', width: 50,
      render: (_, __, index) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeRollRow(index)} />
      ),
    }] : []),
  ];

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <>
      <PageHeader
        title={isEdit ? `Edit Lay Audit: ${record?.auditNo || ''}` : 'New Lay Audit'}
        onBack={() => navigate('/cutting/lay-audit/list')}
        extra={isEditable && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            {isEdit ? 'Update' : 'Save'}
          </Button>
        )}
      />

      <Card title="Audit Details" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" disabled={!isEditable}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="planId" label="Cut Order Plan" rules={[{ required: true, message: 'Select a Plan' }]}>
                <Select
                  showSearch
                  filterOption={false}
                  onSearch={handlePlanSearch}
                  loading={planSearching}
                  options={planOptions}
                  placeholder="Search approved plans..."
                  disabled={isEdit}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="markerId" label="Marker">
                <Select
                  showSearch
                  filterOption={false}
                  onSearch={handleMarkerSearch}
                  loading={markerSearching}
                  options={markerOptions}
                  placeholder="Search approved markers..."
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="layNo" label="Lay No" rules={[{ required: true, message: 'Enter lay number' }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="Lay No" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="layDate" label="Lay Date" rules={[{ required: true, message: 'Select lay date' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="layLengthM" label="Lay Length (m)">
                <InputNumber min={0} precision={3} style={{ width: '100%' }} placeholder="0.000" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="layHeightM" label="Lay Height (m)">
                <InputNumber min={0} precision={3} style={{ width: '100%' }} placeholder="0.000" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="endToEndWidthM" label="End-to-End Width (m)">
                <InputNumber min={0} precision={3} style={{ width: '100%' }} placeholder="0.000" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="layStartTime" label="Start Time">
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="layEndTime" label="End Time">
                <DatePicker showTime style={{ width: '100%' }} />
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
        title="Rolls"
        extra={isEditable && (
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addRollRow}>Add Roll</Button>
        )}
      >
        <Table
          rowKey={(_, index) => index}
          columns={rollColumns}
          dataSource={rolls}
          pagination={false}
          size="small"
          scroll={{ x: 800 }}
        />
      </Card>
    </>
  );
};

export default LayAuditForm;
