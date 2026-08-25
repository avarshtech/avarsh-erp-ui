import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Select, Row, Col, Spin } from 'antd';
import dayjs from 'dayjs';
import { getLeaveBalancesBulk } from '../../../services/hr/leaveService';
import { searchEmployees } from '../../../services/hr/employeeService';
import { getActiveFactories } from '../../../services/master/factoryService';
import { getActiveDepartmentsByFactory } from '../../../services/master/hrMasterService';
import { factoryOptions } from '../../../utils/hrLabels';
import PageHeader from '../../../components/PageHeader';

const LeaveBalanceView = () => {
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
      // One request for the whole page. This used to be one per employee, with
      // each failure swallowed into an empty array - so a server error looked
      // exactly like an employee who had taken no leave.
      const balances = await getLeaveBalancesBulk(employees.map((e) => e.id), year);
      const list = Array.isArray(balances) ? balances : [];

      const byEmployee = new Map();
      const typeSet = new Map();
      list.forEach((b) => {
        if (!typeSet.has(b.leaveTypeId)) {
          typeSet.set(b.leaveTypeId, b.leaveTypeName || `Type ${b.leaveTypeId}`);
        }
        if (!byEmployee.has(b.employeeId)) byEmployee.set(b.employeeId, []);
        byEmployee.get(b.employeeId).push(b);
      });

      setLeaveTypeNames(Array.from(typeSet.entries()).map(([id, name]) => ({ id, name })));

      setBalanceData(employees.map((employee) => {
        const row = {
          key: employee.id,
          employeeNo: employee.employeeNo,
          employeeName: employee.fullName,
        };
        // closingBalance is the field the API returns; the grid read "balance",
        // which does not exist on the DTO, so every cell rendered empty.
        (byEmployee.get(employee.id) || []).forEach((b) => {
          row[`lt_${b.leaveTypeId}`] = b.closingBalance;
        });
        return row;
      }));
    } catch {
      setBalanceData([]);
      setLeaveTypeNames([]);
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setLoading(false);
    }
  }, [employees, year]);

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
