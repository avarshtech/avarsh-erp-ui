import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Tag, Button, Space } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { searchEmployees } from '../../../services/employeeService';
import { getActiveDepartments } from '../../../services/hrMasterService';
import { getActiveFactories } from '../../../services/factoryService';
import { hasPermission } from '../../../utils/permissions';
import { EMPLOYEE_STATUS, EMPLOYEE_CATEGORY } from '../../../utils/hrConstants';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';

const EmployeeList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [departmentFilter, setDepartmentFilter] = useState(undefined);
  const [factoryFilter, setFactoryFilter] = useState(undefined);
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [categoryFilter, setCategoryFilter] = useState(undefined);
  const [departments, setDepartments] = useState([]);
  const [factories, setFactories] = useState([]);

  const canAdd = hasPermission('hr-employees', 'add');
  const canUpdate = hasPermission('hr-employees', 'update');

  // Load filter options on mount
  useEffect(() => {
    getActiveDepartments().then(setDepartments).catch(() => {});
    getActiveFactories().then(setFactories).catch(() => {});
  }, []);

  const fetchData = useCallback(async (page, pageSize) => {
    setLoading(true);
    try {
      const result = await searchEmployees({
        search: debouncedSearch || undefined,
        departmentId: departmentFilter,
        factoryId: factoryFilter,
        status: statusFilter,
        category: categoryFilter,
        page: (page || pagination.current) - 1,
        size: pageSize || pagination.pageSize,
        sort: 'id',
        direction: 'desc',
      });
      setData(result.content);
      setPagination((prev) => ({
        ...prev,
        current: (result.number ?? 0) + 1,
        pageSize: result.size,
        total: result.totalElements,
      }));
    } catch {
      message.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, departmentFilter, factoryFilter, statusFilter, categoryFilter, pagination.current, pagination.pageSize, message]);

  useEffect(() => {
    fetchData(1, pagination.pageSize);
  }, [debouncedSearch, departmentFilter, factoryFilter, statusFilter, categoryFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTableChange = (pag) => {
    fetchData(pag.current, pag.pageSize);
  };

  const handleClearFilters = () => {
    setSearchText('');
    setDepartmentFilter(undefined);
    setFactoryFilter(undefined);
    setStatusFilter(undefined);
    setCategoryFilter(undefined);
  };

  const columns = useMemo(() => [
    { title: 'Emp No', dataIndex: 'employeeNo', key: 'employeeNo', width: 120 },
    { title: 'Full Name', dataIndex: 'fullName', key: 'fullName', width: 180 },
    {
      title: 'Department', dataIndex: 'departmentName', key: 'departmentName', width: 150,
    },
    { title: 'Designation', dataIndex: 'designationName', key: 'designationName', width: 150 },
    { title: 'Factory', dataIndex: 'factoryName', key: 'factoryName', width: 140 },
    {
      title: 'Category', dataIndex: 'category', key: 'category', width: 100,
      render: (val) => {
        const opt = EMPLOYEE_CATEGORY.find((c) => c.value === val);
        return opt ? <Tag>{opt.label}</Tag> : val;
      },
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: (val) => {
        const opt = EMPLOYEE_STATUS.find((s) => s.value === val);
        return opt ? <Tag color={opt.color}>{opt.label}</Tag> : val;
      },
    },
    {
      title: 'Date of Joining', dataIndex: 'dateOfJoining', key: 'dateOfJoining', width: 130,
      render: (val) => val ? dayjs(val).format('DD-MMM-YYYY') : '-',
    },
    { title: 'Mobile', dataIndex: 'mobileNumber', key: 'mobileNumber', width: 130 },
    {
      title: 'Actions', key: 'actions', width: 100, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/hr/employees/${record.id}`)} />
          {canUpdate && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); navigate(`/hr/employees/edit/${record.id}`); }} />
          )}
        </Space>
      ),
    },
  ], [navigate, canUpdate]);

  const filters = useMemo(() => [
    {
      key: 'department', type: 'select',
      span: { xs: 24, sm: 12, md: 6, lg: 4 },
      props: {
        placeholder: 'Department',
        value: departmentFilter,
        onChange: setDepartmentFilter,
        options: departments.map((d) => ({ value: d.id, label: d.name })),
      },
    },
    {
      key: 'factory', type: 'select',
      span: { xs: 24, sm: 12, md: 6, lg: 4 },
      props: {
        placeholder: 'Factory',
        value: factoryFilter,
        onChange: setFactoryFilter,
        options: factories.map((f) => ({ value: f.id, label: f.name })),
      },
    },
    {
      key: 'status', type: 'select',
      span: { xs: 24, sm: 12, md: 6, lg: 3 },
      props: {
        placeholder: 'Status',
        value: statusFilter,
        onChange: setStatusFilter,
        options: EMPLOYEE_STATUS,
      },
    },
    {
      key: 'category', type: 'select',
      span: { xs: 24, sm: 12, md: 6, lg: 3 },
      props: {
        placeholder: 'Category',
        value: categoryFilter,
        onChange: setCategoryFilter,
        options: EMPLOYEE_CATEGORY,
      },
    },
  ], [departmentFilter, factoryFilter, statusFilter, categoryFilter, departments, factories]);

  return (
    <>
      <PageHeader title="Employees">
        {canAdd && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/hr/employees/new')}>
            Add Employee
          </Button>
        )}
      </PageHeader>

      <SearchFilterBar
        searchText={searchText}
        onSearchChange={(e) => setSearchText(e.target.value)}
        searchPlaceholder="Search by name, employee no, mobile..."
        filters={filters}
        onClear={handleClearFilters}
        onRefresh={() => fetchData(pagination.current, pagination.pageSize)}
        style={{ marginBottom: 16 }}
      />

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={getTablePagination(pagination, 'employees')}
        onChange={handleTableChange}
        scroll={{ x: 1300 }}
        locale={{ emptyText: <EmptyState description="No employees found" /> }}
        onRow={(record) => ({ onClick: () => navigate(`/hr/employees/${record.id}`), style: { cursor: 'pointer' } })}
      />
    </>
  );
};

export default EmployeeList;
