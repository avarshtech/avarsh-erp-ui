import { useState, useEffect, useMemo, useCallback } from 'react';
import { Drawer, Table, Typography, Tag, Alert } from 'antd';
import { getOvertimeRegister } from '../../../services/hr/hrAnalyticsService';
import { formatRupees } from './bridgeFormat';

const { Text } = Typography;

/** Who worked the overtime, worst quarter first. */
const OvertimeRegisterDrawer = ({ open, title, params, overCapOnly, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const fetchRows = useCallback(async () => {
    if (!open || !params) return;
    setLoading(true);
    try {
      const result = await getOvertimeRegister({ ...params, overCapOnly });
      setRows(Array.isArray(result) ? result : []);
    } catch {
      setRows([]);
      // axiosInstance already surfaces the server's message.
    } finally {
      setLoading(false);
    }
  }, [open, params, overCapOnly]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const columns = useMemo(() => [
    {
      title: 'Employee', key: 'employee', width: 195, ellipsis: true,
      render: (_, r) => (
        <>
          <div>{r.employeeName || '-'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.employeeNo}</Text>
        </>
      ),
    },
    { title: 'Department', dataIndex: 'departmentName', key: 'departmentName', width: 130, ellipsis: true },
    {
      title: 'OT hours', dataIndex: 'otHours', key: 'otHours', width: 100, align: 'right',
      sorter: (a, b) => a.otHours - b.otHours,
    },
    { title: 'On days', dataIndex: 'otDays', key: 'otDays', width: 90, align: 'right' },
    {
      title: 'Paid', dataIndex: 'otAmount', key: 'otAmount', width: 115, align: 'right',
      render: (v) => (Number(v) ? formatRupees(v) : <Text type="secondary">-</Text>),
    },
    {
      title: 'Worst quarter', key: 'worstQuarter', width: 175, align: 'right', fixed: 'right',
      sorter: (a, b) => a.worstQuarterHours - b.worstQuarterHours,
      render: (_, r) => (
        <>
          <Text strong>{Number(r.worstQuarterHours) || 0} hrs</Text>
          <div>
            {r.overCap
              ? <Tag color="warning">{r.worstQuarter} over limit</Tag>
              : <Text type="secondary" style={{ fontSize: 12 }}>{r.worstQuarter}</Text>}
          </div>
        </>
      ),
    },
  ], []);

  return (
    <Drawer title={title} open={open} onClose={onClose} size={900} destroyOnHidden>
      <Alert
        type={overCapOnly ? 'warning' : 'info'}
        showIcon
        style={{ marginBottom: 16 }}
        title={`${rows.length} ${overCapOnly ? 'over the limit' : 'worked overtime'}`}
        description="Hours are the selected periods; the worst quarter is measured over the full calendar
          quarter, which is what a limit is defined against. Paid is blank where the period has no
          processed payroll run."
      />
      <Table
        rowKey="employeeId"
        columns={columns}
        dataSource={rows}
        loading={loading}
        size="small"
        scroll={{ x: 830 }}
        pagination={{ pageSize: 25, showSizeChanger: true, showTotal: (t) => `${t} employees` }}
        locale={{ emptyText: overCapOnly ? 'Nobody over the limit' : 'Nobody worked overtime here' }}
      />
    </Drawer>
  );
};

export default OvertimeRegisterDrawer;
