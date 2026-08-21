import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Tag, Card, Row, Col, Statistic, Button, Space, Spin, Alert } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { getBonusRunById, getBonusRecords, approveBonus, markBonusPaid } from '../../../services/hr/bonusService';
import { BONUS_STATUS } from '../../../utils/hrConstants';
import { hasPermission } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';

const statusMap = Object.fromEntries(BONUS_STATUS.map((s) => [s.value, s]));

const formatCurrency = (val) =>
  val != null ? `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';

/**
 * Detail view for one bonus run.
 *
 * The list's View button pointed back at the list itself, and no route for a
 * single run existed, so a calculated run could only be approved inside the
 * wizard that created it. Leaving the wizard stranded the run exactly as an
 * unfinished payroll run used to be.
 */
const BonusRunView = () => {
  const { message, modal } = App.useApp();
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [run, setRun] = useState(null);
  const [records, setRecords] = useState([]);

  const canUpdate = hasPermission('hr-bonus', 'update');
  const canApprove = hasPermission('hr-bonus', 'approve') || canUpdate;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [runResult, recsResult] = await Promise.all([
        getBonusRunById(id),
        getBonusRecords(id),
      ]);
      setRun(runResult);
      setRecords(Array.isArray(recsResult) ? recsResult : recsResult?.content || []);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to load the bonus run');
    } finally {
      setLoading(false);
    }
  }, [id, message]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApprove = useCallback(() => {
    modal.confirm({
      title: 'Approve this bonus run?',
      content: 'Approving finalises the calculated amounts. Recalculating afterwards is not possible.',
      okText: 'Approve',
      onOk: async () => {
        setAdvancing(true);
        try {
          await approveBonus(id);
          message.success('Bonus run approved');
          fetchData();
        } catch (err) {
          message.error(err?.response?.data?.message || 'Failed to approve the bonus run');
        } finally {
          setAdvancing(false);
        }
      },
    });
  }, [id, message, modal, fetchData]);

  const handleMarkPaid = useCallback(() => {
    modal.confirm({
      title: 'Mark this bonus run as paid?',
      content: 'Records that the bonus has actually been disbursed. This cannot be undone.',
      okText: 'Mark as Paid',
      onOk: async () => {
        setAdvancing(true);
        try {
          await markBonusPaid(id);
          message.success('Bonus run marked as paid');
          fetchData();
        } catch (err) {
          message.error(err?.response?.data?.message || 'Failed to mark the run as paid');
        } finally {
          setAdvancing(false);
        }
      },
    });
  }, [id, message, modal, fetchData]);

  const columns = useMemo(() => [
    { title: 'Emp No', dataIndex: 'employeeNo', key: 'employeeNo', width: 110 },
    { title: 'Employee', dataIndex: 'employeeName', key: 'employeeName', width: 200, ellipsis: true },
    {
      title: 'Salary Considered', dataIndex: 'totalSalary', key: 'totalSalary',
      width: 160, align: 'right', render: formatCurrency,
    },
    {
      title: 'Bonus', dataIndex: 'bonusAmount', key: 'bonusAmount',
      width: 140, align: 'right', render: formatCurrency,
    },
  ], []);

  const totalBonus = useMemo(
    () => records.reduce((sum, r) => sum + (Number(r.bonusAmount) || 0), 0),
    [records],
  );

  const statusInfo = statusMap[run?.status];
  const period = run?.yearFrom && run?.yearTo
    ? `${run.yearFrom}-${String(run.yearTo).slice(2)}`
    : '';

  return (
    <Spin spinning={loading}>
      <PageHeader
        title={`Bonus Run${period ? ` — ${period}` : ''}`}
        onBack={() => navigate('/hr/bonus')}
        extra={
          <Space>
            {statusInfo && <Tag color={statusInfo.color}>{statusInfo.label}</Tag>}
            {run?.status === 'CALCULATED' && canApprove && (
              <Button type="primary" loading={advancing} onClick={handleApprove}>Approve</Button>
            )}
            {run?.status === 'APPROVED' && canUpdate && (
              <Button type="primary" loading={advancing} onClick={handleMarkPaid}>Mark as Paid</Button>
            )}
          </Space>
        }
      />

      {/* Each unfinished state says what it is waiting for. */}
      {run?.status === 'CALCULATED' && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Calculated but not approved"
          description="The amounts below are provisional. Approve the run to finalise them."
        />
      )}
      {run?.status === 'APPROVED' && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Approved but not yet paid"
          description="Mark the run as paid once the bonus has actually been disbursed."
        />
      )}
      {run?.status === 'DRAFT' && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Nothing calculated yet"
          description="This run has no bonus records. Start a new run to calculate it."
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Factory" value={run?.factoryName || '-'} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Accounting Year"
              value={period || '-'}
              suffix={run?.yearFrom ? <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                Apr {run.yearFrom} – Mar {run.yearTo}
              </span> : null}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Employees" value={records.length} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Bonus %" value={run?.bonusPercentage ?? '-'} suffix="%" />
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title="Bonus Records"
        extra={<strong>Total: {formatCurrency(totalBonus)}</strong>}
      >
        <Table
          rowKey="id"
          dataSource={records}
          columns={columns}
          size="small"
          scroll={{ x: 700 }}
          pagination={{ pageSize: 25, showSizeChanger: true }}
          locale={{ emptyText: 'No bonus records. Payroll must be processed for the months in this period first.' }}
        />
      </Card>
    </Spin>
  );
};

export default BonusRunView;
