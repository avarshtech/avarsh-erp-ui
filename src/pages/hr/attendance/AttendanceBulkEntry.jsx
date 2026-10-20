import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, App, Table, Button, Select, InputNumber, Input, Row, Col, Space } from 'antd';
import DateInput from '../../../components/DateInput';
import TimeInput from '../../../components/TimeInput';
import { SaveOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getAttendanceByDate, bulkMarkAttendance,
  getAttendanceLock, lockAttendanceMonth, unlockAttendanceMonth,
} from '../../../services/hr/attendanceService';
import { getActiveUnits } from '../../../services/master/unitService';
import { searchEmployees } from '../../../services/hr/employeeService';
import { useBranch } from '../../../context/BranchContext';
import { hasPermission } from '../../../utils/permissions';
import { ATTENDANCE_STATUS } from '../../../utils/hrConstants';
import { unitOptions } from '../../../utils/hrLabels';
import PageHeader from '../../../components/PageHeader';

const statusOptions = ATTENDANCE_STATUS.map((s) => ({ value: s.value, label: s.label }));

/** Every active employee of the unit, page by page, so no cap leaves anyone off the grid. */
const activeEmployeesOf = async (unitId) => {
  const all = [];
  for (let page = 0; page < 50; page += 1) {
    const result = await searchEmployees({ unitId, status: 'ACTIVE', page, size: 500 });
    all.push(...result.content);
    if (result.last !== false || result.content.length < 500) break;
  }
  return all;
};

const AttendanceBulkEntry = () => {
  const { message, modal } = App.useApp();
  // Units of the working branch only; "All branches" lists every unit
  const { activeBranchId } = useBranch();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState(undefined);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [data, setData] = useState([]);
  const [lock, setLock] = useState(null);

  const locked = Boolean(lock?.isLocked);

  const canEdit = hasPermission('hr-attendance', 'update');
  const canLock = hasPermission('hr-attendance', 'lock');

  useEffect(() => {
    getActiveUnits(activeBranchId || undefined).then(setUnits).catch(() => {});
  }, [activeBranchId]);

  const fetchData = useCallback(async () => {
    if (!selectedDate || !unitId) return;
    setLoading(true);
    try {
      const day = selectedDate.format('YYYY-MM-DD');
      const [result, roster] = await Promise.all([
        getAttendanceByDate(day, unitId),
        // A roster that fails to load leaves the grid as it was: the day's records only
        activeEmployeesOf(unitId).catch(() => []),
      ]);
      // The endpoint returns a plain list. This read result.records, which does
      // not exist, so the grid was empty on every load.
      const records = Array.isArray(result) ? result : result?.records || [];
      // The by-date endpoint returns only employees already marked that day, so a fresh day was an
      // empty grid (U353). Every active employee of the unit who had joined by then is listed too,
      // with no status until someone marks them.
      const marked = new Set(records.map((r) => r.employeeId));
      const unmarked = roster
        .filter((e) => !marked.has(e.id) && (!e.dateOfJoining || e.dateOfJoining <= day))
        .map((e) => ({ employeeId: e.id, employeeNo: e.employeeNo, employeeName: e.fullName }));
      const rows = unmarked.length
        ? [...records, ...unmarked].sort((a, b) => String(a.employeeNo ?? '').localeCompare(String(b.employeeNo ?? ''), undefined, { numeric: true }))
        : records;
      setData(rows.map((r, i) => ({ ...r, _key: r.id || `employee-${r.employeeId}` || i })));
    } catch {
      setData([]);
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setLoading(false);
    }
  }, [selectedDate, unitId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchLock = useCallback(async () => {
    if (!selectedDate || !unitId) { setLock(null); return; }
    try {
      setLock(await getAttendanceLock(unitId, selectedDate.month() + 1, selectedDate.year()));
    } catch {
      // A missing lock state must not block the grid; treat it as unlocked and
      // let the server refuse the write if it disagrees.
      setLock(null);
    }
  }, [unitId, selectedDate]);

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
          await fn({ unitId, month: selectedDate.month() + 1, year: selectedDate.year() });
          message.success(locked ? `${period} reopened` : `${period} locked`);
          fetchLock();
          fetchData();
        } catch (err) {
          message.error(err?.response?.data?.message
            || `Could not ${locked ? 'reopen' : 'lock'} the period`);
        }
      },
    });
  }, [locked, unitId, selectedDate, modal, message, fetchLock, fetchData]);

  /**
   * An out time at or before the in time on the same day. A shift that really
   * crosses midnight is recorded by its own procedure, not this grid, so there
   * is no exception to make here.
   */
  const outBeforeIn = (row) => !!row?.inTime && !!row?.outTime && row.outTime <= row.inTime;

  const handleFieldChange = useCallback((index, field, value) => {
    setData((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const handleSaveAll = useCallback(async () => {
    if (!selectedDate || !unitId) {
      message.warning('Please select a date and unit');
      return;
    }
    // Catch the bad rows before the request: the server refuses the whole save,
    // and naming the employees is more use than one rejected row's message.
    const reversed = data.filter(outBeforeIn);
    if (reversed.length) {
      message.error(`Out time is before in time for ${reversed.map((r) => r.employeeNo || r.employeeName).join(', ')}.`);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        date: selectedDate.format('YYYY-MM-DD'),
        unitId,
        // A listed employee nobody marked is not sent: an empty row is not an attendance record
        records: data.filter((r) => r.status).map((r) => ({
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
      // axiosInstance already toasts the server's message; adding another here showed two.
    } finally {
      setSaving(false);
    }
  }, [selectedDate, unitId, data, message, fetchData]);

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
        <TimeInput
          value={val ? dayjs(val, 'HH:mm') : null}
          onChange={(time) => handleFieldChange(index, 'inTime', time ? time.format('HH:mm') : null)}
          disabled={locked || !canEdit}
        />
      ),
    },
    {
      title: 'Out Time',
      dataIndex: 'outTime',
      key: 'outTime',
      width: 130,
      // There is no Form wrapping this grid, so the cell carries its own error
      // state. The server refuses the row as well; this just says so sooner.
      render: (val, record, index) => (
        <TimeInput
          value={val ? dayjs(val, 'HH:mm') : null}
          onChange={(time) => handleFieldChange(index, 'outTime', time ? time.format('HH:mm') : null)}
          disabled={locked || !canEdit}
          status={outBeforeIn(record) ? 'error' : undefined}
          title={outBeforeIn(record) ? 'The out time is before the in time' : undefined}
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
            {canLock && unitId && (
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
          <DateInput
            value={selectedDate}
            onChange={setSelectedDate}
            style={{ width: '100%' }}
            allowClear={false}
          />
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Select
            placeholder="Select Unit"
            allowClear
            style={{ width: '100%' }}
            value={unitId}
            onChange={setUnitId}
            options={unitOptions(units)}
          />
        </Col>
      </Row>

      {unitId && locked && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={`${selectedDate.format('MMMM YYYY')} is locked`}
          description={
            lock?.lockedAt
              ? `Locked on ${dayjs(lock.lockedAt).format('DD-MMM-YYYY HH:mm')}. Attendance for this month cannot be changed until it is reopened.`
              : 'Attendance for this month cannot be changed until it is reopened.'
          }
        />
      )}
      {unitId && !locked && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title={`${selectedDate.format('MMMM YYYY')} is open`}
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
