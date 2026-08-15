import { useState, useEffect, useCallback } from 'react';
import {
  App, Form, Input, Select, DatePicker, Switch, Button, Tabs, Card,
  Row, Col, InputNumber, Table, Space, Spin,
} from 'antd';
import { SaveOutlined, ArrowLeftOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getEmployeeById, createEmployee, updateEmployee } from '../../../services/hr/employeeService';
import {
  getActiveDepartmentsByFactory, getActiveDesignationsByDepartment, getActiveShifts,
} from '../../../services/master/hrMasterService';
import { getActiveFactories } from '../../../services/master/factoryService';
import { searchEmployees } from '../../../services/hr/employeeService';
import {
  EMPLOYEE_STATUS, EMPLOYEE_TYPE, GENDER_OPTIONS, MARITAL_STATUS,
  BLOOD_GROUPS, PAYMENT_MODES, DOCUMENT_TYPES, RELATIONSHIP_TYPES,
  EMPLOYEE_CATEGORY, EMPLOYEE_GRADE,
} from '../../../utils/hrConstants';
import PageHeader from '../../../components/PageHeader';
import { factoryOptions } from '../../../utils/hrLabels';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';

const { TextArea } = Input;

/**
 * Maps each validated field to the tab that renders it.
 *
 * Antd mounts a tab pane only once it has been visited, so a Form.Item on an
 * unvisited tab never registers and validateFields() silently skips it. Every
 * pane is now force-rendered (see tabItems), which means validation can fail on
 * a field the user cannot see - this map lets us jump them to the right tab.
 */
const FIELD_TAB = {
  fullName: 'personal',
  gender: 'personal',
  dateOfBirth: 'personal',
  maritalStatus: 'personal',
  mobileNumber: 'personal',
  presentAddress: 'personal',
  aadharNumber: 'personal',
  panNumber: 'personal',
  employeeNo: 'employment',
  departmentId: 'employment',
  designationId: 'employment',
  factoryId: 'employment',
  shiftId: 'employment',
  category: 'employment',
  employeeType: 'employment',
  dateOfJoining: 'employment',
  ifscCode: 'bank',
};

const TAB_LABEL = {
  personal: 'Personal',
  employment: 'Employment',
  statutory: 'Statutory',
  bank: 'Bank & Nominees',
  documents: 'Documents',
};

// Indian mobile, optionally prefixed with +91.
const MOBILE_PATTERN = /^(\+91[-\s]?)?[6-9]\d{9}$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAAR_PATTERN = /^\d{12}$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const MIN_WORKING_AGE = 14;

const EmployeeForm = () => {
  const { message } = App.useApp();
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const { clearDirty } = useUnsavedChanges(isDirty);
  const isEdit = Boolean(id);

  // Dropdown options
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [factories, setFactories] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [managers, setManagers] = useState([]);
  const [nominees, setNominees] = useState([]);
  const [documents, setDocuments] = useState([]);

  // Departments belong to a factory and designations to a department. Loading
  // all of them let a user pick a department from another factory, which saves
  // fine but leaves the employee unfindable by department on the attendance
  // calendar. Each level is now scoped to its parent.
  const watchedFactoryId = Form.useWatch('factoryId', form);
  const watchedDepartmentId = Form.useWatch('departmentId', form);

  useEffect(() => {
    getActiveFactories().then(setFactories).catch(() => {});
    getActiveShifts().then(setShifts).catch(() => {});
  }, []);

  useEffect(() => {
    if (!watchedFactoryId) {
      setDepartments([]);
      return;
    }
    getActiveDepartmentsByFactory(watchedFactoryId).then(setDepartments).catch(() => setDepartments([]));
  }, [watchedFactoryId]);

  useEffect(() => {
    if (!watchedDepartmentId) {
      setDesignations([]);
      return;
    }
    getActiveDesignationsByDepartment(watchedDepartmentId).then(setDesignations).catch(() => setDesignations([]));
  }, [watchedDepartmentId]);

  // Load employee for edit
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getEmployeeById(id)
      .then((emp) => {
        form.setFieldsValue({
          ...emp,
          dateOfBirth: emp.dateOfBirth ? dayjs(emp.dateOfBirth) : null,
          dateOfJoining: emp.dateOfJoining ? dayjs(emp.dateOfJoining) : null,
          ...(emp.statutory || {}),
          ...(emp.bankDetails || {}),
        });
        setNominees(emp.nominees || []);
        setDocuments(emp.documents || []);
      })
      .catch(() => message.error('Failed to load employee'))
      .finally(() => setLoading(false));
  }, [id, form, message]);

  // Manager search
  const handleManagerSearch = useCallback(async (val) => {
    if (!val || val.length < 2) return;
    try {
      const result = await searchEmployees({ search: val, status: 'ACTIVE', size: 10 });
      setManagers(result.content.filter((e) => String(e.id) !== String(id)));
    } catch { /* ignore */ }
  }, [id]);

  /** Nominees live in local state, not the Form, so they need checking by hand. */
  const validateNominees = () => {
    if (!nominees.length) return null;

    const incomplete = nominees.findIndex((n) => !n.nomineeName?.trim() || !n.relationship);
    if (incomplete !== -1) {
      return `Nominee ${incomplete + 1}: name and relationship are required`;
    }

    const minorWithoutGuardian = nominees.findIndex((n) => n.isMinor && !n.guardianName?.trim());
    if (minorWithoutGuardian !== -1) {
      return `Nominee ${minorWithoutGuardian + 1}: a guardian is required for a minor`;
    }

    const totalShare = nominees.reduce((sum, n) => sum + (Number(n.sharePercentage) || 0), 0);
    if (Math.round(totalShare * 100) / 100 !== 100) {
      return `Nominee shares must total 100% (currently ${totalShare}%)`;
    }

    return null;
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const nomineeError = validateNominees();
      if (nomineeError) {
        setActiveTab('bank');
        message.error(nomineeError);
        return;
      }

      const documentError = documents.some((d) => !d.documentType)
        ? 'Every document row needs a type. Remove blank rows or pick a type.'
        : null;
      if (documentError) {
        setActiveTab('documents');
        message.error(documentError);
        return;
      }

      setSaving(true);

      const payload = {
        ...values,
        dateOfBirth: values.dateOfBirth?.format('YYYY-MM-DD'),
        dateOfJoining: values.dateOfJoining?.format('YYYY-MM-DD'),
        statutory: {
          pfApplicable: values.pfApplicable || false,
          pfNumber: values.pfNumber,
          uanNumber: values.uanNumber,
          esiApplicable: values.esiApplicable || false,
          esiNumber: values.esiNumber,
          ptApplicable: values.ptApplicable || false,
          lwfApplicable: values.lwfApplicable || false,
          tdsApplicable: values.tdsApplicable || false,
        },
        bankDetails: {
          accountNumber: values.accountNumber,
          ifscCode: values.ifscCode,
          bankName: values.bankName,
          branchName: values.branchName,
          paymentMode: values.paymentMode,
        },
        nominees,
        documents,
      };

      // Remove flattened fields
      ['pfApplicable', 'pfNumber', 'uanNumber', 'esiApplicable', 'esiNumber',
        'ptApplicable', 'lwfApplicable', 'tdsApplicable',
        'accountNumber', 'ifscCode', 'bankName', 'branchName', 'paymentMode',
      ].forEach((k) => delete payload[k]);

      if (isEdit) {
        await updateEmployee(id, payload);
        message.success('Employee updated successfully');
      } else {
        await createEmployee(payload);
        message.success('Employee created successfully');
      }
      clearDirty();
      navigate('/hr/employees');
    } catch (err) {
      // Form validation failure: jump to the tab holding the first bad field
      // and say what is wrong. Previously this returned silently, so clicking
      // Save with an error on a hidden tab appeared to do nothing at all.
      if (err?.errorFields?.length) {
        const first = err.errorFields[0];
        const fieldName = Array.isArray(first.name) ? first.name[0] : first.name;
        const tab = FIELD_TAB[fieldName];
        if (tab) setActiveTab(tab);
        const reason = first.errors?.[0] || 'This field is required';
        message.error(tab ? `${reason} (${TAB_LABEL[tab]} tab)` : reason);
        return;
      }
      message.error(err?.response?.data?.message || 'Failed to save employee');
    } finally {
      setSaving(false);
    }
  };

  const addNominee = () => setNominees((prev) => [...prev, { key: Date.now(), nomineeName: '', relationship: '', sharePercentage: 0, isMinor: false, guardianName: '' }]);
  const removeNominee = (key) => setNominees((prev) => prev.filter((n) => (n.key || n.id) !== key));

  const addDocument = () => setDocuments((prev) => [...prev, { key: Date.now(), documentType: '', fileUrl: '', remarks: '' }]);
  const removeDocument = (key) => setDocuments((prev) => prev.filter((d) => (d.key || d.id) !== key));

  const nomineeColumns = [
    { title: 'Name', dataIndex: 'nomineeName', key: 'nomineeName', render: (_, rec, idx) => <Input value={rec.nomineeName} onChange={(e) => { const arr = [...nominees]; arr[idx] = { ...arr[idx], nomineeName: e.target.value }; setNominees(arr); setIsDirty(true); }} /> },
    { title: 'Relationship', dataIndex: 'relationship', key: 'relationship', width: 150, render: (_, rec, idx) => <Select showSearch optionFilterProp="label" value={rec.relationship} onChange={(v) => { const arr = [...nominees]; arr[idx] = { ...arr[idx], relationship: v }; setNominees(arr); setIsDirty(true); }} options={RELATIONSHIP_TYPES.map((r) => ({ value: r, label: r }))} style={{ width: '100%' }} /> },
    { title: 'Share %', dataIndex: 'sharePercentage', key: 'sharePercentage', width: 100, render: (_, rec, idx) => <InputNumber min={0} max={100} value={rec.sharePercentage} onChange={(v) => { const arr = [...nominees]; arr[idx] = { ...arr[idx], sharePercentage: v }; setNominees(arr); setIsDirty(true); }} style={{ width: '100%' }} /> },
    { title: 'Minor?', dataIndex: 'isMinor', key: 'isMinor', width: 80, render: (_, rec, idx) => <Switch checked={rec.isMinor} onChange={(v) => { const arr = [...nominees]; arr[idx] = { ...arr[idx], isMinor: v }; setNominees(arr); setIsDirty(true); }} /> },
    { title: 'Guardian', dataIndex: 'guardianName', key: 'guardianName', render: (_, rec, idx) => <Input value={rec.guardianName} disabled={!rec.isMinor} onChange={(e) => { const arr = [...nominees]; arr[idx] = { ...arr[idx], guardianName: e.target.value }; setNominees(arr); setIsDirty(true); }} /> },
    { title: '', key: 'action', width: 50, render: (_, rec) => <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeNominee(rec.key || rec.id)} /> },
  ];

  const documentColumns = [
    { title: 'Type', dataIndex: 'documentType', key: 'documentType', width: 200, render: (_, rec, idx) => <Select showSearch optionFilterProp="label" value={rec.documentType} onChange={(v) => { const arr = [...documents]; arr[idx] = { ...arr[idx], documentType: v }; setDocuments(arr); setIsDirty(true); }} options={DOCUMENT_TYPES} style={{ width: '100%' }} /> },
    { title: 'File URL / Reference', dataIndex: 'fileUrl', key: 'fileUrl', render: (_, rec, idx) => <Input value={rec.fileUrl} onChange={(e) => { const arr = [...documents]; arr[idx] = { ...arr[idx], fileUrl: e.target.value }; setDocuments(arr); setIsDirty(true); }} /> },
    { title: 'Remarks', dataIndex: 'remarks', key: 'remarks', render: (_, rec, idx) => <Input value={rec.remarks} onChange={(e) => { const arr = [...documents]; arr[idx] = { ...arr[idx], remarks: e.target.value }; setDocuments(arr); setIsDirty(true); }} /> },
    { title: '', key: 'action', width: 50, render: (_, rec) => <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeDocument(rec.key || rec.id)} /> },
  ];

  if (loading) return <Spin size="large" style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />;

  const tabItems = [
    {
      key: 'personal',
      label: 'Personal',
      children: (
        <Row gutter={[16, 0]}>
          <Col xs={24} sm={12} md={8}><Form.Item label="Full Name" name="fullName" rules={[{ required: true, message: 'Full name is required' }]}><Input /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="Father/Husband Name" name="fatherHusbandName"><Input /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="Gender" name="gender" rules={[{ required: true, message: 'Gender is required' }]}><Select showSearch optionFilterProp="label" options={GENDER_OPTIONS} /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              label="Date of Birth"
              name="dateOfBirth"
              rules={[
                { required: true, message: 'Date of birth is required' },
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    if (value.isAfter(dayjs(), 'day')) {
                      return Promise.reject(new Error('Date of birth cannot be in the future'));
                    }
                    if (dayjs().diff(value, 'year') < MIN_WORKING_AGE) {
                      return Promise.reject(new Error(`Employee must be at least ${MIN_WORKING_AGE} years old`));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="Marital Status" name="maritalStatus" rules={[{ required: true, message: 'Marital status is required' }]}><Select showSearch optionFilterProp="label" options={MARITAL_STATUS} /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="Blood Group" name="bloodGroup"><Select showSearch optionFilterProp="label" options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))} allowClear /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              label="Mobile Number"
              name="mobileNumber"
              rules={[
                { required: true, message: 'Mobile number is required' },
                { pattern: MOBILE_PATTERN, message: 'Enter a valid 10-digit mobile number' },
              ]}
            >
              <Input maxLength={15} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              label="Aadhaar Number"
              name="aadharNumber"
              rules={[{ pattern: AADHAAR_PATTERN, message: 'Aadhaar must be exactly 12 digits' }]}
            >
              <Input maxLength={12} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              label="PAN"
              name="panNumber"
              getValueFromEvent={(e) => e.target.value.toUpperCase()}
              rules={[{ pattern: PAN_PATTERN, message: 'PAN must look like ABCDE1234F' }]}
            >
              <Input maxLength={10} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="Emergency Contact Name" name="emergencyContactName"><Input /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              label="Emergency Contact Phone"
              name="emergencyContactPhone"
              rules={[{ pattern: MOBILE_PATTERN, message: 'Enter a valid 10-digit mobile number' }]}
            >
              <Input maxLength={15} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}><Form.Item label="Present Address" name="presentAddress" rules={[{ required: true, message: 'Present address is required' }]}><TextArea rows={2} /></Form.Item></Col>
          <Col xs={24} sm={12}><Form.Item label="Permanent Address" name="permanentAddress"><TextArea rows={2} /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="Migrant Worker" name="isMigrantWorker" valuePropName="checked"><Switch /></Form.Item></Col>
        </Row>
      ),
    },
    {
      key: 'employment',
      label: 'Employment',
      children: (
        <Row gutter={[16, 0]}>
          <Col xs={24} sm={12} md={8}><Form.Item label="Employee No" name="employeeNo" rules={[{ required: true, message: 'Employee number is required' }, { max: 50, message: 'Employee number cannot exceed 50 characters' }]}><Input disabled={isEdit} maxLength={50} /></Form.Item></Col>
          {/* Factory -> Department -> Designation. Changing a parent clears its
              children, otherwise a stale child from the previous parent would
              stay selected and fail server-side validation. */}
          <Col xs={24} sm={12} md={8}>
            <Form.Item label="Factory" name="factoryId" rules={[{ required: true, message: 'Factory is required' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={factoryOptions(factories)}
                onChange={() => form.setFieldsValue({ departmentId: undefined, designationId: undefined })}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              label="Department"
              name="departmentId"
              rules={[{ required: true, message: 'Department is required' }]}
              extra={!watchedFactoryId ? 'Select a factory first' : undefined}
            >
              <Select
                showSearch
                optionFilterProp="label"
                disabled={!watchedFactoryId}
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
                onChange={() => form.setFieldsValue({ designationId: undefined })}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              label="Designation"
              name="designationId"
              rules={[{ required: true, message: 'Designation is required' }]}
              extra={!watchedDepartmentId ? 'Select a department first' : undefined}
            >
              <Select
                showSearch
                optionFilterProp="label"
                disabled={!watchedDepartmentId}
                options={designations.map((d) => ({ value: d.id, label: d.name }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="Shift" name="shiftId" rules={[{ required: true, message: 'Shift is required' }]}><Select showSearch optionFilterProp="label" options={shifts.map((s) => ({ value: s.id, label: s.name }))} /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="Category" name="category" rules={[{ required: true, message: 'Category is required' }]}><Select showSearch optionFilterProp="label" options={EMPLOYEE_CATEGORY} /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="Employee Type" name="employeeType" rules={[{ required: true, message: 'Employee type is required' }]}><Select showSearch optionFilterProp="label" options={EMPLOYEE_TYPE} /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="Grade" name="grade"><Select showSearch optionFilterProp="label" options={EMPLOYEE_GRADE.map((g) => ({ value: g, label: g.replace('_', '+') }))} allowClear /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item label="Reporting Manager" name="reportingManagerId">
              <Select
                showSearch
                optionFilterProp="label"
                filterOption={false}
                onSearch={handleManagerSearch}
                options={managers.map((m) => ({ value: m.id, label: `${m.employeeNo} - ${m.fullName}` }))}
                allowClear
                placeholder="Search manager..."
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              label="Date of Joining"
              name="dateOfJoining"
              dependencies={['dateOfBirth']}
              rules={[
                { required: true, message: 'Date of joining is required' },
                ({ getFieldValue }) => ({
                  validator: (_, value) => {
                    const dob = getFieldValue('dateOfBirth');
                    if (!value || !dob) return Promise.resolve();
                    if (value.isBefore(dob, 'day')) {
                      return Promise.reject(new Error('Date of joining cannot precede date of birth'));
                    }
                    if (value.diff(dob, 'year') < MIN_WORKING_AGE) {
                      return Promise.reject(new Error(`Employee would be under ${MIN_WORKING_AGE} on the joining date`));
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
            </Form.Item>
          </Col>
          {isEdit && (
            <Col xs={24} sm={12} md={8}><Form.Item label="Status" name="status"><Select showSearch optionFilterProp="label" options={EMPLOYEE_STATUS} /></Form.Item></Col>
          )}
        </Row>
      ),
    },
    {
      key: 'statutory',
      label: 'Statutory',
      children: (
        <Row gutter={[16, 0]}>
          <Col xs={24} sm={12} md={8}><Form.Item label="PF Applicable" name="pfApplicable" valuePropName="checked"><Switch /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="PF Number" name="pfNumber"><Input /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="UAN Number" name="uanNumber"><Input /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="ESI Applicable" name="esiApplicable" valuePropName="checked"><Switch /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="ESI Number" name="esiNumber"><Input /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="PT Applicable" name="ptApplicable" valuePropName="checked"><Switch /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="LWF Applicable" name="lwfApplicable" valuePropName="checked"><Switch /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="TDS Applicable" name="tdsApplicable" valuePropName="checked"><Switch /></Form.Item></Col>
        </Row>
      ),
    },
    {
      key: 'bank',
      label: 'Bank & Nominees',
      children: (
        <>
          <Card title="Bank Details" size="small" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 0]}>
              <Col xs={24} sm={12} md={8}><Form.Item label="Account Number" name="accountNumber"><Input /></Form.Item></Col>
              <Col xs={24} sm={12} md={8}>
                <Form.Item
                  label="IFSC Code"
                  name="ifscCode"
                  getValueFromEvent={(e) => e.target.value.toUpperCase()}
                  rules={[{ pattern: IFSC_PATTERN, message: 'IFSC must look like HDFC0001234' }]}
                >
                  <Input maxLength={11} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={8}><Form.Item label="Bank Name" name="bankName"><Input /></Form.Item></Col>
              <Col xs={24} sm={12} md={8}><Form.Item label="Branch Name" name="branchName"><Input /></Form.Item></Col>
              <Col xs={24} sm={12} md={8}><Form.Item label="Payment Mode" name="paymentMode"><Select showSearch optionFilterProp="label" options={PAYMENT_MODES} allowClear /></Form.Item></Col>
            </Row>
          </Card>
          <Card title="Nominees" size="small" extra={<Button type="dashed" icon={<PlusOutlined />} onClick={addNominee}>Add Nominee</Button>}>
            <Table rowKey={(r) => r.key || r.id} columns={nomineeColumns} dataSource={nominees} pagination={false} size="small" scroll={{ x: 700 }} />
          </Card>
        </>
      ),
    },
    {
      key: 'documents',
      label: 'Documents',
      children: (
        <Card title="Documents" size="small" extra={<Button type="dashed" icon={<PlusOutlined />} onClick={addDocument}>Add Document</Button>}>
          <Table rowKey={(r) => r.key || r.id} columns={documentColumns} dataSource={documents} pagination={false} size="small" scroll={{ x: 700 }} />
        </Card>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={isEdit ? 'Edit Employee' : 'New Employee'}
        backPath="/hr/employees"
      >
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/hr/employees')}>Back</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>Save</Button>
        </Space>
      </PageHeader>

      <Form
        form={form}
        layout="vertical"
        onValuesChange={() => setIsDirty(true)}
        initialValues={{ status: 'ACTIVE', employeeType: 'PERMANENT', isMigrantWorker: false, pfApplicable: false, esiApplicable: false, ptApplicable: false, lwfApplicable: false, tdsApplicable: false }}
      >
        {/*
          forceRender mounts every pane up front. Without it Antd only mounts a
          pane once visited, so Form.Items on unvisited tabs never register and
          validateFields() skips them - letting an incomplete record reach the
          server and fail there instead of failing here.
        */}
        <Tabs
          items={tabItems.map((tab) => ({ ...tab, forceRender: true }))}
          activeKey={activeTab}
          onChange={setActiveTab}
        />
      </Form>
    </>
  );
};

export default EmployeeForm;
