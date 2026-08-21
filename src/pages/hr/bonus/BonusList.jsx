import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Tag, Button, Select, Space, Row, Col } from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getAllBonusRuns } from '../../../services/hr/bonusService';
import { BONUS_STATUS } from '../../../utils/hrConstants';
import { hasPermission } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';

const statusMap = Object.fromEntries(BONUS_STATUS.map((s) => [s.value, s]));

const formatCurrency = (val) =>
  val != null ? `\u20B9${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-';

const BonusList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [statusFilter, setStatusFilter] = useState(undefined);

  const canAdd = hasPermission('hr-bonus', 'add');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllBonusRuns();
      setData(Array.isArray(result) ? result : result?.content || []);
    } catch {
      message.error('Failed to load bonus runs');
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
        title: 'Year Period',
        key: 'yearPeriod',
        width: 180,
        // yearFrom and yearTo are plain years, not dates. Passing them through
        // dayjs treated 2025 as a millisecond timestamp and rendered "Jan 1970".
        render: (_, r) => (r.yearFrom && r.yearTo
          ? `${r.yearFrom}-${String(r.yearTo).slice(2)} (Apr ${r.yearFrom} to Mar ${r.yearTo})`
          : '-'),
        sorter: (a, b) => (a.yearFrom || 0) - (b.yearFrom || 0),
        defaultSortOrder: 'descend',
      },
      {
        title: 'Factory',
        dataIndex: 'factoryName',
        key: 'factoryName',
        width: 160,
        ellipsis: true,
      },
      {
        title: 'Bonus %',
        dataIndex: 'bonusPercentage',
        key: 'bonusPercentage',
        width: 100,
        align: 'right',
        render: (val) => (val != null ? `${val}%` : '-'),
      },
      {
        title: 'Employees',
        dataIndex: 'employeeCount',
        key: 'employeeCount',
        width: 100,
        align: 'right',
      },
      {
        title: 'Total Amount',
        dataIndex: 'totalAmount',
        key: 'totalAmount',
        width: 150,
        align: 'right',
        render: formatCurrency,
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 120,
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
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/hr/bonus`, { state: { viewId: r.id } })}
          >
            View
          </Button>
        ),
      },
    ],
    [navigate],
  );

  return (
    <>
      <PageHeader title="Bonus Management" />
      <Row gutter={16} style={{ marginBottom: 16 }} align="middle">
        <Col flex="auto">
          <Select
            placeholder="Filter by status"
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            options={BONUS_STATUS}
            style={{ width: 180 }}
          />
        </Col>
        <Col>
          {canAdd && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/hr/bonus/new')}>
              New Bonus Run
            </Button>
          )}
        </Col>
      </Row>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredData}
        loading={loading}
        scroll={{ x: 900 }}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `Total ${t} runs` }}
      />
    </>
  );
};

export default BonusList;
