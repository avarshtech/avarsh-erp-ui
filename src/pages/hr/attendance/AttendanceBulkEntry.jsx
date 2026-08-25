import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, App, Table, Button, Select, DatePicker, TimePicker, InputNumber, Input, Row, Col, Space } from 'antd';
import { SaveOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getAttendanceByDate, bulkMarkAttendance,
  getAttendanceLock, lockAttendanceMonth, unlockAttendanceMonth,
} from '../../../services/hr/attendanceService';
import { getActiveFactories } from '../../../services/master/factoryService';
import { hasPermission } from '../../../utils/permissions';
import { ATTENDANCE_STATUS } from '../../../utils/hrConstants';
import { factoryOptions } from '../../../utils/hrLabels';
import PageHeader from '../../../components/PageHeader';

const statusOptions = ATTENDANCE_STATUS.map((s) => ({ value: s.value, label: s.label }));

const AttendanceBulkEntry = () => {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [factories, setFactories] = useState([]);
  const [factoryId, setFactoryId] = useState(undefined);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [data, setData] = useState([]);
  const [lock, setLock] = useState(null);

  const locked = Boolean(lock?.isLocked);

  const canEdit = hasPermission('hr-attendance', 'update');
  const canLock = hasPermission('hr-attendance', 'lock');

  useEffect(() => {
    getActiveFactories().then(setFactories).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedDate || !factoryId) return;
    setLoading(true);
    try {
      const result = await getAttendanceByDate(selectedDate.format('YYYY-MM-DD'), factoryId);
      // The endpoint returns a plain list. This read result.records, which does
      // not exist, so the grid was empty on every load.
      const records = Array.isArray(result) ? result : result?.records || [];
      setData(records.map((r, i) => ({ ...r, _key: r.id || i })));
    } catch (err) {
      setData([]);
      message.error(err?.response?.data?.message || 'Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, factoryId, message]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchLock = useCallback(async () => {
    if (!selectedDate || !factoryId) { setLock(null); return; }
    try {
      setLock(await getAttendanceLock(factoryId, selectedDate.month() + 1, selectedDate.year()));
    } catch {
      // A missing lock state must not block the grid; treat it as unlocked and
      // let the server refuse the write if it disagrees.
      setLock(null);
    }
  }, [factoryId, selectedDate]);

  useEffect(() => { fetchLock(); }, [fetchLock]);

  const toggleLock = useCallback(() => {
    const period = selectedDate.format('MMMM YYYY');
    modal.confirm({
      title: locked ? `Reopen ${period}?` : `Lock ${period}?`,
      content: locked
        ? 'Attendance for this month becomes editable again. This is refused if payroll for the month has already been processed.'
        : 'Attendance for this month can no longer be changed by anyone, through this screen, the import, or a regularisation. Payroll expects the period to be locked before it runs.',
      okText: locked ? 'Reopen' : 'Lock',
      okButtonProps: locked ? { danger: true } : undefined,
      onOk: async () => {
        try {
          const fn = locked ? unlockAttendanceMonth : lockAttendanceMonth;
          await fn({ factoryId, month: selectedDate.month() + 1, year: selectedDate.year() });
          message.success(locked ? `${period} reopened` : `${period} locked`);
          fetchLock();
          fetchData();
        } catch (err) {
          message.error(err?.response?.data?.message
            || `Could not ${locked ? 'reopen' : 'lock'} the period`);
        }
      },
    });
  }, [locked, factoryId, selectedDate, modal, message, fetchLock, fetchData]);

  const handleFieldChange = useCallback((index, field, value) => {
    setData((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const handleSaveAll = useCallback(async () => {
    if (!selectedDate || !factoryId) {
      message.warning('Please select a date and factory');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        date: selectedDate.format('YYYY-MM-DD'),
        factoryId,
        records: data.map((r) => ({
          employeeId: r.employeeId,
          status: r.status,
          inTime: r.inTime || null,
          outTime: r.outTime || null,
          otHours: r.otHours ?? null,
          remarks: r.remarks || null,
        })),
      };
      await bulkMarkAttendance(payload);
      message.success('Attendance saved successfully');
      fetchData();
    } catch {
      message.error('Failed to save attendance');
    } finally {
      setSaving(false);
    }
  }, [selectedDate, factoryId, data, message, fetchData]);

  const columns = useMemo(() => [
    {
      title: 'Emp No',
      dataIndex: 'employeeNo',
      key: 'employeeNo',
      width: 100,
      fixed: 'left',
    },
    {
      title: 'Employee Name',
      dataIndex: 'employeeName',
      key: 'employeeName',
      width: 180,
      fixed: 'left',
    },
    {
      title: 'In Time',
      dataIndex: 'inTime',
      key: 'inTime',
      width: 130,
      render: (val, _record, index) => (
        <TimePicker
          format="HH:mm"
          value={val ? dayjs(val, 'HH:mm') : null}
          onChange={(time) => handleFieldChange(index, 'inTime', time ? time.format('HH:mm') : null)}
          disabled={locked || !canEdit}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Out Time',
      dataIndex: 'outTime',
      key: 'outTime',
      width: 130,
      render: (val, _record, index) => (
        <TimePicker
          format="HH:mm"
          value={val ? dayjs(val, 'HH:mm') : null}
          onChange={(time) => handleFieldChange(index, 'outTime', time ? time.format('HH:mm') : null)}
          disabled={locked || !canEdit}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (val, _record, index) => (
        <Select
          value={val}
          onChange={(v) => handleFieldChange(index, 'status', v)}
          options={statusOptions}
          disabled={locked || !canEdit}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'OT Hours',
      dataIndex: 'otHours',
      key: 'otHours',
      width: 100,
      render: (val, _record, index) => (
        <InputNumber
          min={0}
          max={12}
          step={0.5}
          value={val}
          onChange={(v) => handleFieldChange(index, 'otHours', v)}
          disabled={locked || !canEdit}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      key: 'remarks',
      width: 200,
      render: (val, _record, index) => (
        <Input
          value={val}
          onChange={(e) => handleFieldChange(index, 'remarks', e.target.value)}
          disabled={locked || !canEdit}
          placeholder="Remarks"
        />
      ),
    },
  ], [handleFieldChange, locked, canEdit]);

  return (
    <>
      <PageHeader
        title="Bulk Attendance Entry"
        extra={
          <Space>
            {canLock && factoryId && (
              <Button
                icon={locked ? <UnlockOutlined /> : <LockOutlined />}
                onClick={toggleLock}
                danger={locked}
              >
                {locked ? 'Reopen Month' : 'Lock Month'}
              </Button>
            )}
            {canEdit && (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSaveAll}
                loading={saving}
                disabled={locked || data.length === 0}
              >
                Save All
              </Button>
            )}
          </Space>
        }
      />
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8} md={6}>
          <DatePicker
            value={selectedDate}
            onChange={setSelectedDate}
            style={{ width: '100%' }}
            allowClear={false}
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
      </Row>

      {factoryId && locked && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`${selectedDate.format('MMMM YYYY')} is locked`}
          description={
            lock?.lockedAt
              ? `Locked on ${dayjs(lock.lockedAt).format('DD-MMM-YYYY HH:mm')}. Attendance for this month cannot be changed until it is reopened.`
              : 'Attendance for this month cannot be changed until it is reopened.'
          }
        />
      )}
      {factoryId && !locked && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`${selectedDate.format('MMMM YYYY')} is open`}
          description="Attendance can still be edited. Lock the month once it is final - payroll expects a locked period before it runs."
        />
      )}
      <Table
        columns={columns}
        dataSource={data}
        rowKey="_key"
        loading={loading}
        pagination={false}
        scroll={{ x: 1100 }}
        size="small"
        bordered
      />
    </>
  );
};

export default AttendanceBulkEntry;
