import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Calendar, Select, Row, Col, Tag, Badge, Drawer, Descriptions, Space, Spin } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getAttendanceCalendar } from '../../../services/attendanceService';
import { searchEmployees } from '../../../services/employeeService';
import { getActiveFactories } from '../../../services/factoryService';
import { getActiveDepartmentsByFactory } from '../../../services/hrMasterService';
import { ATTENDANCE_STATUS } from '../../../utils/hrConstants';
import PageHeader from '../../../components/PageHeader';

const statusMap = Object.fromEntries(ATTENDANCE_STATUS.map((s) => [s.value, s]));

const AttendanceCalendar = () => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [factories, setFactories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [factoryId, setFactoryId] = useState(undefined);
  const [departmentId, setDepartmentId] = useState(undefined);
  const [employeeId, setEmployeeId] = useState(undefined);
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [calendarData, setCalendarData] = useState({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

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
    setEmployeeId(undefined);
  }, [factoryId]);

  useEffect(() => {
    if (factoryId) {
      searchEmployees({ factoryId, departmentId, status: 'ACTIVE', size: 500 })
        .then((res) => setEmployees(res.content || []))
        .catch(() => {});
    } else {
      setEmployees([]);
    }
    setEmployeeId(undefined);
  }, [factoryId, departmentId]);

  const fetchCalendar = useCallback(async () => {
    if (!employeeId) {
      setCalendarData({});
      return;
    }
    setLoading(true);
    try {
      const data = await getAttendanceCalendar(employeeId, currentMonth.year(), currentMonth.month() + 1);
      const map = {};
      (data || []).forEach((item) => {
        map[item.date] = item;
      });
      setCalendarData(map);
    } catch {
      message.error('Failed to load attendance calendar');
    } finally {
      setLoading(false);
    }
  }, [employeeId, currentMonth, message]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const handlePanelChange = useCallback((value) => {
    setCurrentMonth(value);
  }, []);

  const handleDayClick = useCallback((date) => {
    const key = date.format('YYYY-MM-DD');
    const record = calendarData[key];
    if (record) {
      setSelectedDay({ date, ...record });
      setDrawerOpen(true);
    }
  }, [calendarData]);

  const cellRender = useCallback((current) => {
    const key = current.format('YYYY-MM-DD');
    const record = calendarData[key];
    if (!record) return null;
    const status = statusMap[record.status];
    if (!status) return null;
    return (
      <div
        onClick={() => handleDayClick(current)}
        style={{ cursor: 'pointer', textAlign: 'center' }}
      >
        <Badge color={status.color} text={null} />
      </div>
    );
  }, [calendarData, handleDayClick]);

  const legend = useMemo(() => (
    <Space wrap style={{ marginBottom: 16 }}>
      {ATTENDANCE_STATUS.map((s) => (
        <Tag key={s.value} color={s.tag}>{s.label}</Tag>
      ))}
    </Space>
  ), []);

  return (
    <>
      <PageHeader title="Attendance Calendar" />
      <Row gutter={16} style={{ marginBottom: 16 }}>
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
        <Col xs={24} sm={8} md={6}>
          <Select
            placeholder="Select Employee"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: '100%' }}
            value={employeeId}
            onChange={setEmployeeId}
            options={employees.map((e) => ({ value: e.id, label: `${e.employeeNo} - ${e.name}` }))}
            disabled={!factoryId}
          />
        </Col>
      </Row>
      {legend}
      <Spin spinning={loading}>
        <Calendar
          value={currentMonth}
          onPanelChange={handlePanelChange}
          cellRender={cellRender}
          headerRender={({ value, onChange }) => (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '8px 0' }}>
              <LeftOutlined style={{ cursor: 'pointer' }} onClick={() => onChange(value.subtract(1, 'month'))} />
              <span style={{ fontWeight: 600, fontSize: 16 }}>{value.format('MMMM YYYY')}</span>
              <RightOutlined style={{ cursor: 'pointer' }} onClick={() => onChange(value.add(1, 'month'))} />
            </div>
          )}
        />
      </Spin>

      <Drawer
        title="Attendance Details"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={400}
      >
        {selectedDay && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Date">{selectedDay.date?.format('DD MMM YYYY')}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={statusMap[selectedDay.status]?.tag}>{statusMap[selectedDay.status]?.label}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="In Time">{selectedDay.inTime || '-'}</Descriptions.Item>
            <Descriptions.Item label="Out Time">{selectedDay.outTime || '-'}</Descriptions.Item>
            <Descriptions.Item label="OT Hours">{selectedDay.otHours ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Remarks">{selectedDay.remarks || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </>
  );
};

export default AttendanceCalendar;
