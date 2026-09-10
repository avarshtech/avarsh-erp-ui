import { useState, useEffect, useMemo, useCallback } from 'react';
import { Drawer, Table, Typography, Alert } from 'antd';
import { getPayrollBridgeDriver } from '../../../services/hr/hrAnalyticsService';
import { formatRupeesExact, formatSigned } from './bridgeFormat';

const { Text } = Typography;

/**
 * The employees behind one bridge row.
 *
 * The server derives these from the same per-employee arithmetic that produced
 * the headline figure, so the column total here always equals the row that was
 * clicked. That is the point of the drill-down - an explanation you can follow
 * down to a name rather than one you have to take on trust.
 */
const BridgeDriverDrawer = ({ driver, params, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const fetchRows = useCallback(async () => {
    if (!driver) return;
    setLoading(true);
    try {
      const result = await getPayrollBridgeDriver(driver.code, params);
      setRows(Array.isArray(result) ? result : []);
    } catch {
      setRows([]);
      // axiosInstance already surfaces the server's message.
    } finally {
      setLoading(false);
    }
  }, [driver, params]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const columns = useMemo(() => [
    {
      title: 'Employee', key: 'employee', width: 210, ellipsis: true,
      render: (_, r) => (
        <>
          <div>{r.employeeName || '-'}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.employeeNo}</Text>
        </>
      ),
    },
    { title: 'Department', dataIndex: 'departmentName', key: 'departmentName', width: 140, ellipsis: true },
    {
      title: 'Before', dataIndex: 'openingValue', key: 'openingValue',
      width: 130, align: 'right',
      render: (v) => (v == null ? <Text type="secondary">not on this run</Text> : formatRupeesExact(v)),
    },
    {
      title: 'After', dataIndex: 'closingValue', key: 'closingValue',
      width: 130, align: 'right',
      render: (v) => (v == null ? <Text type="secondary">not on this run</Text> : formatRupeesExact(v)),
    },
    {
      title: 'Contribution', dataIndex: 'amount', key: 'amount',
      width: 140, align: 'right', fixed: 'right',
      sorter: (a, b) => Number(a.amount) - Number(b.amount),
      render: (v) => <Text strong>{formatSigned(v)}</Text>,
    },
  ], []);

  const total = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    [rows],
  );

  return (
    <Drawer
      title={driver ? driver.label : ''}
      open={Boolean(driver)}
      onClose={onClose}
      size={760}
      destroyOnHidden
    >
      {driver && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title={`${rows.length} employee${rows.length === 1 ? '' : 's'}, totalling ${formatSigned(total)}`}
          description="This total is the same figure as the row you selected — the two are computed from one calculation."
        />
      )}
      <Table
        rowKey="employeeId"
        columns={columns}
        dataSource={rows}
        loading={loading}
        size="small"
        scroll={{ x: 750 }}
        pagination={{ pageSize: 25, showSizeChanger: true, showTotal: (t) => `${t} employees` }}
        locale={{ emptyText: 'No employees contributed to this driver' }}
      />
    </Drawer>
  );
};

export default BridgeDriverDrawer;
