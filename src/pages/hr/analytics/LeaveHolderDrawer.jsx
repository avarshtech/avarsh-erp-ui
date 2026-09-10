import { useState, useEffect, useMemo, useCallback } from 'react';
import { Drawer, Table, Typography, Alert } from 'antd';
import { getLeaveHolders } from '../../../services/hr/hrAnalyticsService';
import { formatRupees, formatRupeesExact } from './bridgeFormat';

const { Text } = Typography;

const days = (v) => (v == null ? '-' : Number(v).toString());

/** Who is holding unused leave, heaviest liability first. */
const LeaveHolderDrawer = ({ open, title, params, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const fetchRows = useCallback(async () => {
    if (!open || !params) return;
    setLoading(true);
    try {
      const result = await getLeaveHolders(params);
      setRows(Array.isArray(result) ? result : []);
    } catch {
      setRows([]);
      // axiosInstance already surfaces the server's message.
    } finally {
      setLoading(false);
    }
  }, [open, params]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

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
    { title: 'Department', dataIndex: 'departmentName', key: 'departmentName', width: 135, ellipsis: true },
    { title: 'Designation', dataIndex: 'designationName', key: 'designationName', width: 145, ellipsis: true },
    {
      title: 'Days held', dataIndex: 'balanceDays', key: 'balanceDays', width: 100, align: 'right',
      sorter: (a, b) => a.balanceDays - b.balanceDays, render: days,
    },
    {
      title: 'Encashable', dataIndex: 'encashableDays', key: 'encashableDays',
      width: 110, align: 'right', render: days,
    },
    {
      title: 'Per day', dataIndex: 'dailyRate', key: 'dailyRate', width: 110, align: 'right',
      render: (v) => (v == null
        ? <Text type="warning">no structure</Text>
        : formatRupeesExact(v)),
    },
    {
      title: 'Worth', dataIndex: 'liabilityAmount', key: 'liabilityAmount',
      width: 130, align: 'right', fixed: 'right',
      sorter: (a, b) => a.liabilityAmount - b.liabilityAmount,
      render: (v) => <Text strong>{formatRupees(v)}</Text>,
    },
  ], []);

  const total = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.liabilityAmount) || 0), 0),
    [rows],
  );

  return (
    <Drawer title={title} open={open} onClose={onClose} size={900} destroyOnHidden>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title={`${rows.length} holding leave, worth ${formatRupees(total)}`}
        description="Valued at each employee's own daily rate — basic plus DA over 26 — which is the same
          rate the encashment run pays out, so a provision here and a cheque there cannot disagree."
      />
      <Table
        rowKey="employeeId"
        columns={columns}
        dataSource={rows}
        loading={loading}
        size="small"
        scroll={{ x: 930 }}
        pagination={{ pageSize: 25, showSizeChanger: true, showTotal: (t) => `${t} employees` }}
        locale={{ emptyText: 'Nobody is holding leave here' }}
      />
    </Drawer>
  );
};

export default LeaveHolderDrawer;
