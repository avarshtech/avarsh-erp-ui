import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Tag, Button, Select, Space, Row, Col, Modal, Form, InputNumber } from 'antd';
import { PlusOutlined, CheckOutlined } from '@ant-design/icons';
import { getAllElEncashmentRuns, processElEncashment, approveElEncashment } from '../../../services/statutoryService';
import { getActiveFactories } from '../../../services/factoryService';
import { EL_ENCASHMENT_STATUS, EMPLOYEE_CATEGORY } from '../../../utils/hrConstants';
import { hasPermission } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';

const statusMap = Object.fromEntries(EL_ENCASHMENT_STATUS.map((s) => [s.value, s]));

const formatCurrency = (val) =>
  val != null ? `\u20B9${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';

const ElEncashmentList = () => {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [processOpen, setProcessOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [factories, setFactories] = useState([]);
  const [form] = Form.useForm();

  const canAdd = hasPermission('hr-statutory', 'add');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllElEncashmentRuns();
      setData(Array.isArray(result) ? result : result?.content || []);
    } catch {
      message.error('Failed to load EL encashment runs');
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

  const handleProcess = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setProcessing(true);
      await processElEncashment({
        factoryId: values.factoryId,
        year: values.year,
        category: values.category,
      });
      message.success('EL encashment processed successfully');
      setProcessOpen(false);
      form.resetFields();
      fetchData();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Failed to process EL encashment');
    } finally {
      setProcessing(false);
    }
  }, [form, message, fetchData]);

  const handleApprove = useCallback(
    (id) => {
      modal.confirm({
        title: 'Approve EL Encashment',
        content: 'Are you sure you want to approve this EL encashment run?',
        onOk: async () => {
          try {
            await approveElEncashment(id);
            message.success('EL encashment approved');
            fetchData();
          } catch (err) {
            message.error(err?.response?.data?.message || 'Failed to approve EL encashment');
          }
        },
      });
    },
    [modal, message, fetchData],
  );

  const columns = useMemo(
    () => [
      {
        title: 'Year',
        dataIndex: 'year',
        key: 'year',
        width: 100,
        sorter: (a, b) => (a.year || 0) - (b.year || 0),
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
        title: 'Category',
        dataIndex: 'category',
        key: 'category',
        width: 120,
      },
      {
        title: 'Employees',
        dataIndex: 'employeeCount',
        key: 'employeeCount',
        width: 100,
        align: 'right',
      },
      {
        title: 'Total Amount',
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
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleApprove(r.id)}>
                Approve
              </Button>
            )}
          </Space>
        ),
      },
    ],
    [handleApprove],
  );

  return (
    <>
      <PageHeader title="EL Encashment" />
      <Row gutter={16} style={{ marginBottom: 16 }} align="middle">
        <Col flex="auto">
          <Select
            placeholder="Filter by status"
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            options={EL_ENCASHMENT_STATUS}
            style={{ width: 180 }}
          />
        </Col>
        <Col>
          {canAdd && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setProcessOpen(true)}>
              Process EL Encashment
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
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `Total ${t} runs` }}
      />

      <Modal
        title="Process EL Encashment"
        open={processOpen}
        onOk={handleProcess}
        onCancel={() => setProcessOpen(false)}
        confirmLoading={processing}
        afterClose={() => form.resetFields()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="factoryId" label="Factory" rules={[{ required: true, message: 'Please select a factory' }]}>
            <Select
              placeholder="Select factory"
              options={factories.map((f) => ({ value: f.id, label: f.name }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="year" label="Year" rules={[{ required: true, message: 'Required' }]}>
                <InputNumber min={2020} max={2100} style={{ width: '100%' }} placeholder="e.g. 2026" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Required' }]}>
                <Select placeholder="Select category" options={EMPLOYEE_CATEGORY} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
};

export default ElEncashmentList;
