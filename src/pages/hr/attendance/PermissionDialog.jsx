import { useCallback, useEffect, useState } from 'react';
import { App, Alert, Col, Form, Input, Modal, Row, Select, TimePicker, Typography } from 'antd';
import dayjs from 'dayjs';
import DateInput from '../../../components/DateInput';
import { getEmployeeOptions } from '../../../services/asset/assetService';
import { getPermissionBalance, recordPermission } from '../../../services/hr/permissionService';
import { toastUnlessHandled } from '../../../utils/apiError';

const { Text } = Typography;
const TIME = 'HH:mm';

/** How many of the month's allowance an hour of this length costs. */
const unitsFor = (from, to, minutesEach) => {
  if (!from || !to || !minutesEach) return 0;
  const minutes = to.diff(from, 'minute');
  if (minutes <= 0) return 0;
  return Math.ceil(minutes / minutesEach);
};

/**
 * Recording one permission.
 *
 * <p>The balance is fetched the moment an employee is picked, not after the server
 * refuses. Somebody giving an hour off needs to know whether it is their last one
 * BEFORE they promise it, and finding out through an error message is finding out
 * too late.</p>
 *
 * <p>The cost is shown as the times are set, because two hours in one go is two of the
 * two - and that is the part of the rule nobody guesses right first time.</p>
 */
const PermissionDialog = ({ open, onClose, onSaved, policy }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [balance, setBalance] = useState(null);

  const employeeId = Form.useWatch('employeeId', form);
  const permissionDate = Form.useWatch('permissionDate', form);
  const fromTime = Form.useWatch('fromTime', form);
  const toTime = Form.useWatch('toTime', form);

  const minutesEach = policy?.minutesEach ?? 60;
  const wanted = unitsFor(fromTime, toTime, minutesEach);

  const searchEmployees = useCallback(async (term) => {
    try { setEmployees(await getEmployeeOptions(term)); } catch { setEmployees([]); }
  }, []);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setBalance(null);
    searchEmployees('');
  }, [open, form, searchEmployees]);

  // Re-read on the date too: the allowance is per month, so moving a permission from
  // the 31st to the 1st moves it into a different month's two.
  useEffect(() => {
    if (!open || !employeeId || !permissionDate) {
      setBalance(null);
      return;
    }
    let alive = true;
    getPermissionBalance(employeeId, permissionDate.year(), permissionDate.month() + 1)
      .then((b) => { if (alive) setBalance(b); })
      .catch(() => { if (alive) setBalance(null); });
    return () => { alive = false; };
  }, [open, employeeId, permissionDate]);

  const submit = async (values) => {
    setSaving(true);
    try {
      await recordPermission({
        employeeId: values.employeeId,
        permissionDate: values.permissionDate.format('YYYY-MM-DD'),
        fromTime: values.fromTime.format(TIME),
        toTime: values.toTime.format(TIME),
        reason: values.reason,
      });
      message.success('Permission recorded');
      onSaved();
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not record the permission');
    } finally {
      setSaving(false);
    }
  };

  const overspend = balance && wanted > 0 && wanted > balance.remaining;

  return (
    <Modal
      title="Record a permission"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Record"
      // Refused here rather than after a round trip: the balance is already on screen.
      okButtonProps={{ disabled: overspend }}
      confirmLoading={saving}
      width={560}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item
          name="employeeId"
          label="Employee"
          rules={[{ required: true, message: 'Pick the person' }]}
        >
          <Select
            showSearch
            filterOption={false}
            onSearch={searchEmployees}
            options={employees.map((e) => ({ value: e.id, label: e.label }))}
            placeholder="Search by name or employee no."
            notFoundContent={null}
          />
        </Form.Item>

        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item
              name="permissionDate"
              label="Date"
              rules={[{ required: true, message: 'Pick the date' }]}
            >
              <DateInput />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8}>
            <Form.Item name="fromTime" label="From" rules={[{ required: true, message: 'From?' }]}>
              <TimePicker format={TIME} minuteStep={5} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8}>
            <Form.Item name="toTime" label="To" rules={[{ required: true, message: 'To?' }]}>
              <TimePicker format={TIME} minuteStep={5} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="reason" label="Reason">
          <Input.TextArea rows={2} maxLength={500} showCount placeholder="Optional" />
        </Form.Item>
      </Form>

      {balance && (
        <Alert
          type={overspend ? 'error' : 'info'}
          showIcon
          title={overspend
            ? `This is worth ${wanted}, and ${balance.employeeName} has ${balance.remaining} left`
            : `${balance.employeeName}: ${balance.remaining} of ${balance.allowed} left this month`}
          description={(
            <>
              {wanted > 0 && (
                <div>
                  {/* The part nobody guesses: two hours at once is two of the two. */}
                  This one is worth <Text strong>{wanted}</Text> of the allowance
                  {` (a permission is ${balance.minutesEach} minutes).`}
                </div>
              )}
              {balance.takenOn?.length > 0 && (
                <div>Already taken: {balance.takenOn.map((d) => dayjs(d).format('DD-MMM')).join(', ')}</div>
              )}
            </>
          )}
          style={{ marginTop: 4 }}
        />
      )}
    </Modal>
  );
};

export default PermissionDialog;
