import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Tag, Button, Select, Space, Row, Col } from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getAllFnfSettlements } from '../../../services/hr/fnfService';
import { FNF_STATUS, SEPARATION_REASONS } from '../../../utils/hrConstants';
import { hasPermission } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';

const statusMap = Object.fromEntries(FNF_STATUS.map((s) => [s.value, s]));
const reasonMap = Object.fromEntries(SEPARATION_REASONS.map((r) => [r.value, r.label]));

const formatCurrency = (val) =>
  val != null ? `\u20B9${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';

const FnfList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [statusFilter, setStatusFilter] = useState(undefined);

  const canAdd = hasPermission('hr-fnf', 'add');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllFnfSettlements();
      setData(Array.isArray(result) ? result : result?.content || []);
    } catch {
      message.error('Failed to load F&F settlements');
    } finally {
      setLoading(false);
    }
  }, [message]);

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
        title: 'Employee',
        dataIndex: 'employeeName',
        key: 'employeeName',
        width: 180,
        ellipsis: true,
      },
      {
        title: 'Code',
        dataIndex: 'employeeCode',
        key: 'employeeCode',
        width: 100,
      },
      {
        title: 'Last Working Date',
        dataIndex: 'lastWorkingDate',
        key: 'lastWorkingDate',
        width: 140,
        render: (val) => (val ? dayjs(val).format('DD MMM YYYY') : '-'),
        sorter: (a, b) => (a.lastWorkingDate || '').localeCompare(b.lastWorkingDate || ''),
        defaultSortOrder: 'descend',
      },
      {
        title: 'Reason',
        dataIndex: 'separationReason',
        key: 'separationReason',
        width: 130,
        render: (val) => reasonMap[val] || val || '-',
      },
      {
        title: 'Total Earnings',
        dataIndex: 'totalEarnings',
        key: 'totalEarnings',
        width: 140,
        align: 'right',
        render: formatCurrency,
      },
      {
        title: 'Total Deductions',
        dataIndex: 'totalDeductions',
        key: 'totalDeductions',
        width: 140,
        align: 'right',
        render: formatCurrency,
      },
      {
        title: 'Net Settlement',
        dataIndex: 'netSettlement',
        key: 'netSettlement',
        width: 140,
        align: 'right',
        render: (val) => <strong>{formatCurrency(val)}</strong>,
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 110,
        render: (status) => {
          const s = statusMap[status];
          return s ? <Tag color={s.color}>{s.label}</Tag> : status;
        },
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 80,
        fixed: 'right',
        render: (_, r) => (
          <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/hr/fnf/${r.id}`)}>
            View
          </Button>
        ),
      },
    ],
    [navigate],
  );

  return (
    <>
      <PageHeader title="Full & Final Settlement" />
      <Row gutter={16} style={{ marginBottom: 16 }} align="middle">
        <Col flex="auto">
          <Select
            placeholder="Filter by status"
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            options={FNF_STATUS}
            style={{ width: 180 }}
          />
        </Col>
        <Col>
          {canAdd && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/hr/fnf/new')}>
              New F&F
            </Button>
          )}
        </Col>
      </Row>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredData}
        loading={loading}
        scroll={{ x: 1100 }}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `Total ${t} settlements` }}
      />
    </>
  );
};

export default FnfList;
