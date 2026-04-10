import { useState, useEffect, useCallback } from 'react';
import { App, Card, Descriptions, Tag, Button, Spin, Row, Col, Divider, Space } from 'antd';
import { PrinterOutlined, CheckCircleOutlined, DollarOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getFnfById, approveFnf, settleFnf } from '../../../services/fnfService';
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
  const { message } = App.useApp();
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
      message.error('Failed to load F&F settlement');
    } finally {
      setLoading(false);
    }
  }, [id, message]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = useCallback(async () => {
    setActionLoading(true);
    try {
      await approveFnf(id);
      message.success('F&F settlement approved');
      fetchData();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to approve');
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
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to settle');
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
  const totalEarnings = (data.pendingSalary || 0) + (data.elEncashment || 0) + (data.bonusProRata || 0) + (data.gratuity || 0) + (data.otherEarnings || 0);
  const totalDeductions = (data.outstandingLoan || 0) + (data.outstandingAdvance || 0) + (data.noticePeriodRecovery || 0) + (data.otherDeductions || 0);
  const netSettlement = data.netSettlement != null ? data.netSettlement : totalEarnings - totalDeductions;

  return (
    <>
      <PageHeader
        title="F&F Settlement Statement"
        onBack={() => navigate('/hr/fnf')}
        extra={
          <Space>
            {data.status === 'CALCULATED' && (
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleApprove} loading={actionLoading}>
                Approve
              </Button>
            )}
            {data.status === 'APPROVED' && (
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
          <Descriptions.Item label="Employee Code">{data.employeeCode || '-'}</Descriptions.Item>
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
            <AmountRow label="EL Encashment" value={data.elEncashment} />
            <AmountRow label="Bonus Pro-rata" value={data.bonusProRata} />
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
