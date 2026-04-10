import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Button, Select, DatePicker, TimePicker, InputNumber, Input, Row, Col, Space } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getAttendanceByDate, bulkMarkAttendance } from '../../../services/attendanceService';
import { getActiveFactories } from '../../../services/factoryService';
import { hasPermission } from '../../../utils/permissions';
import { ATTENDANCE_STATUS } from '../../../utils/hrConstants';
import PageHeader from '../../../components/PageHeader';

const statusOptions = ATTENDANCE_STATUS.map((s) => ({ value: s.value, label: s.label }));

const AttendanceBulkEntry = () => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [factories, setFactories] = useState([]);
  const [factoryId, setFactoryId] = useState(undefined);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [data, setData] = useState([]);
  const [locked, setLocked] = useState(false);

  const canEdit = hasPermission('hr-attendance', 'update');

  useEffect(() => {
    getActiveFactories().then(setFactories).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedDate || !factoryId) return;
    setLoading(true);
    try {
      const result = await getAttendanceByDate(selectedDate.format('YYYY-MM-DD'), factoryId);
      setData((result.records || []).map((r, i) => ({ ...r, _key: r.id || i })));
      setLocked(result.locked || false);
    } catch {
      message.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, factoryId, message]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
          canEdit && (
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSaveAll}
              loading={saving}
              disabled={locked || data.length === 0}
            >
              Save All
            </Button>
          )
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
            options={factories.map((f) => ({ value: f.id, label: f.name }))}
          />
        </Col>
        {locked && (
          <Col xs={24} sm={8} md={6}>
            <Space>
              <span style={{ color: '#ff4d4f', fontWeight: 600 }}>Month is locked - editing disabled</span>
            </Space>
          </Col>
        )}
      </Row>
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
