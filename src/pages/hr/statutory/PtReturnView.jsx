import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Tag, Card, Row, Col, Statistic, Button, Space, Spin, Alert } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getPtReturnById, getPtReturnRecords, filePtReturn } from '../../../services/hr/statutoryService';
import { PT_RETURN_STATUS } from '../../../utils/hrConstants';
import { hasPermission } from '../../../utils/permissions';
import { recordEmployeeLabel } from '../../../utils/hrLabels';
import PageHeader from '../../../components/PageHeader';

const statusMap = Object.fromEntries(PT_RETURN_STATUS.map((s) => [s.value, s]));

const formatCurrency = (val) =>
  val != null ? `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';

/**
 * Detail view for one Professional Tax return.
 *
 * The list offered File as a row action with nothing behind it, so a return was
 * filed without ever seeing which employees it covered or what each was charged
 * - even though the per-employee records endpoint had been in the service layer
 * all along, imported by the list and never called.
 */
const PtReturnView = () => {
  const { message, modal } = App.useApp();
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [filing, setFiling] = useState(false);
  const [ptReturn, setPtReturn] = useState(null);
  const [records, setRecords] = useState([]);

  const canUpdate = hasPermission('hr-statutory', 'update');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [returnResult, recordResult] = await Promise.all([
        getPtReturnById(id),
        getPtReturnRecords(id),
      ]);
      setPtReturn(returnResult);
      setRecords(Array.isArray(recordResult) ? recordResult : recordResult?.content || []);
    } catch (err) {
      setPtReturn(null);
      message.error(err?.response?.data?.message || 'Failed to load the PT return');
    } finally {
      setLoading(false);
    }
  }, [id, message]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFile = useCallback(() => {
    modal.confirm({
      title: 'Mark this return as filed?',
      content: 'Records that the return has been submitted to the corporation. This cannot be undone.',
      okText: 'Mark as Filed',
      onOk: async () => {
        setFiling(true);
        try {
          await filePtReturn(id);
          message.success('PT return marked as filed');
          fetchData();
        } catch (err) {
          message.error(err?.response?.data?.message || 'Could not file the return');
        } finally {
          setFiling(false);
        }
      },
    });
  }, [id, message, modal, fetchData]);

  const columns = useMemo(() => [
    {
      title: 'Employee', key: 'employee', width: 240, ellipsis: true,
      render: (_, r) => recordEmployeeLabel(r) || '-',
    },
    {
      title: 'Half-Yearly Gross', dataIndex: 'totalGross', key: 'totalGross',
      width: 180, align: 'right', render: formatCurrency,
    },
    {
      title: 'PT Amount', dataIndex: 'ptAmount', key: 'ptAmount',
      width: 150, align: 'right', render: formatCurrency,
    },
  ], []);

  const total = useMemo(
    () => records.reduce((sum, r) => sum + (Number(r.ptAmount) || 0), 0),
    [records],
  );

  const statusInfo = statusMap[ptReturn?.status];

  const period = ptReturn?.periodFrom && ptReturn?.periodTo
    ? `${dayjs(ptReturn.periodFrom).format('DD MMM YYYY')} — ${dayjs(ptReturn.periodTo).format('DD MMM YYYY')}`
    : '-';

  if (!loading && !ptReturn) {
    return (
      <>
        <PageHeader title="PT Return" onBack={() => navigate('/hr/statutory/pt')} />
        <Alert
          type="error"
          showIcon
          message="This return could not be loaded"
          description="It may have been deleted, or the server did not respond. Go back to the list and try again."
        />
      </>
    );
  }

  return (
    <Spin spinning={loading}>
      <PageHeader
        title="Professional Tax Return"
        onBack={() => navigate('/hr/statutory/pt')}
        extra={
          <Space>
            {statusInfo && <Tag color={statusInfo.color}>{statusInfo.label}</Tag>}
            {ptReturn?.status === 'CALCULATED' && canUpdate && (
              <Button type="primary" loading={filing} onClick={handleFile}>
                Mark as Filed
              </Button>
            )}
          </Space>
        }
      />

      {ptReturn?.status === 'CALCULATED' && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Calculated but not filed"
          description="Check the employees and amounts below against the current slab rates before marking this as filed."
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Factory" value={ptReturn?.factoryName || '-'} /></Card>
        </Col>
        <Col xs={24} sm={10}>
          <Card size="small"><Statistic title="Period" value={period} valueStyle={{ fontSize: 16 }} /></Card>
        </Col>
        <Col xs={12} sm={4}>
          <Card size="small"><Statistic title="Employees" value={records.length} /></Card>
        </Col>
        <Col xs={12} sm={4}>
          <Card size="small">
            <Statistic title="Total PT" value={total} precision={2} prefix={'₹'} />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="Employee Records" extra={<strong>Total: {formatCurrency(total)}</strong>}>
        <Table
          rowKey="id"
          dataSource={records}
          columns={columns}
          size="small"
          scroll={{ x: 600 }}
          pagination={{ pageSize: 25, showSizeChanger: true }}
          locale={{
            emptyText: 'No records. Employees need a PT-applicable flag and earnings in this half-year to appear.',
          }}
        />
      </Card>
    </Spin>
  );
};

export default PtReturnView;
