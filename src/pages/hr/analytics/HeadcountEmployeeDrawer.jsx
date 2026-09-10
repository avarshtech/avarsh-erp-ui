import { useState, useEffect, useMemo, useCallback } from 'react';
import { Drawer, Table, Typography, Tag } from 'antd';
import dayjs from 'dayjs';
import { getHeadcountEmployees } from '../../../services/hr/hrAnalyticsService';

const { Text } = Typography;

const date = (v) => (v ? dayjs(v).format('DD MMM YYYY') : '-');

/** The people behind one cell of the headcount table. */
const HeadcountEmployeeDrawer = ({ cell, params, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const fetchRows = useCallback(async () => {
    if (!cell) return;
    setLoading(true);
    try {
      const result = await getHeadcountEmployees({
        ...params,
        groupKey: cell.groupKey ?? undefined,
        movement: cell.movement,
      });
      setRows(Array.isArray(result) ? result : []);
    } catch {
      setRows([]);
      // axiosInstance already surfaces the server's message.
    } finally {
      setLoading(false);
    }
  }, [cell, params]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const showTenure = cell?.movement === 'LEAVERS';

  const columns = useMemo(() => [
    {
      title: 'Employee', key: 'employee', width: 200, ellipsis: true,
      render: (_, r) => (
        <>
          <div>{r.employeeName || '-'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.employeeNo}</Text>
        </>
      ),
    },
    { title: 'Department', dataIndex: 'departmentName', key: 'departmentName', width: 130, ellipsis: true },
    { title: 'Designation', dataIndex: 'designationName', key: 'designationName', width: 140, ellipsis: true },
    {
      title: 'Category', dataIndex: 'category', key: 'category', width: 100,
      render: (v) => (v ? <Tag>{v}</Tag> : '-'),
    },
    { title: 'Joined', dataIndex: 'dateOfJoining', key: 'dateOfJoining', width: 125, render: date },
    { title: 'Left', dataIndex: 'dateOfLeaving', key: 'dateOfLeaving', width: 125, render: date },
    ...(showTenure ? [{
      title: 'Tenure', dataIndex: 'tenureDays', key: 'tenureDays', width: 110, align: 'right',
      sorter: (a, b) => (a.tenureDays ?? 0) - (b.tenureDays ?? 0),
      render: (v) => (v == null ? '-' : v < 60 ? <Text type="warning">{v} days</Text> : `${v} days`),
    }] : []),
  ], [showTenure]);

  return (
    <Drawer
      title={cell ? `${cell.label}${cell.groupLabel ? ` — ${cell.groupLabel}` : ''}` : ''}
      open={Boolean(cell)}
      onClose={onClose}
      size={860}
      destroyOnHidden
    >
      <Table
        rowKey="employeeId"
        columns={columns}
        dataSource={rows}
        loading={loading}
        size="small"
        scroll={{ x: showTenure ? 930 : 820 }}
        pagination={{ pageSize: 25, showSizeChanger: true, showTotal: (t) => `${t} employees` }}
        locale={{ emptyText: 'Nobody in this group' }}
      />
    </Drawer>
  );
};

export default HeadcountEmployeeDrawer;
