import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Select, Row, Col, Spin } from 'antd';
import dayjs from 'dayjs';
import { getLeaveBalances } from '../../../services/hr/leaveService';
import { searchEmployees } from '../../../services/hr/employeeService';
import { getActiveFactories } from '../../../services/master/factoryService';
import { getActiveDepartmentsByFactory } from '../../../services/master/hrMasterService';
import { factoryOptions } from '../../../utils/hrLabels';
import PageHeader from '../../../components/PageHeader';

const LeaveBalanceView = () => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(dayjs().year());
  const [factories, setFactories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [factoryId, setFactoryId] = useState(undefined);
  const [departmentId, setDepartmentId] = useState(undefined);
  const [employees, setEmployees] = useState([]);
  const [balanceData, setBalanceData] = useState([]);
  const [leaveTypeNames, setLeaveTypeNames] = useState([]);

  useEffect(() => {
    getActiveFactories().then(setFactories).catch(() => {});
  }, []);

  useEffect(() => {
    if (factoryId) {
      getActiveDepartmentsByFactory(factoryId).then(setDepartments).catch(() => {});
    } else {
      setDepartments([]);
    }
    setDepartmentId(undefined);
  }, [factoryId]);

  useEffect(() => {
    if (factoryId) {
      searchEmployees({ factoryId, departmentId, status: 'ACTIVE', size: 500 })
        .then((res) => setEmployees(res.content || []))
        .catch(() => setEmployees([]));
    } else {
      setEmployees([]);
    }
  }, [factoryId, departmentId]);

  const fetchBalances = useCallback(async () => {
    if (!employees.length) {
      setBalanceData([]);
      setLeaveTypeNames([]);
      return;
    }
    setLoading(true);
    try {
      const allBalances = await Promise.all(
        employees.map(async (emp) => {
          try {
            const balances = await getLeaveBalances(emp.id, year);
            return { employee: emp, balances: balances || [] };
          } catch {
            return { employee: emp, balances: [] };
          }
        })
      );

      // Collect unique leave type names
      const typeSet = new Map();
      allBalances.forEach(({ balances }) => {
        balances.forEach((b) => {
          if (!typeSet.has(b.leaveTypeId)) {
            typeSet.set(b.leaveTypeId, b.leaveTypeName || `Type ${b.leaveTypeId}`);
          }
        });
      });
      const types = Array.from(typeSet.entries()).map(([id, name]) => ({ id, name }));
      setLeaveTypeNames(types);

      // Build table data
      const rows = allBalances.map(({ employee, balances }) => {
        const row = {
          key: employee.id,
          employeeNo: employee.employeeNo,
          employeeName: employee.fullName,
        };
        balances.forEach((b) => {
          row[`lt_${b.leaveTypeId}`] = b.balance;
        });
        return row;
      });
      setBalanceData(rows);
    } catch {
      message.error('Failed to load leave balances');
    } finally {
      setLoading(false);
    }
  }, [employees, year, message]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  const yearOptions = useMemo(() => {
    const currentYear = dayjs().year();
    return Array.from({ length: 5 }, (_, i) => ({
      value: currentYear - 2 + i,
      label: String(currentYear - 2 + i),
    }));
  }, []);

  const columns = useMemo(() => {
    const baseCols = [
      { title: 'Emp No', dataIndex: 'employeeNo', key: 'employeeNo', width: 100, fixed: 'left' },
      { title: 'Employee Name', dataIndex: 'employeeName', key: 'employeeName', width: 180, fixed: 'left' },
    ];
    const typeCols = leaveTypeNames.map((lt) => ({
      title: lt.name,
      dataIndex: `lt_${lt.id}`,
      key: `lt_${lt.id}`,
      width: 100,
      align: 'center',
      render: (val) => val ?? '-',
    }));
    return [...baseCols, ...typeCols];
  }, [leaveTypeNames]);

  return (
    <>
      <PageHeader title="Leave Balances" />
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6} md={4}>
          <Select
            value={year}
            onChange={setYear}
            options={yearOptions}
            style={{ width: '100%' }}
          />
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Select
            placeholder="Select Factory"
            allowClear
            style={{ width: '100%' }}
            value={factoryId}
            onChange={setFactoryId}
            options={factoryOptions(factories)}
          />
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Select
            placeholder="Select Department"
            allowClear
            style={{ width: '100%' }}
            value={departmentId}
            onChange={setDepartmentId}
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
            disabled={!factoryId}
          />
        </Col>
      </Row>
      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={balanceData}
          rowKey="key"
          scroll={{ x: 400 + leaveTypeNames.length * 100 }}
          size="small"
          bordered
          pagination={{ pageSize: 50, showSizeChanger: true }}
        />
      </Spin>
    </>
  );
};

export default LeaveBalanceView;
