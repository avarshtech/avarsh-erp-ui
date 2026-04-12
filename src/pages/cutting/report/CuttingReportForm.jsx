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
  createCuttingReport, updateCuttingReport, getCuttingReportById,
  searchCutOrderPlans,
} from '../../../services/cuttingService';
import { CUT_REPORT_STATUS } from '../../../utils/cuttingConstants';

const CUT_REPORT_EDITABLE = [CUT_REPORT_STATUS.DRAFT, CUT_REPORT_STATUS.IN_PROGRESS];

const CuttingReportForm = () => {
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
  const [lays, setLays] = useState([]);
  const [sizes, setSizes] = useState([]);

  // Watch consumption / width / realize for auto-calc
  const consumption = Form.useWatch('consumption', form);
  const widthCm = Form.useWatch('widthCm', form);
  const realizePct = Form.useWatch('realizePct', form);

  // Auto-calculate fabric_required
  useEffect(() => {
    if (consumption && widthCm && realizePct) {
      const totalPlanQty = lays.reduce((sum, l) => sum + (l.total || 0), 0);
      const required = (consumption * totalPlanQty) / ((widthCm / 100) * (realizePct / 100));
      form.setFieldsValue({ fabricRequiredKg: parseFloat(required.toFixed(3)) });
    }
  }, [consumption, widthCm, realizePct, lays, form]);

  // Load record in edit mode
  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      getCuttingReportById(id)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            planId: data.planId,
            consumption: data.consumption,
            widthCm: data.widthCm,
            realizePct: data.realizePct,
            fabricRequiredKg: data.fabricRequiredKg,
            fabricReceivedKg: data.fabricReceivedKg,
            remarks: data.remarks,
          });
          setLays(data.lays || []);
          setSizes(data.sizes || []);
          if (data.planId) {
            setPlanOptions([{ value: data.planId, label: data.planNo || `Plan-${data.planId}` }]);
          }
        })
        .catch(() => message.error('Failed to load cutting report'))
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

  // When plan selected, populate sizes from plan
  const handlePlanSelect = useCallback((value, option) => {
    const plan = option?.plan;
    if (!plan) return;
    const planSizes = (plan.sizes || []).map((s) => s.size);
    setSizes(planSizes);
  }, []);

  // Lay management
  const addLayRow = useCallback(() => {
    setLays((prev) => [...prev, {
      layNo: prev.length + 1,
      cutDate: dayjs().format('YYYY-MM-DD'),
      sizeQtyJson: {},
      total: 0,
    }]);
  }, []);

  const removeLayRow = useCallback((index) => {
    setLays((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateLayRow = useCallback((index, field, value) => {
    setLays((prev) => prev.map((row, i) => {
      if (i !== index) return row;
      const updated = { ...row, [field]: value };
      // Recalculate total from sizeQtyJson
      if (field === 'sizeQtyJson' || field.startsWith('size_')) {
        const sizeQty = { ...(updated.sizeQtyJson || {}) };
        if (field.startsWith('size_')) {
          const sizeName = field.replace('size_', '');
          sizeQty[sizeName] = value || 0;
          updated.sizeQtyJson = sizeQty;
        }
        updated.total = Object.values(updated.sizeQtyJson).reduce((s, v) => s + (v || 0), 0);
      }
      return updated;
    }));
  }, []);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        planId: values.planId,
        consumption: values.consumption,
        widthCm: values.widthCm,
        realizePct: values.realizePct,
        fabricRequiredKg: values.fabricRequiredKg,
        fabricReceivedKg: values.fabricReceivedKg,
        remarks: values.remarks,
        lays: lays.map((l) => ({
          id: l.id,
          layNo: l.layNo,
          cutDate: l.cutDate,
          sizeQtyJson: l.sizeQtyJson || {},
          total: l.total || 0,
        })),
        version: record?.version,
      };
      if (isEdit) {
        await updateCuttingReport(id, payload);
        message.success('Cutting report updated');
      } else {
        await createCuttingReport(payload);
        message.success('Cutting report created');
      }
      navigate('/cutting/report/list');
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, lays, record, isEdit, id, navigate]);

  const isEditable = !isEdit || (record && CUT_REPORT_EDITABLE.includes(record.status));

  const fabricReceivedKg = Form.useWatch('fabricReceivedKg', form);
  const fabricRequiredKg = Form.useWatch('fabricRequiredKg', form);
  const balance = ((fabricReceivedKg || 0) - (fabricRequiredKg || 0)).toFixed(3);

  // Build dynamic lay columns with size columns
  const layColumns = [
    {
      title: 'Lay No', dataIndex: 'layNo', key: 'layNo', width: 80, align: 'right',
      render: (val, _, index) => (
        <InputNumber size="small" min={1} value={val}
          onChange={(v) => updateLayRow(index, 'layNo', v)} disabled={!isEditable} style={{ width: '100%' }} />
      ),
    },
    {
      title: 'Cut Date', dataIndex: 'cutDate', key: 'cutDate', width: 140,
      render: (val, _, index) => (
        <DatePicker size="small" value={val ? dayjs(val) : null}
          onChange={(d) => updateLayRow(index, 'cutDate', d?.format('YYYY-MM-DD'))} disabled={!isEditable} style={{ width: '100%' }} />
      ),
    },
    ...sizes.map((sizeName) => ({
      title: sizeName, key: `size_${sizeName}`, width: 80, align: 'right',
      render: (_, row, index) => (
        <InputNumber size="small" min={0} value={row.sizeQtyJson?.[sizeName] || 0}
          onChange={(v) => updateLayRow(index, `size_${sizeName}`, v)} disabled={!isEditable} style={{ width: '100%' }} />
      ),
    })),
    {
      title: 'Total', dataIndex: 'total', key: 'total', width: 80, align: 'right',
      render: (val) => <strong>{val || 0}</strong>,
    },
    ...(isEditable ? [{
      title: '', key: 'action', width: 50,
      render: (_, __, index) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeLayRow(index)} />
      ),
    }] : []),
  ];

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <>
      <PageHeader
        title={isEdit ? `Edit Cutting Report: ${record?.reportNo || ''}` : 'New Cutting Report'}
        onBack={() => navigate('/cutting/report/list')}
        extra={isEditable && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            {isEdit ? 'Update' : 'Save'}
          </Button>
        )}
      />

      <Card title="Report Details" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" disabled={!isEditable}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="planId" label="Cut Order Plan" rules={[{ required: true, message: 'Select a Plan' }]}>
                <Select
                  showSearch
                  filterOption={false}
                  onSearch={handlePlanSearch}
                  onSelect={handlePlanSelect}
                  loading={planSearching}
                  options={planOptions}
                  placeholder="Search approved plans..."
                  disabled={isEdit}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="consumption" label="Consumption (per pc)">
                <InputNumber min={0} precision={4} style={{ width: '100%' }} placeholder="0.0000" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="widthCm" label="Width (cm)">
                <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="0.00" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="realizePct" label="Realize %">
                <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="fabricRequiredKg" label="Fabric Required (kg)">
                <InputNumber disabled style={{ width: '100%' }} precision={3} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="fabricReceivedKg" label="Fabric Received (kg)">
                <InputNumber disabled style={{ width: '100%' }} precision={3} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item label="Balance (kg)">
                <InputNumber value={balance} disabled style={{ width: '100%' }} precision={3} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={16}>
              <Form.Item name="remarks" label="Remarks">
                <Input.TextArea rows={2} placeholder="Remarks" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card
        title="Lays"
        extra={isEditable && (
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addLayRow}>Add Lay</Button>
        )}
      >
        <Table
          rowKey={(_, index) => index}
          columns={layColumns}
          dataSource={lays}
          pagination={false}
          size="small"
          scroll={{ x: 600 + sizes.length * 80 }}
          summary={() => {
            const grandTotal = lays.reduce((sum, l) => sum + (l.total || 0), 0);
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={2}><strong>Grand Total</strong></Table.Summary.Cell>
                {sizes.map((_, si) => (
                  <Table.Summary.Cell key={si} index={si + 2} align="right">
                    <strong>
                      {lays.reduce((sum, l) => sum + (l.sizeQtyJson?.[sizes[si]] || 0), 0)}
                    </strong>
                  </Table.Summary.Cell>
                ))}
                <Table.Summary.Cell index={sizes.length + 2} align="right"><strong>{grandTotal}</strong></Table.Summary.Cell>
                {isEditable && <Table.Summary.Cell index={sizes.length + 3} />}
              </Table.Summary.Row>
            );
          }}
        />
      </Card>
    </>
  );
};

export default CuttingReportForm;
