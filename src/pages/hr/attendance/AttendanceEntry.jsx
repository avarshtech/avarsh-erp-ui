import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Card, Form, Select, DatePicker, TimePicker, InputNumber, Input,
  Button, Row, Col, Space, Tag, Alert,
} from 'antd';
import { SaveOutlined, TableOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { markAttendance } from '../../../services/hr/attendanceService';
import { searchEmployees } from '../../../services/hr/employeeService';
import { getActiveFactories } from '../../../services/master/factoryService';
import { getActiveLeaveTypes } from '../../../services/master/hrMasterService';
import { ATTENDANCE_STATUS, HALF_DAY_TYPE } from '../../../utils/hrConstants';
import { employeeOptions, factoryOptions } from '../../../utils/hrLabels';
import { hasPermission } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';

/** Days marked as one of these cannot carry overtime. */
const NON_WORKING = ['ABSENT', 'WEEKLY_OFF', 'LEAVE'];

const AttendanceEntry = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const canAdd = hasPermission('hr-attendance', 'add');

  const [factories, setFactories] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [saving, setSaving] = useState(false);

  const factoryId = Form.useWatch('factoryId', form);
  const status = Form.useWatch('status', form);

  useEffect(() => {
    getActiveFactories().then(setFactories).catch(() => {});
    getActiveLeaveTypes().then(setLeaveTypes).catch(() => {});
  }, []);

  // Employees are scoped to the chosen factory, matching how the rest of the
  // HR screens cascade.
  useEffect(() => {
    if (!factoryId) {
      setEmployees([]);
      return;
    }
    searchEmployees({ factoryId, status: 'ACTIVE', size: 500 })
      .then((res) => setEmployees(res.content || []))
      .catch(() => setEmployees([]));
    form.setFieldsValue({ employeeId: undefined });
  }, [factoryId, form]);

  const isHalfDay = status === 'HALF_DAY';
  const isLeave = status === 'LEAVE';
  const otBlocked = NON_WORKING.includes(status);

  const statusOptions = useMemo(
    () => ATTENDANCE_STATUS.map((s) => ({ value: s.value, label: s.label })),
    [],
  );

  const leaveTypeOptions = useMemo(
    () => leaveTypes.map((t) => ({ value: t.id, label: `${t.code} - ${t.name}` })),
    [leaveTypes],
  );

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      await markAttendance({
        employeeId: values.employeeId,
        attendanceDate: values.attendanceDate.format('YYYY-MM-DD'),
        status: values.status,
        halfDaySession: values.status === 'HALF_DAY' ? values.halfDaySession : null,
        leaveTypeId: values.status === 'LEAVE' ? values.leaveTypeId : null,
        inTime: values.inTime ? values.inTime.format('HH:mm') : null,
        outTime: values.outTime ? values.outTime.format('HH:mm') : null,
        otHours: values.otHours || 0,
        remarks: values.remarks,
      });

      message.success('Attendance saved');
      // Keep factory and date so consecutive entries are quick.
      form.setFieldsValue({
        employeeId: undefined, status: undefined, halfDaySession: undefined,
        leaveTypeId: undefined, inTime: null, outTime: null, otHours: 0, remarks: undefined,
      });
    } catch (err) {
      if (err?.errorFields) return;
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setSaving(false);
    }
  }, [form, message]);

  return (
    <>
      <PageHeader title="Mark Attendance">
        <Space>
          <Button icon={<TableOutlined />} onClick={() => navigate('/hr/attendance/bulk')}>
            Bulk Grid Entry
          </Button>
        </Space>
      </PageHeader>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Saving replaces any existing record for that employee and date."
        description="For a whole factory use Bulk Grid Entry, or Import Attendance for a spreadsheet."
      />

      <Card size="small">
        <Form
          form={form}
          layout="vertical"
          initialValues={{ attendanceDate: dayjs(), otHours: 0 }}
        >
          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="factoryId" label="Factory" rules={[{ required: true, message: 'Factory is required' }]}>
                <Select
                  placeholder="Select factory"
                  options={factoryOptions(factories)}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="employeeId"
                label="Employee"
                rules={[{ required: true, message: 'Employee is required' }]}
                extra={!factoryId ? 'Select a factory first' : undefined}
              >
                <Select
                  placeholder="Select employee"
                  options={employeeOptions(employees)}
                  disabled={!factoryId}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item name="attendanceDate" label="Date" rules={[{ required: true, message: 'Date is required' }]}>
                <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item name="status" label="Status" rules={[{ required: true, message: 'Status is required' }]}>
                <Select placeholder="Select status" options={statusOptions} />
              </Form.Item>
            </Col>

            {isHalfDay && (
              <Col xs={24} sm={12} md={8}>
                <Form.Item
                  name="halfDaySession"
                  label="Which half was worked"
                  rules={[{ required: true, message: 'Select which half' }]}
                >
                  <Select
                    placeholder="Select"
                    options={[
                      { value: 'FIRST_HALF', label: 'First half (left early)' },
                      { value: 'SECOND_HALF', label: 'Second half (arrived late)' },
                    ]}
                  />
                </Form.Item>
              </Col>
            )}

            {isLeave && (
              <Col xs={24} sm={12} md={8}>
                <Form.Item
                  name="leaveTypeId"
                  label="Leave Type"
                  rules={[{ required: true, message: 'Leave type is required' }]}
                  extra="Records which balance this day is taken against"
                >
                  <Select placeholder="Select leave type" options={leaveTypeOptions} showSearch optionFilterProp="label" />
                </Form.Item>
              </Col>
            )}

            <Col xs={24} sm={12} md={8}>
              <Form.Item name="inTime" label="In Time">
                <TimePicker style={{ width: '100%' }} format="HH:mm" minuteStep={5} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item name="outTime" label="Out Time">
                <TimePicker style={{ width: '100%' }} format="HH:mm" minuteStep={5} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="otHours"
                label="Overtime Hours"
                extra={otBlocked ? `Not allowed on a day marked ${status}` : undefined}
                rules={[{ type: 'number', min: 0, max: 12, message: 'Between 0 and 12' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} max={12} step={0.5} disabled={otBlocked} />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item name="remarks" label="Remarks">
                <Input.TextArea rows={2} maxLength={500} />
              </Form.Item>
            </Col>
          </Row>

          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
              disabled={!canAdd}
            >
              Save Attendance
            </Button>
            {!canAdd && <Tag color="warning">You do not have permission to record attendance</Tag>}
          </Space>
        </Form>
      </Card>
    </>
  );
};

export default AttendanceEntry;
