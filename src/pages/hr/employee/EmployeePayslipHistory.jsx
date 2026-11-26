import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Table, Tag, Button, Empty, Space, Typography } from 'antd';
import { EyeOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getEmployeeSalaryRecords } from '../../../services/hr/payrollService';
import { PAYROLL_STATUS } from '../../../utils/hrConstants';
import { hasPermission } from '../../../utils/permissions';
import { formatRupees } from '../../../utils/formatters';
import SalaryRecordDrawer from '../payroll/SalaryRecordDrawer';

const { Text } = Typography;

const statusMap = Object.fromEntries(PAYROLL_STATUS.map((s) => [s.value, s]));

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Days read as 22.5, not 22.50, and a missing count as a dash. */
const days = (v) => (v == null ? '-' : String(Number(v)));

/**
 * What this employee has actually been paid, month by month, with each month's payslip.
 *
 * <p>The tab was called Salary History and showed salary structures - what the employee
 * is entitled to, and what it was before the last revision. Useful, and not the history
 * anybody comes to this screen for: an employee asking what went into last December, or
 * HR checking a year of net pay before a loan, needs the months that were run, not the
 * contract behind them. Both belong here, structures below and paid months above.</p>
 *
 * <p>Nothing is recalculated. Each row is the salary record payroll wrote at the time,
 * so a revised structure does not rewrite what an earlier month paid - and the payslip
 * opens the same screen the run itself links to, rather than a second rendering of the
 * same figures that could drift from it.</p>
 *
 * <p>Behind the payroll permission, not the employee one. Someone who may open an
 * employee's record is not thereby allowed to read what everybody earns, so without it
 * the section is absent rather than empty or forbidden.</p>
 */
const EmployeePayslipHistory = ({ employeeId }) => {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  // Clicking a month opens the derivation behind its figures - the same drawer the
  // payroll run review uses, so the two never explain a figure differently.
  const [selected, setSelected] = useState(null);

  const canViewPayroll = hasPermission('hr-payroll', 'view');

  const load = useCallback(async () => {
    if (!canViewPayroll || !employeeId) return;
    setLoading(true);
    try {
      const data = await getEmployeeSalaryRecords(employeeId);
      setRecords(Array.isArray(data) ? data : []);
    } catch {
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setLoading(false);
    }
  }, [employeeId, canViewPayroll]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    {
      title: 'Month',
      key: 'period',
      width: 120,
      render: (_, r) => <strong>{`${MONTH_SHORT[(r.month || 1) - 1]} ${r.year || ''}`}</strong>,
    },
    {
      // A draft or processed month is on screen because hiding it would leave a gap
      // nobody could explain, but its figures are not final and must not be read as
      // a payment. The tag is the whole difference.
      title: 'Run',
      dataIndex: 'payrollRunStatus',
      key: 'payrollRunStatus',
      width: 110,
      render: (v) => <Tag color={statusMap[v]?.color || 'default'}>{statusMap[v]?.label || v || '-'}</Tag>,
    },
    { title: 'Payable Days', dataIndex: 'payableDays', key: 'payableDays', width: 110, align: 'right', render: days },
    { title: 'LOP', dataIndex: 'lopDays', key: 'lopDays', width: 80, align: 'right', render: days },
    { title: 'Earnings', dataIndex: 'totalEarnings', key: 'totalEarnings', width: 130, align: 'right', render: formatRupees },
    { title: 'Deductions', dataIndex: 'totalDeductions', key: 'totalDeductions', width: 130, align: 'right', render: formatRupees },
    {
      title: 'Net Paid',
      dataIndex: 'netSalary',
      key: 'netSalary',
      width: 130,
      align: 'right',
      render: (v) => <strong>{formatRupees(v)}</strong>,
    },
    {
      title: 'Payslip',
      key: 'slip',
      width: 90,
      fixed: 'right',
      render: (_, r) => (
        <Button
          type="link"
          size="small"
          icon={<FileTextOutlined />}
          // Rows open the breakdown drawer, so the payslip link must not do both.
          onClick={(e) => { e.stopPropagation(); navigate(`/hr/payroll/slip/${r.id}`); }}
        >
          Open
        </Button>
      ),
    },
  ], [navigate]);

  if (!canViewPayroll) return null;

  return (
    <>
      <Card
        size="small"
        title="Salaries Paid"
        extra={(
          <Space size={4}>
            <EyeOutlined style={{ color: '#8c8c8c' }} />
            <Text type="secondary" style={{ fontSize: 12 }}>Click a month for the full breakdown</Text>
          </Space>
        )}
      >
        <Table
          rowKey="id"
          dataSource={records}
          loading={loading}
          columns={columns}
          size="small"
          pagination={records.length > 12 ? { pageSize: 12, size: 'small' } : false}
          scroll={{ x: 'max-content' }}
          onRow={(record) => ({
            onClick: () => setSelected(record),
            style: { cursor: 'pointer' },
          })}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No payroll has been run for this employee yet."
              />
            ),
          }}
        />
      </Card>

      <SalaryRecordDrawer
        record={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
};

export default EmployeePayslipHistory;
