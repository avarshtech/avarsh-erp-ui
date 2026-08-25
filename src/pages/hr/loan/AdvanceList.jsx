import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Tag, Button, Select, Space, Row, Col, Popconfirm, Alert, Drawer, Form, InputNumber, DatePicker } from 'antd';
import { PlusOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getAllAdvances, createAdvance, recoverAdvance, waiveAdvance } from '../../../services/hr/advanceService';
import { searchEmployees } from '../../../services/hr/employeeService';
import { ADVANCE_STATUS } from '../../../utils/hrConstants';
import { hasPermission } from '../../../utils/permissions';
import { employeeOptions, recordEmployeeLabel } from '../../../utils/hrLabels';
import PageHeader from '../../../components/PageHeader';

const statusMap = Object.fromEntries(ADVANCE_STATUS.map((s) => [s.value, s]));

const formatCurrency = (val) =>
  val != null ? `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';

const monthName = (m) => (m >= 1 && m <= 12 ? dayjs().month(m - 1).format('MMM') : '-');

/**
 * Salary advance register.
 *
 * The API for advances shipped with the module but nothing ever called it, so
 * advanceRecovery appeared as a deduction on payslips while the advance behind
 * it could not be seen or created anywhere in the application.
 *
 * Recovery is normally automatic: approving a payroll run deducts every advance
 * whose recovery month matches that run and marks it RECOVERED. The actions
 * here are for the exceptions - an advance repaid in cash, or written off.
 */
const AdvanceList = () => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [form] = Form.useForm();

  const canAdd = hasPermission('hr-loans', 'add');
  const canUpdate = hasPermission('hr-loans', 'update');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllAdvances(statusFilter);
      setData(Array.isArray(result) ? result : result?.content || []);
    } catch {
      setData([]);
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!drawerOpen) return;
    searchEmployees({ status: 'ACTIVE', size: 200 })
      .then((r) => setEmployees(Array.isArray(r) ? r : r?.content || []))
      .catch((err) => message.error(err?.response?.data?.message || 'Could not load employees'));
  }, [drawerOpen, message]);

  const act = useCallback(async (fn, id, done) => {
    try {
      await fn(id);
      message.success(done);
      fetchData();
    } catch (err) {
      message.error(err?.response?.data?.message || `Could not ${done.toLowerCase()}`);
    }
  }, [message, fetchData]);

  const handleCreate = useCallback(async () => {
    try {
      const v = await form.validateFields();
      setSaving(true);
      await createAdvance({
        employeeId: v.employeeId,
        advanceDate: v.advanceDate.format('YYYY-MM-DD'),
        amount: v.amount,
        recoveryMonth: v.recoveryPeriod.month() + 1,
        recoveryYear: v.recoveryPeriod.year(),
      });
      message.success('Advance recorded');
      setDrawerOpen(false);
      form.resetFields();
      fetchData();
    } catch (err) {
      if (err?.errorFields) return;
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setSaving(false);
    }
  }, [form, message, fetchData]);

  const columns = useMemo(() => [
    {
      title: 'Employee',
      key: 'employee',
      width: 220,
      ellipsis: true,
      render: (_, r) => recordEmployeeLabel(r) || '-',
    },
    {
      title: 'Advance Date', dataIndex: 'advanceDate', key: 'advanceDate', width: 130,
      render: (v) => (v ? dayjs(v).format('DD-MMM-YYYY') : '-'),
    },
    {
      title: 'Amount', dataIndex: 'amount', key: 'amount',
      width: 130, align: 'right', render: formatCurrency,
    },
    {
      title: 'Recovered', dataIndex: 'recoveredAmount', key: 'recoveredAmount',
      width: 130, align: 'right', render: formatCurrency,
    },
    {
      title: 'Recover In', key: 'recoverIn', width: 120,
      render: (_, r) => (r.recoveryMonth ? `${monthName(r.recoveryMonth)} ${r.recoveryYear}` : '-'),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 120,
      render: (v) => {
        const s = statusMap[v];
        return s ? <Tag color={s.color}>{s.label}</Tag> : v;
      },
    },
    {
      title: 'Actions', key: 'actions', width: 190, fixed: 'right',
      render: (_, r) => (r.status === 'PENDING' && canUpdate ? (
        <Space size="small">
          <Popconfirm
            title="Mark as recovered?"
            description="Only for an advance repaid outside payroll. Payroll records its own recoveries."
            onConfirm={() => act(recoverAdvance, r.id, 'Marked as recovered')}
          >
            <Button type="link" size="small" icon={<CheckCircleOutlined />}>Recovered</Button>
          </Popconfirm>
          <Popconfirm
            title="Waive this advance?"
            description="Writes it off. It will no longer be deducted from salary."
            onConfirm={() => act(waiveAdvance, r.id, 'Advance waived')}
          >
            <Button type="link" size="small" danger icon={<StopOutlined />}>Waive</Button>
          </Popconfirm>
        </Space>
      ) : null),
    },
  ], [canUpdate, act]);

  const pendingTotal = useMemo(
    () => data.filter((a) => a.status === 'PENDING')
      .reduce((sum, a) => sum + (Number(a.amount) || 0) - (Number(a.recoveredAmount) || 0), 0),
    [data],
  );

  return (
    <>
      <PageHeader
        title="Salary Advances"
        extra={canAdd && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
            New Advance
          </Button>
        )}
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Advances are recovered by payroll"
        description="An advance is deducted automatically when the payroll run for its recovery month is approved. Use the actions here only for an advance repaid in cash or written off."
      />

      <Row gutter={16} style={{ marginBottom: 16 }} align="middle">
        <Col flex="auto">
          <Select
            placeholder="Filter by status"
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            options={ADVANCE_STATUS}
            style={{ width: 200 }}
          />
        </Col>
        <Col>
          <strong>Outstanding: {formatCurrency(pendingTotal)}</strong>
        </Col>
      </Row>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 1000 }}
        pagination={{ pageSize: 25, showSizeChanger: true, showTotal: (t) => `Total ${t} advances` }}
        locale={{ emptyText: 'No advances recorded' }}
      />

      <Drawer
        title="New Salary Advance"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={420}
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleCreate} loading={saving}>Save</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ advanceDate: dayjs(), recoveryPeriod: dayjs().add(1, 'month') }}>
          <Form.Item name="employeeId" label="Employee" rules={[{ required: true, message: 'Select an employee' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select employee"
              options={employeeOptions(employees)}
            />
          </Form.Item>
          <Form.Item name="advanceDate" label="Advance Date" rules={[{ required: true, message: 'Required' }]}>
            <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
          </Form.Item>
          <Form.Item
            name="amount"
            label="Amount"
            rules={[
              { required: true, message: 'Required' },
              {
                validator: (_, v) => (v == null || v > 0
                  ? Promise.resolve()
                  : Promise.reject(new Error('Must be greater than zero'))),
              },
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix={'₹'} />
          </Form.Item>
          <Form.Item
            name="recoveryPeriod"
            label="Recover In"
            extra="The payroll run for this month will deduct the advance."
            rules={[{ required: true, message: 'Required' }]}
          >
            <DatePicker picker="month" style={{ width: '100%' }} format="MMM YYYY" />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
};

export default AdvanceList;
