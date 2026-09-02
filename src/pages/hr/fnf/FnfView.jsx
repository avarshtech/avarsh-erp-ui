import { useState, useEffect, useCallback } from 'react';
import { App, Card, Descriptions, Tag, Button, Spin, Row, Col, Divider, Space, Alert } from 'antd';
import { PrinterOutlined, CheckCircleOutlined, DollarOutlined, ReloadOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getFnfById, approveFnf, settleFnf, cancelFnf, recalculateFnf } from '../../../services/hr/fnfService';
import { hasPermission } from '../../../utils/permissions';
import { FNF_STATUS, SEPARATION_REASONS } from '../../../utils/hrConstants';
import PageHeader from '../../../components/PageHeader';

const statusMap = Object.fromEntries(FNF_STATUS.map((s) => [s.value, s]));
const reasonMap = Object.fromEntries(SEPARATION_REASONS.map((r) => [r.value, r.label]));

const formatCurrency = (val) =>
  val != null ? `\u20B9${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';

const AmountRow = ({ label, value, bold }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontWeight: bold ? 700 : 400 }}>
    <span>{label}</span>
    <span>{formatCurrency(value)}</span>
  </div>
);

const FnfView = () => {
  const { message, modal } = App.useApp();
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getFnfById(id);
      setData(result);
    } catch {
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRecalculate = useCallback(() => {
    modal.confirm({
      title: 'Recalculate this settlement?',
      content: 'Every amount is re-derived from the employee’s current loans, advances, leave '
        + 'balance and salary structure. Any figures edited by hand are replaced.',
      okText: 'Recalculate',
      onOk: async () => {
        setActionLoading(true);
        try {
          await recalculateFnf(id);
          message.success('Settlement recalculated');
          fetchData();
        } catch {
          // axiosInstance already toasts the server's message.
        } finally {
          setActionLoading(false);
        }
      },
    });
  }, [id, message, modal, fetchData]);

  const handleCancel = useCallback(() => {
    modal.confirm({
      title: 'Cancel this settlement?',
      content: 'The settlement is abandoned. Nothing has been approved or paid, and the employee '
        + 'stays active, so nothing needs reversing.',
      okText: 'Cancel Settlement',
      okButtonProps: { danger: true },
      cancelText: 'Keep',
      onOk: async () => {
        setActionLoading(true);
        try {
          await cancelFnf(id);
          message.success('Settlement cancelled');
          fetchData();
        } catch {
          // axiosInstance already toasts the server's message.
        } finally {
          setActionLoading(false);
        }
      },
    });
  }, [id, message, modal, fetchData]);

  const handleApprove = useCallback(async () => {
    setActionLoading(true);
    try {
      await approveFnf(id);
      message.success('F&F settlement approved');
      fetchData();
    } catch {
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setActionLoading(false);
    }
  }, [id, message, fetchData]);

  const handleSettle = useCallback(async () => {
    setActionLoading(true);
    try {
      await settleFnf(id);
      message.success('F&F settlement finalized');
      fetchData();
    } catch {
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setActionLoading(false);
    }
  }, [id, message, fetchData]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (loading || !data) {
    return (
      <>
        <PageHeader title="F&F Settlement" onBack={() => navigate('/hr/fnf')} />
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      </>
    );
  }

  const statusInfo = statusMap[data.status];
  // The server stores all three totals; recomputing is only a fallback for
  // older rows saved before they were persisted.
  const totalEarnings = data.totalEarnings != null ? data.totalEarnings
    : (data.pendingSalary || 0) + (data.elEncashmentAmount || 0) + (data.bonusProrata || 0) + (data.gratuity || 0) + (data.otherEarnings || 0);
  const totalDeductions = data.totalDeductions != null ? data.totalDeductions
    : (data.outstandingLoan || 0) + (data.outstandingAdvance || 0) + (data.noticePeriodRecovery || 0) + (data.otherDeductions || 0);
  // Approve and Settle both authorise a payout, so both sit behind the same
  // permission. Note this is a UI gate only - the API does not yet enforce
  // per-operation permissions on any module.
  const canApprove = hasPermission('hr-fnf', 'approve');

  const netSettlement = data.netSettlement != null ? data.netSettlement : totalEarnings - totalDeductions;

  return (
    <>
      <PageHeader
        title="F&F Settlement Statement"
        onBack={() => navigate('/hr/fnf')}
        extra={
          <Space>
            {data.status === 'CALCULATED' && canApprove && (
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleApprove} loading={actionLoading}>
                Approve
              </Button>
            )}
            {/* Calculated for the wrong person or on the wrong date is a real
                case, and there was no way back short of leaving it in the list. */}
            {/* Every figure here is derived from data that keeps moving - loan
                balances, leave, advances, the salary structure. Without this the
                only way to pick up a change was to cancel and start again. */}
            {['DRAFT', 'CALCULATED'].includes(data.status) && canApprove && (
              <Button icon={<ReloadOutlined />} onClick={handleRecalculate} loading={actionLoading}>
                Recalculate
              </Button>
            )}
            {['DRAFT', 'CALCULATED'].includes(data.status) && canApprove && (
              <Button danger onClick={handleCancel} loading={actionLoading}>
                Cancel
              </Button>
            )}
            {data.status === 'APPROVED' && canApprove && (
              <Button type="primary" icon={<DollarOutlined />} onClick={handleSettle} loading={actionLoading}>
                Settle
              </Button>
            )}
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
              Print
            </Button>
          </Space>
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} bordered size="small">
          <Descriptions.Item label="Employee Name">{data.employeeName || '-'}</Descriptions.Item>
          <Descriptions.Item label="Employee Code">{data.employeeNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="Department">{data.departmentName || '-'}</Descriptions.Item>
          <Descriptions.Item label="Designation">{data.designationName || '-'}</Descriptions.Item>
          <Descriptions.Item label="Date of Joining">
            {data.dateOfJoining ? dayjs(data.dateOfJoining).format('DD MMM YYYY') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Last Working Date">
            {data.lastWorkingDate ? dayjs(data.lastWorkingDate).format('DD MMM YYYY') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Separation Reason">{reasonMap[data.separationReason] || data.separationReason || '-'}</Descriptions.Item>
          <Descriptions.Item label="Status">
            {statusInfo ? <Tag color={statusInfo.color}>{statusInfo.label}</Tag> : data.status}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card title="Earnings" styles={{ header: { background: '#f6ffed', borderBottom: '2px solid #b7eb8f' } }}>
            <AmountRow label="Pending Salary" value={data.pendingSalary} />
            <AmountRow label="EL Encashment" value={data.elEncashmentAmount} />
            <AmountRow label="Bonus Pro-rata" value={data.bonusProrata} />
            <AmountRow label="Gratuity" value={data.gratuity} />
            <AmountRow label="Other Earnings" value={data.otherEarnings} />
            <Divider style={{ margin: '8px 0' }} />
            <AmountRow label="Total Earnings" value={totalEarnings} bold />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Deductions" styles={{ header: { background: '#fff2f0', borderBottom: '2px solid #ffccc7' } }}>
            <AmountRow label="Outstanding Loan" value={data.outstandingLoan} />
            <AmountRow label="Outstanding Advance" value={data.outstandingAdvance} />
            <AmountRow label="Notice Period Recovery" value={data.noticePeriodRecovery} />
            <AmountRow label="Other Deductions" value={data.otherDeductions} />
            <Divider style={{ margin: '8px 0' }} />
            <AmountRow label="Total Deductions" value={totalDeductions} bold />
          </Card>
        </Col>
      </Row>

      <Card>
                  {netSettlement < 0 && (
            <div style={{ marginBottom: 12 }}>
              <Alert
                type="warning"
                showIcon
                message="This settlement is negative"
                description="Deductions exceed earnings, so the employee owes the company this amount rather than being paid it. Settling records the figure; recovering it is a separate matter."
              />
            </div>
          )}
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <span style={{ fontSize: 24, fontWeight: 700 }}>
            Net Settlement:{' '}
            <span style={{ color: netSettlement >= 0 ? '#52c41a' : '#ff4d4f' }}>
              {formatCurrency(netSettlement)}
            </span>
          </span>
        </div>
      </Card>
    </>
  );
};

export default FnfView;
