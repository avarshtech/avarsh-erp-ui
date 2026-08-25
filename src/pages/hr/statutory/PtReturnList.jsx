import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Table, Tag, Button, Select, Space, Row, Col, Modal, Form, DatePicker } from 'antd';
import { PlusOutlined, CheckOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getAllPtReturns, generatePtReturn, filePtReturn } from '../../../services/hr/statutoryService';
import { getActiveFactories } from '../../../services/master/factoryService';
import { PT_RETURN_STATUS } from '../../../utils/hrConstants';
import { hasPermission } from '../../../utils/permissions';
import { factoryOptions } from '../../../utils/hrLabels';
import PageHeader from '../../../components/PageHeader';

const statusMap = Object.fromEntries(PT_RETURN_STATUS.map((s) => [s.value, s]));

const formatCurrency = (val) =>
  val != null ? `\u20B9${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';

const PtReturnList = () => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [factories, setFactories] = useState([]);
  const [form] = Form.useForm();

  const canAdd = hasPermission('hr-statutory', 'add');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllPtReturns();
      setData(Array.isArray(result) ? result : result?.content || []);
    } catch {
      message.error('Failed to load PT returns');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    fetchData();
    getActiveFactories().then(setFactories).catch(() => {});
  }, [fetchData]);

  const filteredData = useMemo(() => {
    if (!statusFilter) return data;
    return data.filter((r) => r.status === statusFilter);
  }, [data, statusFilter]);

  const handleGenerate = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setGenerating(true);
      await generatePtReturn({
        factoryId: values.factoryId,
        periodFrom: values.periodFrom.format('YYYY-MM-DD'),
        periodTo: values.periodTo.format('YYYY-MM-DD'),
      });
      message.success('PT return generated successfully');
      setGenerateOpen(false);
      form.resetFields();
      fetchData();
    } catch (err) {
      if (err?.errorFields) return; // form validation
      message.error(err?.response?.data?.message || 'Failed to generate PT return');
    } finally {
      setGenerating(false);
    }
  }, [form, message, fetchData]);

  const handleMarkFiled = useCallback(
    (id) => {
      modal.confirm({
        title: 'Mark as Filed',
        content: 'Are you sure you want to mark this PT return as filed?',
        onOk: async () => {
          try {
            await filePtReturn(id);
            message.success('PT return marked as filed');
            fetchData();
          } catch (err) {
            message.error(err?.response?.data?.message || 'Failed to file PT return');
          }
        },
      });
    },
    [modal, message, fetchData],
  );

  const columns = useMemo(
    () => [
      {
        title: 'Period',
        key: 'period',
        width: 200,
        render: (_, r) =>
          r.periodFrom && r.periodTo
            ? `${dayjs(r.periodFrom).format('DD MMM YYYY')} - ${dayjs(r.periodTo).format('DD MMM YYYY')}`
            : '-',
        sorter: (a, b) => (a.periodFrom || '').localeCompare(b.periodFrom || ''),
        defaultSortOrder: 'descend',
      },
      {
        title: 'Factory',
        dataIndex: 'factoryName',
        key: 'factoryName',
        width: 160,
        ellipsis: true,
      },
      {
        title: 'Employees',
        dataIndex: 'employeeCount',
        key: 'employeeCount',
        width: 100,
        align: 'right',
      },
      {
        title: 'Total PT Amount',
        dataIndex: 'totalAmount',
        key: 'totalAmount',
        width: 150,
        align: 'right',
        render: formatCurrency,
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (status) => {
          const s = statusMap[status];
          return s ? <Tag color={s.color}>{s.label}</Tag> : status;
        },
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 120,
        fixed: 'right',
        render: (_, r) => (
          <Space>
            {r.status === 'CALCULATED' && (
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={(e) => { e.stopPropagation(); handleMarkFiled(r.id); }}>
                Mark Filed
              </Button>
            )}
          </Space>
        ),
      },
    ],
    [handleMarkFiled],
  );

  return (
    <>
      <PageHeader title="Professional Tax Returns" />
      <Row gutter={16} style={{ marginBottom: 16 }} align="middle">
        <Col flex="auto">
          <Select
            placeholder="Filter by status"
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            options={PT_RETURN_STATUS}
            style={{ width: 180 }}
          />
        </Col>
        <Col>
          {canAdd && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setGenerateOpen(true)}>
              Generate Return
            </Button>
          )}
        </Col>
      </Row>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredData}
        loading={loading}
        scroll={{ x: 850 }}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `Total ${t} returns` }}
        onRow={(r) => ({ onClick: () => navigate(`/hr/statutory/pt/${r.id}`), style: { cursor: 'pointer' } })}
      />

      <Modal
        title="Generate PT Return"
        open={generateOpen}
        onOk={handleGenerate}
        onCancel={() => setGenerateOpen(false)}
        confirmLoading={generating}
        afterClose={() => form.resetFields()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="factoryId" label="Factory" rules={[{ required: true, message: 'Please select a factory' }]}>
            <Select
              placeholder="Select factory"
              options={factoryOptions(factories)}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="periodFrom" label="Period From" rules={[{ required: true, message: 'Required' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="periodTo" label="Period To" rules={[{ required: true, message: 'Required' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
};

export default PtReturnList;
