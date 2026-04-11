import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Form, Input, Select, Button, Card, Row, Col, Table, Skeleton, DatePicker, InputNumber,
} from 'antd';
import { SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import {
  createProcessReturn, getProcessReturnById, searchPanelIssues,
} from '../../../services/cuttingService';

const { TextArea } = Input;

const ProcessReturnForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewId = searchParams.get('view');
  const isViewMode = !!viewId;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState(null);
  const [items, setItems] = useState([]);

  const [issueOptions, setIssueOptions] = useState([]);
  const [issueSearching, setIssueSearching] = useState(false);

  useEffect(() => {
    if (isViewMode) {
      setLoading(true);
      getProcessReturnById(viewId)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            panelIssueId: data.panelIssueId,
            returnedBy: data.returnedBy,
            returnDate: data.returnDate ? dayjs(data.returnDate) : null,
            remarks: data.remarks,
          });
          setItems(data.items || []);
        })
        .catch(() => message.error('Failed to load process return'))
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

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, { panelName: '', size: '', issuedQty: 0, returnQty: 0, difference: 0, remarks: '' }]);
  }, []);

  const removeItem = useCallback((index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateItem = useCallback((index, field, value) => {
    setItems((prev) => prev.map((row, i) => {
      if (i !== index) return row;
      const updated = { ...row, [field]: value };
      updated.difference = (updated.issuedQty || 0) - (updated.returnQty || 0);
      return updated;
    }));
  }, []);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (items.length === 0) {
        message.warning('Add at least one return item');
        return;
      }
      setSaving(true);
      const payload = {
        panelIssueId: values.panelIssueId,
        returnedBy: values.returnedBy,
        returnDate: values.returnDate?.format('YYYY-MM-DD'),
        remarks: values.remarks,
        items: items.map((i) => ({
          panelName: i.panelName,
          size: i.size,
          issuedQty: i.issuedQty || 0,
          returnQty: i.returnQty || 0,
          remarks: i.remarks,
        })),
      };
      await createProcessReturn(payload);
      message.success('Process return created');
      navigate('/cutting/process-return/list');
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, items, navigate]);

  const itemColumns = useMemo(() => [
    {
      title: 'Panel Name', dataIndex: 'panelName', key: 'panelName', width: 130,
      render: (val, _, index) => isViewMode ? val : (
        <Input size="small" value={val} placeholder="Panel"
          onChange={(e) => updateItem(index, 'panelName', e.target.value)} />
      ),
    },
    {
      title: 'Size', dataIndex: 'size', key: 'size', width: 80,
      render: (val, _, index) => isViewMode ? val : (
        <Input size="small" value={val} placeholder="Size"
          onChange={(e) => updateItem(index, 'size', e.target.value)} />
      ),
    },
    {
      title: 'Issued Qty', dataIndex: 'issuedQty', key: 'issuedQty', width: 100, align: 'right',
      render: (val) => <span style={{ color: '#888' }}>{val}</span>,
    },
    {
      title: 'Return Qty', dataIndex: 'returnQty', key: 'returnQty', width: 100, align: 'right',
      render: (val, _, index) => isViewMode ? val : (
        <InputNumber size="small" min={0} value={val}
          onChange={(v) => updateItem(index, 'returnQty', v)} style={{ width: '100%' }} />
      ),
    },
    {
      title: 'Difference', dataIndex: 'difference', key: 'difference', width: 100, align: 'right',
      render: (val) => <span style={{ color: val > 0 ? '#ff4d4f' : '#52c41a', fontWeight: 500 }}>{val}</span>,
    },
    {
      title: 'Remarks', dataIndex: 'remarks', key: 'remarks', width: 150,
      render: (val, _, index) => isViewMode ? val : (
        <Input size="small" value={val} placeholder="Remarks"
          onChange={(e) => updateItem(index, 'remarks', e.target.value)} />
      ),
    },
    ...(!isViewMode ? [{
      title: '', key: 'action', width: 50,
      render: (_, __, index) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeItem(index)} />
      ),
    }] : []),
  ], [isViewMode, updateItem, removeItem]);

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <>
      <PageHeader
        title={isViewMode ? `Process Return: ${record?.returnNo || ''}` : 'New Process Return'}
        onBack={() => navigate('/cutting/process-return/list')}
        extra={!isViewMode && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            Save
          </Button>
        )}
      />

      <Card title="Return Details" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" disabled={isViewMode}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="panelIssueId" label="Panel Issue" rules={[{ required: true, message: 'Select a panel issue' }]}>
                <Select
                  showSearch filterOption={false}
                  onSearch={handleIssueSearch}
                  loading={issueSearching}
                  options={issueOptions}
                  placeholder="Search panel issues..."
                  disabled={isViewMode}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="returnedBy" label="Returned By">
                <Input placeholder="Name" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="returnDate" label="Return Date" initialValue={dayjs()}>
                <DatePicker style={{ width: '100%' }} />
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
        title="Return Items"
        extra={!isViewMode && (
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addItem}>Add Item</Button>
        )}
      >
        <Table
          rowKey={(_, index) => index}
          columns={itemColumns}
          dataSource={items}
          pagination={false}
          size="small"
          scroll={{ x: 750 }}
        />
      </Card>
    </>
  );
};

export default ProcessReturnForm;
