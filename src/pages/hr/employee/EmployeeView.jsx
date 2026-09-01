import { useState, useEffect, useCallback } from 'react';
import {
  App, Descriptions, Tag, Table, Tabs, Button, Space, Dropdown, Spin, Card, DatePicker,
} from 'antd';
import { EditOutlined, DownOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getEmployeeById, changeEmployeeStatus } from '../../../services/hr/employeeService';
import { getSalaryStructuresByEmployee } from '../../../services/hr/salaryStructureService';
import { hasPermission } from '../../../utils/permissions';
import {
  EMPLOYEE_STATUS, EMPLOYEE_TYPE, GENDER_OPTIONS, MARITAL_STATUS,
  PAYMENT_MODES, DOCUMENT_TYPES, EMPLOYEE_CATEGORY,
} from '../../../utils/hrConstants';
import { isStoredFile, isOpenableLink, downloadStoredFile } from '../../../utils/documentFile';
import PageHeader from '../../../components/PageHeader';
import SalaryStructureDrawer from './SalaryStructureDrawer';

const getLabel = (list, value) => list.find((i) => i.value === value)?.label || value || '-';
const getStatusColor = (status) => EMPLOYEE_STATUS.find((s) => s.value === status)?.color || 'default';


/**
 * Read-only view of one document row's file.
 *
 * Downloads an uploaded file through the API; a legacy value is opened as a
 * link when it looks like one, and otherwise shown as the plain text it is.
 */
const DocumentFileLink = ({ value, fileName }) => {
  const [busy, setBusy] = useState(false);

  if (!value) return '-';

  if (isStoredFile(value)) {
    const download = async () => {
      setBusy(true);
      try {
        await downloadStoredFile(value, fileName);
      } catch {
        // axiosInstance already toasts the server's message.
      } finally {
        setBusy(false);
      }
    };
    return (
      <Button type="link" size="small" loading={busy} onClick={download} style={{ padding: 0 }}>
        {fileName || 'View'}
      </Button>
    );
  }

  if (isOpenableLink(value)) {
    return <a href={value} target="_blank" rel="noopener noreferrer">View</a>;
  }

  return <span title="Recorded before documents could be uploaded">{value}</span>;
};

const EmployeeView = () => {
  const { message, modal } = App.useApp();
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState(null);
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [salaryDrawerOpen, setSalaryDrawerOpen] = useState(false);
  const [editSalary, setEditSalary] = useState(null);

  const canUpdate = hasPermission('hr-employees', 'update');

  const loadEmployee = useCallback(async () => {
    setLoading(true);
    try {
      const emp = await getEmployeeById(id);
      setEmployee(emp);
    } catch {
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadSalaryHistory = useCallback(async () => {
    try {
      const data = await getSalaryStructuresByEmployee(id);
      setSalaryHistory(data);
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => { loadEmployee(); loadSalaryHistory(); }, [loadEmployee, loadSalaryHistory]);

  const applyStatusChange = async (status, dateOfLeaving) => {
    try {
      await changeEmployeeStatus(id, status, dateOfLeaving);
      message.success(`Status changed to ${getLabel(EMPLOYEE_STATUS, status)}`);
      loadEmployee();
    } catch {
      // axiosInstance already toasts the server's message; adding another here showed two.
    }
  };

  /**
   * Moving off ACTIVE is the moment the last working day is known, and it used
   * to be recorded nowhere - so the leaver's final payroll could not tell they
   * had gone, and their unworked days were reported as loss of pay. Asking here
   * beats expecting someone to remember a field on the edit form.
   */
  const handleStatusChange = (status) => {
    if (status === 'ACTIVE') {
      modal.confirm({
        title: 'Set this employee back to Active?',
        content: 'Any recorded last working day will be cleared.',
        okText: 'Set Active',
        onOk: () => applyStatusChange(status),
      });
      return;
    }

    let leaving = dayjs();
    modal.confirm({
      title: `Change status to ${getLabel(EMPLOYEE_STATUS, status)}`,
      content: (
        <div>
          <p style={{ marginBottom: 8 }}>
            Last working day. Payroll uses this to pro-rate the final month and to
            flag that the employee left partway through it.
          </p>
          <DatePicker
            style={{ width: '100%' }}
            format="DD-MMM-YYYY"
            defaultValue={leaving}
            onChange={(d) => { leaving = d; }}
          />
        </div>
      ),
      okText: 'Change Status',
      okButtonProps: { danger: true },
      onOk: () => {
        if (!leaving) {
          message.error('A last working day is required');
          return Promise.reject(new Error('date required'));
        }
        return applyStatusChange(status, leaving.format('YYYY-MM-DD'));
      },
    });
  };

  if (loading) return <Spin size="large" style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />;
  if (!employee) return null;

  const statusMenuItems = EMPLOYEE_STATUS
    .filter((s) => s.value !== employee.status)
    .map((s) => ({ key: s.value, label: s.label }));

  const stat = employee.statutory || {};
  const bank = employee.bankDetails || {};

  const tabItems = [
    {
      key: 'details',
      label: 'Details',
      children: (
        <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label="Employee No">{employee.employeeNo}</Descriptions.Item>
          <Descriptions.Item label="Full Name">{employee.fullName}</Descriptions.Item>
          <Descriptions.Item label="Father/Husband Name">{employee.fatherHusbandName || '-'}</Descriptions.Item>
          <Descriptions.Item label="Gender">{getLabel(GENDER_OPTIONS, employee.gender)}</Descriptions.Item>
          <Descriptions.Item label="Date of Birth">{employee.dateOfBirth ? dayjs(employee.dateOfBirth).format('DD-MMM-YYYY') : '-'}</Descriptions.Item>
          <Descriptions.Item label="Marital Status">{getLabel(MARITAL_STATUS, employee.maritalStatus)}</Descriptions.Item>
          <Descriptions.Item label="Blood Group">{employee.bloodGroup || '-'}</Descriptions.Item>
          <Descriptions.Item label="Mobile">{employee.mobileNumber || '-'}</Descriptions.Item>
          <Descriptions.Item label="Emergency Contact">{employee.emergencyContactName ? `${employee.emergencyContactName} (${employee.emergencyContactPhone || ''})` : '-'}</Descriptions.Item>
          <Descriptions.Item label="Department">{employee.departmentName || '-'}</Descriptions.Item>
          <Descriptions.Item label="Designation">{employee.designationName || '-'}</Descriptions.Item>
          <Descriptions.Item label="Factory">{employee.factoryName || '-'}</Descriptions.Item>
          <Descriptions.Item label="Category">{getLabel(EMPLOYEE_CATEGORY, employee.category)}</Descriptions.Item>
          <Descriptions.Item label="Employee Type">{getLabel(EMPLOYEE_TYPE, employee.employeeType)}</Descriptions.Item>
          <Descriptions.Item label="Grade">{employee.grade ? employee.grade.replace('_', '+') : '-'}</Descriptions.Item>
          <Descriptions.Item label="Date of Joining">{employee.dateOfJoining ? dayjs(employee.dateOfJoining).format('DD-MMM-YYYY') : '-'}</Descriptions.Item>
          {employee.dateOfLeaving && (
            <Descriptions.Item label="Date of Leaving">
              {dayjs(employee.dateOfLeaving).format('DD-MMM-YYYY')}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Reporting Manager">{employee.reportingManagerName || '-'}</Descriptions.Item>
          <Descriptions.Item label="Migrant Worker">{employee.isMigrantWorker ? 'Yes' : 'No'}</Descriptions.Item>
          <Descriptions.Item label="Present Address" span={3}>{employee.presentAddress || '-'}</Descriptions.Item>
          <Descriptions.Item label="Permanent Address" span={3}>{employee.permanentAddress || '-'}</Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'statutory',
      label: 'Statutory',
      children: (
        <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label="PF Applicable">{stat.pfApplicable ? 'Yes' : 'No'}</Descriptions.Item>
          <Descriptions.Item label="PF Number">{stat.pfNumber || '-'}</Descriptions.Item>
          <Descriptions.Item label="UAN Number">{stat.uanNumber || '-'}</Descriptions.Item>
          <Descriptions.Item label="ESI Applicable">{stat.esiApplicable ? 'Yes' : 'No'}</Descriptions.Item>
          <Descriptions.Item label="ESI Number">{stat.esiNumber || '-'}</Descriptions.Item>
          <Descriptions.Item label="PT Applicable">{stat.ptApplicable ? 'Yes' : 'No'}</Descriptions.Item>
          <Descriptions.Item label="LWF Applicable">{stat.lwfApplicable ? 'Yes' : 'No'}</Descriptions.Item>
          <Descriptions.Item label="TDS Applicable">{stat.tdsApplicable ? 'Yes' : 'No'}</Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'bank',
      label: 'Bank',
      children: (
        <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label="Account Number">{bank.accountNumber || '-'}</Descriptions.Item>
          <Descriptions.Item label="IFSC Code">{bank.ifscCode || '-'}</Descriptions.Item>
          <Descriptions.Item label="Bank Name">{bank.bankName || '-'}</Descriptions.Item>
          <Descriptions.Item label="Branch Name">{bank.branchName || '-'}</Descriptions.Item>
          <Descriptions.Item label="Payment Mode">{getLabel(PAYMENT_MODES, bank.paymentMode)}</Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'nominees',
      label: 'Nominees',
      children: (
        <Table
          rowKey={(r) => r.id || r.nomineeName}
          dataSource={employee.nominees || []}
          pagination={false}
          size="small"
          columns={[
            { title: 'Name', dataIndex: 'nomineeName', key: 'nomineeName' },
            { title: 'Relationship', dataIndex: 'relationship', key: 'relationship' },
            { title: 'Share %', dataIndex: 'sharePercentage', key: 'sharePercentage' },
            { title: 'Minor', dataIndex: 'isMinor', key: 'isMinor', render: (v) => v ? 'Yes' : 'No' },
            { title: 'Guardian', dataIndex: 'guardianName', key: 'guardianName', render: (v) => v || '-' },
          ]}
        />
      ),
    },
    {
      key: 'documents',
      label: 'Documents',
      children: (
        <Table
          rowKey={(r) => r.id || r.documentType}
          dataSource={employee.documents || []}
          pagination={false}
          size="small"
          columns={[
            { title: 'Type', dataIndex: 'documentType', key: 'documentType', render: (v) => getLabel(DOCUMENT_TYPES, v) },
            {
              title: 'File',
              dataIndex: 'fileUrl',
              key: 'fileUrl',
              // An uploaded file is a UUID, not a URL. Rendering it as an href
              // made the browser resolve it against the current path, so View
              // navigated to /hr/employees/<uuid> and the router read the uuid
              // as an employee id.
              render: (v, row) => <DocumentFileLink value={v} fileName={row.fileName} />,
            },
            { title: 'Remarks', dataIndex: 'remarks', key: 'remarks', render: (v) => v || '-' },
          ]}
        />
      ),
    },
    {
      key: 'salary',
      label: 'Salary History',
      children: (
        <Card
          size="small"
          extra={canUpdate && <Button type="primary" size="small" onClick={() => { setEditSalary(null); setSalaryDrawerOpen(true); }}>Add Salary Structure</Button>}
        >
          <Table
            rowKey="id"
            dataSource={salaryHistory}
            pagination={false}
            size="small"
            columns={[
              {
                title: 'Status', dataIndex: 'isCurrent', key: 'isCurrent', width: 110,
                render: (isCurrent) => isCurrent
                  ? <Tag color="success">Active</Tag>
                  : <Tag>Superseded</Tag>,
              },
              { title: 'Effective From', dataIndex: 'effectiveFrom', key: 'effectiveFrom', render: (v) => v ? dayjs(v).format('DD-MMM-YYYY') : '-' },
              {
                title: 'Effective To', dataIndex: 'effectiveTo', key: 'effectiveTo',
                render: (v) => v ? dayjs(v).format('DD-MMM-YYYY') : '—',
              },
              { title: 'Basic', dataIndex: 'basic', key: 'basic', render: (v) => v?.toLocaleString('en-IN') },
              { title: 'DA', dataIndex: 'da', key: 'da', render: (v) => v?.toLocaleString('en-IN') || '0' },
              { title: 'HRA', dataIndex: 'hra', key: 'hra', render: (v) => v?.toLocaleString('en-IN') || '0' },
              { title: 'Gross', dataIndex: 'grossSalary', key: 'grossSalary', render: (v) => v?.toLocaleString('en-IN') },
              ...(canUpdate ? [{
                // Superseded rows are closed history - editing them would break the
                // effectiveFrom/effectiveTo chain, so only the active row is editable.
                title: 'Action', key: 'action', width: 80,
                render: (_, rec) => rec.isCurrent
                  ? <Button type="link" size="small" onClick={() => { setEditSalary(rec); setSalaryDrawerOpen(true); }}>Edit</Button>
                  : null,
              }] : []),
            ]}
          />
        </Card>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={employee.fullName}
        backPath="/hr/employees"
        status={<Tag color={getStatusColor(employee.status)}>{getLabel(EMPLOYEE_STATUS, employee.status)}</Tag>}
      >
        <Space>
          {canUpdate && (
            <>
              <Button icon={<EditOutlined />} onClick={() => navigate(`/hr/employees/edit/${id}`)}>Edit</Button>
              <Dropdown
                menu={{ items: statusMenuItems, onClick: ({ key }) => handleStatusChange(key) }}
                trigger={['click']}
              >
                <Button>Change Status <DownOutlined /></Button>
              </Dropdown>
            </>
          )}
        </Space>
      </PageHeader>

      <Tabs items={tabItems} />

      <SalaryStructureDrawer
        open={salaryDrawerOpen}
        onClose={() => { setSalaryDrawerOpen(false); setEditSalary(null); }}
        employeeId={Number(id)}
        employeeName={employee.fullName}
        currentStructure={salaryHistory.find((s) => s.isCurrent) || null}
        editData={editSalary}
        onSuccess={() => { setSalaryDrawerOpen(false); setEditSalary(null); loadSalaryHistory(); }}
      />
    </>
  );
};

export default EmployeeView;
