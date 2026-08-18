import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Calendar, Select, Row, Col, Tag, Drawer, Descriptions, Space, Spin,
  Card, Statistic, DatePicker, Segmented, Empty, Typography, Divider,
} from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getAttendanceCalendar, getAttendanceSummary } from '../../../services/hr/attendanceService';
import { searchEmployees } from '../../../services/hr/employeeService';
import { getActiveFactories } from '../../../services/master/factoryService';
import { getActiveDepartmentsByFactory } from '../../../services/master/hrMasterService';
import { ATTENDANCE_STATUS } from '../../../utils/hrConstants';
import { employeeOptions, factoryOptions } from '../../../utils/hrLabels';
import PageHeader from '../../../components/PageHeader';

const { Text } = Typography;

const statusMap = Object.fromEntries(ATTENDANCE_STATUS.map((s) => [s.value, s]));

/**
 * Short labels for the coloured cell. The full label is too long to read at
 * calendar-cell width, so each status gets an abbreviation that still reads as
 * a word rather than a code.
 */
const CELL_LABEL = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  HALF_DAY: 'Half Day',
  WEEKLY_OFF: 'Week Off',
  NATIONAL_HOLIDAY: 'Holiday',
  LEAVE: 'Leave',
  ON_DUTY: 'On Duty',
};

/**
 * Text colour for a filled cell. The weekly-off grey is light enough that white
 * text on it fails contrast, so it keeps dark text.
 */
const LIGHT_BACKGROUNDS = new Set(['WEEKLY_OFF']);

const textColourFor = (status) => (LIGHT_BACKGROUNDS.has(status) ? 'rgba(0,0,0,0.75)' : '#fff');

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

  // Summary can follow the calendar month or a range the user picks.
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [rangeMode, setRangeMode] = useState('MONTH');
  const [customRange, setCustomRange] = useState([dayjs().startOf('month'), dayjs()]);

  // Employment dates drive whether a blank day is a gap or simply out of scope.
  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === employeeId) || null,
    [employees, employeeId],
  );
  const joiningDate = useMemo(
    () => (selectedEmployee?.dateOfJoining ? dayjs(selectedEmployee.dateOfJoining) : null),
    [selectedEmployee],
  );
  const leavingDate = useMemo(
    () => (selectedEmployee?.dateOfLeaving ? dayjs(selectedEmployee.dateOfLeaving) : null),
    [selectedEmployee],
  );

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
      // The API returns an AttendanceCalendarDTO object, not a bare array - the
      // days live under `days`. Treating the response itself as an array threw
      // a TypeError that the empty catch below reported as a load failure.
      const map = {};
      (data?.days || []).forEach((item) => {
        map[item.date] = item;
      });
      setCalendarData(map);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to load attendance calendar');
    } finally {
      setLoading(false);
    }
  }, [employeeId, currentMonth, message]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const summaryRange = useMemo(() => {
    if (rangeMode === 'CUSTOM' && customRange?.[0] && customRange?.[1]) {
      return [customRange[0], customRange[1]];
    }
    return [currentMonth.startOf('month'), currentMonth.endOf('month')];
  }, [rangeMode, customRange, currentMonth]);

  const fetchSummary = useCallback(async () => {
    if (!employeeId) {
      setSummary(null);
      return;
    }
    setSummaryLoading(true);
    try {
      const data = await getAttendanceSummary(
        employeeId,
        summaryRange[0].format('YYYY-MM-DD'),
        summaryRange[1].format('YYYY-MM-DD'),
      );
      setSummary(data);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to load attendance summary');
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [employeeId, summaryRange, message]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

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

  /**
   * Fills the whole cell with the status colour and writes the status in it.
   * A coloured dot alone forced a lookup against the legend for every day.
   */
  const cellRender = useCallback((current) => {
    const key = current.format('YYYY-MM-DD');
    const record = calendarData[key];

    // No record. Distinguish a genuine gap from a day outside employment or
    // still in the future, so a mid-month joiner is not shown as missing data.
    if (!record) {
      const outsideEmployment =
        (joiningDate && current.isBefore(joiningDate, 'day')) ||
        (leavingDate && current.isAfter(leavingDate, 'day'));
      if (outsideEmployment || current.isAfter(dayjs(), 'day')) return null;

      return (
        <div style={{
          border: '1px dashed rgba(0,0,0,0.15)', borderRadius: 4, textAlign: 'center',
          padding: '4px 2px', fontSize: 11, color: 'rgba(0,0,0,0.35)',
        }}>
          Not marked
        </div>
      );
    }

    const status = statusMap[record.status];
    if (!status) return null;

    const session = record.halfDaySession === 'SECOND_HALF' ? '2nd'
      : record.halfDaySession === 'FIRST_HALF' ? '1st' : null;

    return (
      <div
        onClick={() => handleDayClick(current)}
        style={{
          cursor: 'pointer', textAlign: 'center', borderRadius: 4,
          background: status.color, color: textColourFor(record.status),
          padding: '4px 2px', lineHeight: 1.3, minHeight: 34,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600 }}>
          {CELL_LABEL[record.status] || status.label}
        </div>
        {session && <div style={{ fontSize: 10, opacity: 0.9 }}>{session} half</div>}
        {record.leaveTypeName && (
          <div style={{ fontSize: 10, opacity: 0.9 }}>{record.leaveTypeName}</div>
        )}
        {Number(record.otHours) > 0 && (
          <div style={{ fontSize: 10, opacity: 0.9 }}>OT {record.otHours}h</div>
        )}
      </div>
    );
  }, [calendarData, handleDayClick, joiningDate, leavingDate]);

  const legend = useMemo(() => (
    <Space wrap size={[8, 8]} style={{ marginBottom: 16 }}>
      {ATTENDANCE_STATUS.map((s) => (
        <span
          key={s.value}
          style={{
            background: s.color, color: textColourFor(s.value),
            borderRadius: 4, padding: '2px 10px', fontSize: 12, fontWeight: 500,
          }}
        >
          {CELL_LABEL[s.value] || s.label}
        </span>
      ))}
      <span style={{
        border: '1px dashed rgba(0,0,0,0.2)', borderRadius: 4,
        padding: '2px 10px', fontSize: 12, color: 'rgba(0,0,0,0.45)',
      }}>
        Not marked
      </span>
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
            options={factoryOptions(factories)}
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
            options={employeeOptions(employees)}
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

      {employeeId && (
        <Card
          size="small"
          style={{ marginTop: 16 }}
          title={
            <Space wrap>
              <span>Summary</span>
              <Segmented
                size="small"
                value={rangeMode}
                onChange={setRangeMode}
                options={[
                  { value: 'MONTH', label: currentMonth.format('MMM YYYY') },
                  { value: 'CUSTOM', label: 'Custom range' },
                ]}
              />
              {rangeMode === 'CUSTOM' && (
                <DatePicker.RangePicker
                  size="small"
                  value={customRange}
                  onChange={setCustomRange}
                  format="DD-MMM-YYYY"
                  allowClear={false}
                />
              )}
            </Space>
          }
        >
          <Spin spinning={summaryLoading}>
            {!summary ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No summary" />
            ) : (
              <>
                <Row gutter={[16, 16]}>
                  <Col xs={12} sm={8} md={4}>
                    <Statistic title="Present" value={summary.present} valueStyle={{ color: '#52c41a' }} />
                  </Col>
                  <Col xs={12} sm={8} md={4}>
                    <Statistic title="Absent" value={summary.absent} valueStyle={{ color: '#ff4d4f' }} />
                  </Col>
                  <Col xs={12} sm={8} md={4}>
                    <Statistic
                      title="Half Day"
                      value={summary.halfDay}
                      valueStyle={{ color: '#faad14' }}
                      suffix={
                        summary.halfDay > 0
                          ? <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                              ({summary.halfDayFirst} 1st / {summary.halfDaySecond} 2nd)
                            </span>
                          : null
                      }
                    />
                  </Col>
                  <Col xs={12} sm={8} md={4}>
                    <Statistic title="Leave" value={summary.leave} valueStyle={{ color: '#1677ff' }} />
                  </Col>
                  <Col xs={12} sm={8} md={4}>
                    <Statistic title="On Duty" value={summary.onDuty} valueStyle={{ color: '#13c2c2' }} />
                  </Col>
                  <Col xs={12} sm={8} md={4}>
                    <Statistic title="Week Off" value={summary.weeklyOff} />
                  </Col>
                  <Col xs={12} sm={8} md={4}>
                    <Statistic title="Holiday" value={summary.holiday} valueStyle={{ color: '#722ed1' }} />
                  </Col>
                  <Col xs={12} sm={8} md={4}>
                    <Statistic title="OT Hours" value={summary.totalOtHours ?? 0} />
                  </Col>
                  <Col xs={12} sm={8} md={4}>
                    <Statistic title="Payable Days" value={summary.payableDays ?? 0} valueStyle={{ fontWeight: 600 }} />
                  </Col>
                  <Col xs={12} sm={8} md={4}>
                    <Statistic title="LOP Days" value={summary.lopDays ?? 0} valueStyle={{ color: '#ff4d4f' }} />
                  </Col>
                  <Col xs={12} sm={8} md={4}>
                    <Statistic
                      title="Not Marked"
                      value={summary.notMarked}
                      valueStyle={{ color: summary.notMarked > 0 ? '#fa8c16' : undefined }}
                    />
                  </Col>
                </Row>

                {summary.leaveBreakdown?.length > 0 && (
                  <>
                    <Divider style={{ margin: '12px 0' }} />
                    <Space wrap size={[8, 8]}>
                      <Text type="secondary">Leave taken:</Text>
                      {summary.leaveBreakdown.map((l) => (
                        <Tag key={l.leaveTypeName} color="blue">
                          {l.leaveTypeName}: {l.days}
                        </Tag>
                      ))}
                    </Space>
                  </>
                )}

                {/* Context that stops the counts being misread. */}
                {(summary.outsideEmployment > 0 || summary.future > 0 || summary.notMarked > 0) && (
                  <>
                    <Divider style={{ margin: '12px 0' }} />
                    <Space wrap size={[8, 8]}>
                      {summary.notMarked > 0 && (
                        <Tag color="orange">
                          {summary.notMarked} day(s) not marked — these are gaps in the record
                        </Tag>
                      )}
                      {summary.outsideEmployment > 0 && (
                        <Tag>
                          {summary.outsideEmployment} day(s) outside employment
                          {summary.dateOfJoining && ` (joined ${dayjs(summary.dateOfJoining).format('DD-MMM-YYYY')})`}
                          {summary.dateOfLeaving && ` (left ${dayjs(summary.dateOfLeaving).format('DD-MMM-YYYY')})`}
                        </Tag>
                      )}
                      {summary.future > 0 && <Tag>{summary.future} day(s) still to come</Tag>}
                    </Space>
                  </>
                )}
              </>
            )}
          </Spin>
        </Card>
      )}

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
