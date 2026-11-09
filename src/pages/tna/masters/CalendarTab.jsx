import { useEffect, useState } from 'react';
import {
  Alert, App, Card, Checkbox, Col, Row, Table,
} from 'antd';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { getCalendar, saveSettings } from '../../../services/tna/tnaService';
import { hasPermission } from '../../../utils/permissions';
import { fmtDate } from '../../../utils/tnaConstants';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((label, value) => ({ value, label }));

const COLUMNS = [
  { title: 'Date', dataIndex: 'date', width: 120, render: fmtDate },
  { title: 'Day', dataIndex: 'date', key: 'dow', width: 110, render: (d) => dayjs(d).format('dddd') },
  { title: 'Holiday', dataIndex: 'name' },
];

/** FR-3.5 / A-02 — the working calendar: weekly off here, holidays from HR's holiday master (DEP-09). */
const CalendarTab = () => {
  const { message } = App.useApp();
  const [cal, setCal] = useState(null);
  const canEdit = hasPermission('tna-masters', 'update');

  useEffect(() => { getCalendar().then(setCal).catch(() => message.error('Failed to load the working calendar')); }, [message]);

  const saveWeeklyOff = async (weeklyOff) => {
    if (!weeklyOff.length) { message.warning('Keep at least one weekly off day'); return; }
    try {
      await saveSettings({ weeklyOff });
      setCal((c) => ({ ...c, weeklyOff }));
      message.success('Weekly off updated — plans are re-scheduled on it from their next sync');
    } catch (e) { message.error(e?.response?.data?.message || 'Failed to save the weekly off'); }
  };

  if (!cal) return null;
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={8}>
        <Card size="small" title="Working week">
          <div style={{ marginBottom: 8, fontSize: 13 }}>Weekly off</div>
          <Checkbox.Group disabled={!canEdit} options={WEEKDAYS} value={cal.weeklyOff} onChange={saveWeeklyOff} />
          <Alert
            type="info"
            style={{ marginTop: 12 }}
            title="Working-day activities count working days only and never land on a non-working day (BR-05). Calendar-day activities — buyer and supplier waits — count every day (BR-04)."
          />
        </Card>
      </Col>
      <Col xs={24} xl={16}>
        <Card size="small" title={`${cal.name} — ${cal.holidays.length} days declared`}>
          <Table rowKey={(h) => `${h.date}-${h.name}`} size="small" bordered pagination={false} dataSource={cal.holidays} columns={COLUMNS} scroll={{ y: 360 }} />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            Holidays are maintained once, in <Link to="/hr/masters">HR › Masters › Holidays</Link>; Time &amp; Action schedules on the active ones.
          </div>
        </Card>
      </Col>
    </Row>
  );
};

export default CalendarTab;
