import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Descriptions, Table, Tag, Card, Spin } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getLoanById } from '../../../services/loanService';
import { LOAN_STATUS } from '../../../utils/hrConstants';
import PageHeader from '../../../components/PageHeader';

const statusMap = Object.fromEntries(LOAN_STATUS.map((s) => [s.value, s]));

const formatCurrency = (val) =>
  val != null ? `\u20B9${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';

const LoanView = () => {
  const { message } = App.useApp();
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loan, setLoan] = useState(null);

  const fetchLoan = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getLoanById(id);
      setLoan(result);
    } catch {
      message.error('Failed to load loan details');
    } finally {
      setLoading(false);
    }
  }, [id, message]);

  useEffect(() => {
    fetchLoan();
  }, [fetchLoan]);

  const statusInfo = statusMap[loan?.status];

  const recoveryColumns = useMemo(
    () => [
      { title: '#', dataIndex: 'installmentNo', key: 'installmentNo', width: 60, render: (_, __, idx) => idx + 1 },
      {
        title: 'Date',
        dataIndex: 'recoveryDate',
        key: 'recoveryDate',
        width: 120,
        render: (val) => val ? dayjs(val).format('DD-MMM-YYYY') : '-',
      },
      { title: 'Amount', dataIndex: 'amount', key: 'amount', width: 120, align: 'right', render: formatCurrency },
      { title: 'Balance After', dataIndex: 'balanceAfter', key: 'balanceAfter', width: 130, align: 'right', render: formatCurrency },
      { title: 'Remarks', dataIndex: 'remarks', key: 'remarks' },
    ],
    [],
  );

  if (loading) return <Spin style={{ display: 'block', margin: '100px auto' }} />;
  if (!loan) return null;

  return (
    <>
      <PageHeader
        title="Loan Details"
        onBack={() => navigate('/hr/loans')}
        extra={statusInfo && <Tag color={statusInfo.color}>{statusInfo.label}</Tag>}
      />
      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} bordered size="small">
          <Descriptions.Item label="Employee">{loan.employeeName || '-'}</Descriptions.Item>
          <Descriptions.Item label="Employee No">{loan.employeeNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="Loan Date">{loan.loanDate ? dayjs(loan.loanDate).format('DD-MMM-YYYY') : '-'}</Descriptions.Item>
          <Descriptions.Item label="Amount">{formatCurrency(loan.amount)}</Descriptions.Item>
          <Descriptions.Item label="EMI">{formatCurrency(loan.emiAmount)}</Descriptions.Item>
          <Descriptions.Item label="Total Installments">{loan.totalInstallments ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="EMI Start Date">{loan.dueStartDate ? dayjs(loan.dueStartDate).format('DD-MMM-YYYY') : '-'}</Descriptions.Item>
          <Descriptions.Item label="Balance">{formatCurrency(loan.balance)}</Descriptions.Item>
          <Descriptions.Item label="Purpose">{loan.purpose || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Repayment Schedule">
        <Table
          rowKey={(r, idx) => r.id || idx}
          dataSource={loan.recoveries || []}
          columns={recoveryColumns}
          pagination={false}
          size="small"
          locale={{ emptyText: 'No recoveries recorded yet' }}
        />
      </Card>
    </>
  );
};

export default LoanView;
