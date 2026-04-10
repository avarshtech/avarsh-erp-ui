import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Tag, Button, Select, Space, Row, Col, Popconfirm } from 'antd';
import { PlusOutlined, EyeOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getAllLoans, closeLoan, cancelLoan } from '../../../services/loanService';
import { LOAN_STATUS } from '../../../utils/hrConstants';
import { hasPermission } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';
import LoanDrawer from './LoanDrawer';

const statusMap = Object.fromEntries(LOAN_STATUS.map((s) => [s.value, s]));

const formatCurrency = (val) =>
  val != null ? `\u20B9${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';

const LoanList = () => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const canAdd = hasPermission('hr-loans', 'add');
  const canUpdate = hasPermission('hr-loans', 'update');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllLoans();
      setData(Array.isArray(result) ? result : result?.content || []);
    } catch {
      message.error('Failed to load loans');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleClose = useCallback(async (id) => {
    try {
      await closeLoan(id);
      message.success('Loan closed successfully');
      fetchData();
    } catch {
      message.error('Failed to close loan');
    }
  }, [message, fetchData]);

  const handleCancel = useCallback(async (id) => {
    try {
      await cancelLoan(id);
      message.success('Loan cancelled');
      fetchData();
    } catch {
      message.error('Failed to cancel loan');
    }
  }, [message, fetchData]);

  const filteredData = useMemo(() => {
    if (!statusFilter) return data;
    return data.filter((r) => r.status === statusFilter);
  }, [data, statusFilter]);

  const columns = useMemo(
    () => [
      { title: 'Emp No', dataIndex: 'employeeNo', key: 'employeeNo', width: 100 },
      { title: 'Name', dataIndex: 'employeeName', key: 'employeeName', width: 180 },
      {
        title: 'Loan Date',
        dataIndex: 'loanDate',
        key: 'loanDate',
        width: 110,
        render: (val) => val ? dayjs(val).format('DD-MMM-YYYY') : '-',
        sorter: (a, b) => dayjs(a.loanDate).unix() - dayjs(b.loanDate).unix(),
      },
      { title: 'Amount', dataIndex: 'amount', key: 'amount', width: 120, align: 'right', render: formatCurrency },
      { title: 'EMI', dataIndex: 'emiAmount', key: 'emiAmount', width: 100, align: 'right', render: formatCurrency },
      { title: 'Installments', dataIndex: 'totalInstallments', key: 'totalInstallments', width: 110, align: 'right' },
      { title: 'Balance', dataIndex: 'balance', key: 'balance', width: 120, align: 'right', render: formatCurrency },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 130,
        render: (val) => {
          const s = statusMap[val];
          return s ? <Tag color={s.color}>{s.label}</Tag> : val;
        },
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 140,
        fixed: 'right',
        render: (_, r) => (
          <Space size="small">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/hr/loans/${r.id}`)} />
            {r.status === 'ACTIVE' && canUpdate && (
              <>
                <Popconfirm title="Close this loan?" onConfirm={() => handleClose(r.id)}>
                  <Button type="link" size="small" icon={<CheckCircleOutlined />} />
                </Popconfirm>
                <Popconfirm title="Cancel this loan?" onConfirm={() => handleCancel(r.id)}>
                  <Button type="link" size="small" danger icon={<StopOutlined />} />
                </Popconfirm>
              </>
            )}
          </Space>
        ),
      },
    ],
    [navigate, canUpdate, handleClose, handleCancel],
  );

  return (
    <>
      <PageHeader title="Loans & Advances" />
      <Row gutter={16} style={{ marginBottom: 16 }} align="middle">
        <Col>
          <Select
            placeholder="Filter by status"
            allowClear
            style={{ width: 180 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={LOAN_STATUS.map((s) => ({ value: s.value, label: s.label }))}
          />
        </Col>
        <Col flex="auto" />
        {canAdd && (
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
              New Loan
            </Button>
          </Col>
        )}
      </Row>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={filteredData}
        columns={columns}
        scroll={{ x: 1100 }}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `Total ${t} loans` }}
      />
      <LoanDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={() => { setDrawerOpen(false); fetchData(); }}
      />
    </>
  );
};

export default LoanList;
