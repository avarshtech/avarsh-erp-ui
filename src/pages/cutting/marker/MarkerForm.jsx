import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Form, Input, Select, InputNumber, Button, Card,
  Row, Col, Table, Skeleton,
} from 'antd';
import { SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import {
  createMarker, updateMarker, getMarkerById, searchMarkers,
} from '../../../services/cuttingService';
import { searchCutOrderPlans } from '../../../services/cuttingService';
import { MARKER_STATUS } from '../../../utils/cuttingConstants';

const { TextArea } = Input;

const MarkerForm = () => {
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
  const [sizes, setSizes] = useState([]);

  // Load record in edit mode
  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      getMarkerById(id)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            planId: data.planId,
            markerLengthM: data.markerLengthM,
            markerWidthCm: data.markerWidthCm,
            efficiencyPct: data.efficiencyPct,
            tableNo: data.tableNo,
            cadFileUrl: data.cadFileUrl,
            remarks: data.remarks,
          });
          setSizes(data.sizes || []);
          setPlanOptions([{ value: data.planId, label: `Plan #${data.planId} — ${data.styleNo || ''}` }]);
        })
        .catch(() => message.error('Failed to load marker'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, form]);

  // Search approved Cut Order Plans
  const handlePlanSearch = useCallback(async (search) => {
    if (!search || search.length < 2) return;
    setPlanSearching(true);
    try {
      const res = await searchCutOrderPlans({ search, status: 'APPROVED', page: 0, size: 20 });
      setPlanOptions((res.content || []).map((p) => ({
        value: p.id,
        label: `${p.planNo} — ${p.styleNo || ''} — ${p.buyerName || ''}`,
        plan: p,
      })));
    } catch { /* ignore */ }
    finally { setPlanSearching(false); }
  }, []);

  // When plan is selected, populate style info
  const handlePlanSelect = useCallback((value, option) => {
    const plan = option?.plan;
    if (!plan) return;
    // Pre-fill sizes from plan sizes if available
    if (plan.sizes && plan.sizes.length > 0) {
      setSizes(plan.sizes.map((s) => ({
        size: s.size,
        ratio: s.ratio || 1,
        piecesPerPly: 0,
        totalPieces: 0,
      })));
    }
  }, []);

  // Add a size row manually
  const addSizeRow = useCallback(() => {
    setSizes((prev) => [...prev, { size: '', ratio: 1, piecesPerPly: 0, totalPieces: 0 }]);
  }, []);

  // Remove a size row
  const removeSizeRow = useCallback((index) => {
    setSizes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Update a size row field
  const updateSizeRow = useCallback((index, field, value) => {
    setSizes((prev) => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }, []);

  // Calculate plies_required = max(ceil(totalPieces / piecesPerPly)) across sizes
  const pliesRequired = useMemo(() => {
    if (sizes.length === 0) return 0;
    return sizes.reduce((max, s) => {
      const ppp = s.piecesPerPly && s.piecesPerPly > 0 ? s.piecesPerPly : 1;
      const total = s.totalPieces || 0;
      const plies = Math.ceil(total / ppp);
      return Math.max(max, plies);
    }, 0);
  }, [sizes]);

  // Auto-calculate totalPieces = ratio * pliesRequired for display
  const computedSizes = useMemo(() => {
    return sizes.map((s) => ({
      ...s,
      computedTotal: (s.ratio || 1) * pliesRequired,
    }));
  }, [sizes, pliesRequired]);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (sizes.length === 0) {
        message.warning('Add at least one size');
        return;
      }
      setSaving(true);
      const payload = {
        planId: values.planId,
        markerLengthM: values.markerLengthM,
        markerWidthCm: values.markerWidthCm,
        efficiencyPct: values.efficiencyPct,
        tableNo: values.tableNo,
        cadFileUrl: values.cadFileUrl,
        remarks: values.remarks,
        sizes: sizes.map((s) => ({
          id: s.id,
          size: s.size,
          ratio: s.ratio || 1,
          piecesPerPly: s.piecesPerPly || 0,
          totalPieces: s.totalPieces || 0,
        })),
        version: record?.version,
      };
      if (isEdit) {
        await updateMarker(id, payload);
        message.success('Marker updated');
      } else {
        await createMarker(payload);
        message.success('Marker created');
      }
      navigate('/cutting/marker/list');
    } catch (err) {
      if (err?.errorFields) return; // form validation
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, sizes, record, isEdit, id, navigate]);

  const isEditable = !isEdit || (record && record.status === MARKER_STATUS.DRAFT);

  const sizeColumns = [
    {
      title: 'Size', dataIndex: 'size', key: 'size', width: 120,
      render: (val, _, index) => (
        <Input size="small" value={val} placeholder="e.g. S, M, L"
          onChange={(e) => updateSizeRow(index, 'size', e.target.value)} disabled={!isEditable} />
      ),
    },
    {
      title: 'Ratio', dataIndex: 'ratio', key: 'ratio', width: 100, align: 'right',
      render: (val, _, index) => (
        <InputNumber size="small" min={1} value={val}
          onChange={(v) => updateSizeRow(index, 'ratio', v)} disabled={!isEditable} style={{ width: '100%' }} />
      ),
    },
    {
      title: 'Pieces Per Ply', dataIndex: 'piecesPerPly', key: 'piecesPerPly', width: 130, align: 'right',
      render: (val, _, index) => (
        <InputNumber size="small" min={0} value={val}
          onChange={(v) => updateSizeRow(index, 'piecesPerPly', v)} disabled={!isEditable} style={{ width: '100%' }} />
      ),
    },
    {
      title: 'Total Pieces', dataIndex: 'totalPieces', key: 'totalPieces', width: 120, align: 'right',
      render: (_, row, index) => (
        <InputNumber size="small" min={0} value={computedSizes[index]?.computedTotal || row.totalPieces || 0}
          disabled style={{ width: '100%' }} />
      ),
    },
    ...(isEditable ? [{
      title: '', key: 'action', width: 50,
      render: (_, __, index) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeSizeRow(index)} />
      ),
    }] : []),
  ];

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <>
      <PageHeader
        title={isEdit ? `Edit Marker: ${record?.markerNo || ''}` : 'New Marker'}
        onBack={() => navigate('/cutting/marker/list')}
        extra={isEditable && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            {isEdit ? 'Update' : 'Save'}
          </Button>
        )}
      />

      <Card title="Marker Details" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" disabled={!isEditable}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="planId" label="Cut Order Plan" rules={[{ required: true, message: 'Select a Cut Order Plan' }]}>
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
              <Form.Item name="markerLengthM" label="Marker Length (m)" rules={[{ required: true, message: 'Required' }]}>
                <InputNumber min={0} precision={3} style={{ width: '100%' }} placeholder="0.000" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="markerWidthCm" label="Marker Width (cm)" rules={[{ required: true, message: 'Required' }]}>
                <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="0.00" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="efficiencyPct" label="Efficiency %">
                <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="tableNo" label="Table No">
                <Input placeholder="Table number" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="cadFileUrl" label="CAD File URL">
                <Input placeholder="URL to CAD file" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item label="Plies Required">
                <InputNumber value={pliesRequired} disabled style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={16}>
              <Form.Item name="remarks" label="Remarks">
                <TextArea rows={2} placeholder="Remarks" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card
        title="Size Breakdown"
        extra={isEditable && (
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addSizeRow}>Add Size</Button>
        )}
      >
        <Table
          rowKey={(_, index) => index}
          columns={sizeColumns}
          dataSource={sizes}
          pagination={false}
          size="small"
          scroll={{ x: 550 }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}><strong>Total</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <strong>{sizes.reduce((sum, s) => sum + (s.ratio || 0), 0)}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} />
              <Table.Summary.Cell index={3} align="right">
                <strong>{computedSizes.reduce((sum, s) => sum + (s.computedTotal || 0), 0)}</strong>
              </Table.Summary.Cell>
              {isEditable && <Table.Summary.Cell index={4} />}
            </Table.Summary.Row>
          )}
        />
      </Card>
    </>
  );
};

export default MarkerForm;
