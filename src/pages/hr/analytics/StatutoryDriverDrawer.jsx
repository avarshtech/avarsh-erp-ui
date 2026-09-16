import { useState, useEffect, useMemo, useCallback } from 'react';
import { Drawer, Table, Typography, Tag } from 'antd';
import { getStatutoryDriver } from '../../../services/hr/hrAnalyticsService';
import { formatRupeesExact, formatSigned } from './bridgeFormat';

const { Text } = Typography;

const money = (v) => (v == null ? <Text type="secondary">not on this run</Text> : formatRupeesExact(v));

/** The employees behind one statutory driver, with the reason where the figures give one. */
const StatutoryDriverDrawer = ({ drill, params, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const fetchRows = useCallback(async () => {
    if (!drill || !params) return;
    setLoading(true);
    try {
      const result = await getStatutoryDriver(drill.statute, drill.code, params);
      setRows(Array.isArray(result) ? result : []);
    } catch {
      setRows([]);
      // axiosInstance already surfaces the server's message.
    } finally {
      setLoading(false);
    }
  }, [drill, params]);

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
      title: 'Wages before', dataIndex: 'wagesBefore', key: 'wagesBefore',
      width: 130, align: 'right', render: money,
    },
    {
      title: 'Wages after', dataIndex: 'wagesAfter', key: 'wagesAfter',
      width: 130, align: 'right', render: money,
    },
    {
      title: 'Employee', key: 'employeeShare', width: 150, align: 'right',
      render: (_, r) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {r.employeeBefore == null ? '-' : formatRupeesExact(r.employeeBefore)}
          {' → '}
          {r.employeeAfter == null ? '-' : formatRupeesExact(r.employeeAfter)}
        </Text>
      ),
    },
    {
      title: 'Employer', key: 'employerShare', width: 150, align: 'right',
      render: (_, r) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {r.employerBefore == null ? '-' : formatRupeesExact(r.employerBefore)}
          {' → '}
          {r.employerAfter == null ? '-' : formatRupeesExact(r.employerAfter)}
        </Text>
      ),
    },
    {
      title: 'Effect', dataIndex: 'amount', key: 'amount',
      width: 135, align: 'right', fixed: 'right',
      sorter: (a, b) => Number(a.amount) - Number(b.amount),
      render: (v) => <Text strong>{formatSigned(v)}</Text>,
    },
  ], []);

  const withNotes = useMemo(() => rows.filter((r) => r.note), [rows]);

  return (
    <Drawer
      title={drill ? `${drill.label} — ${rows.length} employees` : ''}
      open={Boolean(drill)}
      onClose={onClose}
      size={980}
      destroyOnHidden
    >
      {withNotes.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {withNotes.slice(0, 4).map((r) => (
            <div key={r.employeeId}>
              <Tag color="warning">{r.employeeNo}</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>{r.note}</Text>
            </div>
          ))}
          {withNotes.length > 4 && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              …and {withNotes.length - 4} more with the same kind of reason.
            </Text>
          )}
        </div>
      )}
      <Table
        rowKey="employeeId"
        columns={columns}
        dataSource={rows}
        loading={loading}
        size="small"
        scroll={{ x: 1020 }}
        pagination={{ pageSize: 25, showSizeChanger: true, showTotal: (t) => `${t} employees` }}
        locale={{ emptyText: 'Nobody contributed to this' }}
      />
    </Drawer>
  );
};

export default StatutoryDriverDrawer;
