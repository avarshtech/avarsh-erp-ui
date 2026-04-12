import { useState, useEffect, useCallback } from 'react';
import {
  App, Form, Input, Select, DatePicker, Switch, Button, Tabs, Card,
  Row, Col, InputNumber, Table, Space, Spin,
} from 'antd';
import { SaveOutlined, ArrowLeftOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getEmployeeById, createEmployee, updateEmployee } from '../../../services/hr/employeeService';
import { getActiveDepartments, getActiveDesignations, getActiveShifts } from '../../../services/master/hrMasterService';
import { getActiveFactories } from '../../../services/master/factoryService';
import { searchEmployees } from '../../../services/hr/employeeService';
import {
  EMPLOYEE_STATUS, EMPLOYEE_TYPE, GENDER_OPTIONS, MARITAL_STATUS,
  BLOOD_GROUPS, PAYMENT_MODES, DOCUMENT_TYPES, RELATIONSHIP_TYPES,
  EMPLOYEE_CATEGORY, EMPLOYEE_GRADE,
} from '../../../utils/hrConstants';
import PageHeader from '../../../components/PageHeader';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';

const { TextArea } = Input;

const EmployeeForm = () => {
  const { message } = App.useApp();
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
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

  // Load dropdown options
  useEffect(() => {
    getActiveDepartments().then(setDepartments).catch(() => {});
    getActiveDesignations().then(setDesignations).catch(() => {});
    getActiveFactories().then(setFactories).catch(() => {});
    getActiveShifts().then(setShifts).catch(() => {});
  }, []);

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

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
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
      if (err?.errorFields) return; // form validation
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
          <Col xs={24} sm={12} md={8}><Form.Item label="Gender" name="gender" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={GENDER_OPTIONS} /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="Date of Birth" name="dateOfBirth"><DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="Marital Status" name="maritalStatus"><Select showSearch optionFilterProp="label" options={MARITAL_STATUS} allowClear /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="Blood Group" name="bloodGroup"><Select showSearch optionFilterProp="label" options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))} allowClear /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="Mobile Number" name="mobileNumber" rules={[{ required: true, message: 'Mobile is required' }]}><Input /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="Emergency Contact Name" name="emergencyContactName"><Input /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="Emergency Contact Phone" name="emergencyContactPhone"><Input /></Form.Item></Col>
          <Col xs={24} sm={12}><Form.Item label="Present Address" name="presentAddress"><TextArea rows={2} /></Form.Item></Col>
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
          <Col xs={24} sm={12} md={8}><Form.Item label="Employee No" name="employeeNo"><Input disabled={isEdit} /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="Department" name="departmentId" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={departments.map((d) => ({ value: d.id, label: d.name }))} /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="Designation" name="designationId" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={designations.map((d) => ({ value: d.id, label: d.name }))} /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="Factory" name="factoryId" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={factories.map((f) => ({ value: f.id, label: f.name }))} /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="Shift" name="shiftId"><Select showSearch optionFilterProp="label" options={shifts.map((s) => ({ value: s.id, label: s.name }))} allowClear /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="Category" name="category" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={EMPLOYEE_CATEGORY} /></Form.Item></Col>
          <Col xs={24} sm={12} md={8}><Form.Item label="Employee Type" name="employeeType" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={EMPLOYEE_TYPE} /></Form.Item></Col>
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
          <Col xs={24} sm={12} md={8}><Form.Item label="Date of Joining" name="dateOfJoining" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" /></Form.Item></Col>
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
              <Col xs={24} sm={12} md={8}><Form.Item label="IFSC Code" name="ifscCode"><Input /></Form.Item></Col>
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
        <Tabs items={tabItems} />
      </Form>
    </>
  );
};

export default EmployeeForm;
