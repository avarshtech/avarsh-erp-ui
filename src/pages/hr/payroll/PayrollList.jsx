import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Tag, Button, Select, Space, Row, Col } from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getAllPayrollRuns } from '../../../services/hr/payrollService';
import { PAYROLL_STATUS } from '../../../utils/hrConstants';
import { hasPermission } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';

const statusMap = Object.fromEntries(PAYROLL_STATUS.map((s) => [s.value, s]));

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const formatCurrency = (val) =>
  val != null ? `\u20B9${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';

const PayrollList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [statusFilter, setStatusFilter] = useState(undefined);

  const canAdd = hasPermission('hr-payroll', 'add');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllPayrollRuns();
      setData(Array.isArray(result) ? result : result?.content || []);
    } catch {
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredData = useMemo(() => {
    if (!statusFilter) return data;
    return data.filter((r) => r.status === statusFilter);
  }, [data, statusFilter]);

  const columns = useMemo(
    () => [
      {
        title: 'Month-Year',
        key: 'monthYear',
        width: 140,
        render: (_, r) => `${MONTH_NAMES[(r.month || 1) - 1]} ${r.year}`,
        sorter: (a, b) => (a.year * 100 + a.month) - (b.year * 100 + b.month),
        defaultSortOrder: 'descend',
      },
      {
        title: 'Factory',
        dataIndex: 'factoryName',
        key: 'factoryName',
        width: 160,
      },
      {
        title: 'Total Employees',
        dataIndex: 'totalEmployees',
        key: 'totalEmployees',
        width: 130,
        align: 'right',
      },
      {
        title: 'Total Gross',
        dataIndex: 'totalGross',
        key: 'totalGross',
        width: 150,
        align: 'right',
        render: formatCurrency,
      },
      {
        title: 'Total Net',
        dataIndex: 'totalNet',
        key: 'totalNet',
        width: 150,
        align: 'right',
        render: formatCurrency,
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (val) => {
          const s = statusMap[val];
          return s ? <Tag color={s.color}>{s.label}</Tag> : val;
        },
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 80,
        fixed: 'right',
        render: (_, r) => (
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={(e) => { e.stopPropagation(); navigate(`/hr/payroll/${r.id}`); }}
          >
            {['DRAFT', 'PROCESSED'].includes(r.status) ? 'Resume' : 'View'}
          </Button>
        ),
      },
    ],
    [navigate],
  );

  return (
    <>
      <PageHeader title="Payroll Runs" />
      <Row gutter={16} style={{ marginBottom: 16 }} align="middle">
        <Col>
          <Select
            placeholder="Filter by status"
            allowClear
            style={{ width: 180 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={PAYROLL_STATUS.map((s) => ({ value: s.value, label: s.label }))}
          />
        </Col>
        <Col flex="auto" />
        {canAdd && (
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/hr/payroll/new')}>
              New Payroll Run
            </Button>
          </Col>
        )}
      </Row>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={filteredData}
        columns={columns}
        scroll={{ x: 900 }}
        onRow={(record) => ({
          onClick: () => navigate(`/hr/payroll/${record.id}`),
          style: { cursor: 'pointer' },
        })}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `Total ${t} runs` }}
      />
    </>
  );
};

export default PayrollList;
