import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Tag, Card, Row, Col, Statistic, Button, Space, Spin, Alert } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getElEncashmentRunById, getElEncashmentRecords,
  approveElEncashment, markElEncashmentPaid, cancelElEncashment,
} from '../../../services/hr/statutoryService';
import { EL_ENCASHMENT_STATUS, EMPLOYEE_CATEGORY } from '../../../utils/hrConstants';
import { hasPermission } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';

const statusMap = Object.fromEntries(EL_ENCASHMENT_STATUS.map((s) => [s.value, s]));

const formatCurrency = (val) =>
  val != null ? `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';

/**
 * Detail view for one EL encashment run.
 *
 * The list offered Approve as a row button with nothing behind it, so a run was
 * approved without seeing who was being paid what - despite the API already
 * exposing the per-employee records. This puts the review before the decision.
 */
const ElEncashmentRunView = () => {
  const { message, modal } = App.useApp();
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [run, setRun] = useState(null);
  const [records, setRecords] = useState([]);

  const canUpdate = hasPermission('hr-statutory', 'update');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [runResult, recsResult] = await Promise.all([
        getElEncashmentRunById(id),
        getElEncashmentRecords(id),
      ]);
      setRun(runResult);
      setRecords(Array.isArray(recsResult) ? recsResult : recsResult?.content || []);
    } catch {
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const act = useCallback((title, content, fn, okText) => {
    modal.confirm({
      title,
      content,
      okText,
      onOk: async () => {
        setAdvancing(true);
        try {
          await fn(id);
          message.success(`${okText} done`);
          fetchData();
        } catch (err) {
          message.error(err?.response?.data?.message || `Could not ${okText.toLowerCase()}`);
        } finally {
          setAdvancing(false);
        }
      },
    });
  }, [id, message, modal, fetchData]);

  const columns = useMemo(() => [
    { title: 'Emp No', dataIndex: 'employeeNo', key: 'employeeNo', width: 110 },
    { title: 'Employee', dataIndex: 'employeeName', key: 'employeeName', width: 190, ellipsis: true },
    {
      title: 'EL Balance (days)', dataIndex: 'elBalanceDays', key: 'elBalanceDays',
      width: 150, align: 'right', render: (v) => (v ?? '-'),
    },
    {
      title: 'Days Encashed', dataIndex: 'totalDays', key: 'totalDays',
      width: 140, align: 'right', render: (v) => (v ?? '-'),
    },
    {
      title: 'Basic + DA', dataIndex: 'basicPlusDa', key: 'basicPlusDa',
      width: 140, align: 'right', render: formatCurrency,
    },
    {
      title: 'Amount', dataIndex: 'elAmount', key: 'elAmount',
      width: 140, align: 'right', render: formatCurrency,
    },
  ], []);

  const total = useMemo(
    () => records.reduce((sum, r) => sum + (Number(r.elAmount) || 0), 0),
    [records],
  );

  const statusInfo = statusMap[run?.status];
  const categoryLabel = EMPLOYEE_CATEGORY.find((c) => c.value === run?.category)?.label || run?.category;

  return (
    <Spin spinning={loading}>
      <PageHeader
        title={`EL Encashment${run?.year ? ` — ${run.year}` : ''}`}
        onBack={() => navigate('/hr/statutory/el')}
        extra={
          <Space>
            {statusInfo && <Tag color={statusInfo.color}>{statusInfo.label}</Tag>}
            {run?.status === 'CALCULATED' && canUpdate && (
              <Button
                type="primary"
                loading={advancing}
                onClick={() => act(
                  'Approve this encashment run?',
                  'Approving finalises the amounts below and takes the encashed days off each '
                    + "employee's leave balance. It cannot be undone.",
                  approveElEncashment, 'Approve',
                )}
              >
                Approve
              </Button>
            )}
            {/* Calculated in error is a real case, and there was no way back. */}
            {run?.status === 'CALCULATED' && canUpdate && (
              <Button
                danger
                loading={advancing}
                onClick={() => act(
                  'Cancel this encashment run?',
                  'The run and its records are abandoned. Nothing has been taken off any leave '
                    + 'balance yet, so nothing needs putting back.',
                  cancelElEncashment, 'Cancel Run',
                )}
              >
                Cancel Run
              </Button>
            )}
            {run?.status === 'APPROVED' && canUpdate && (
              <Button
                type="primary"
                loading={advancing}
                onClick={() => act(
                  'Mark this run as paid?',
                  'Records that the encashment has been disbursed. This cannot be undone.',
                  markElEncashmentPaid, 'Mark as Paid',
                )}
              >
                Mark as Paid
              </Button>
            )}
          </Space>
        }
      />

      {run?.status === 'CALCULATED' && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Calculated but not approved"
          description="Check the days and amounts below before approving. Encashment is paid from unused earned leave, so the balance is consumed once this is approved."
        />
      )}
      {run?.status === 'APPROVED' && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Approved but not yet paid"
          description="Mark the run as paid once the amount has actually been disbursed."
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Factory" value={run?.factoryName || '-'} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Year" value={run?.year ?? '-'} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Category" value={categoryLabel || 'All'} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Employees" value={records.length} /></Card>
        </Col>
      </Row>

      <Card
        size="small"
        title="Encashment Records"
        extra={<strong>Total: {formatCurrency(total)}</strong>}
      >
        <Table
          rowKey="id"
          dataSource={records}
          columns={columns}
          size="small"
          scroll={{ x: 900 }}
          pagination={{ pageSize: 25, showSizeChanger: true }}
          locale={{
            emptyText: 'No records. Employees need an unused earned-leave balance for the year to be encashed.',
          }}
        />
      </Card>
    </Spin>
  );
};

export default ElEncashmentRunView;
