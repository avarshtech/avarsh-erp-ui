import { useEffect, useState } from 'react';
import {
  Alert, App, Button, Card, Checkbox, Col, DatePicker, Input, Row, Space, Table,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getCalendar, saveCalendar } from '../../../services/tna/tnaService';
import { hasPermission } from '../../../utils/permissions';
import { fmtDate } from '../../../utils/tnaConstants';
import { DATE_FORMAT } from '../../../utils/uiConstants';
import DeleteConfirm from '../../../components/buttons/DeleteConfirm';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((label, value) => ({ value, label }));

/** FR-3.5 / A-02 — the factory working calendar: weekly off and declared holidays. */
const CalendarTab = () => {
  const { message } = App.useApp();
  const [cal, setCal] = useState(null);
  const [draft, setDraft] = useState({ date: null, name: '' });
  const canEdit = hasPermission('tna-masters', 'update');

  useEffect(() => { getCalendar().then(setCal).catch((e) => message.error(e.message)); }, [message]);

  const persist = async (next, note) => {
    try {
      setCal(await saveCalendar(next));
      message.success(`${note} — applies to plans generated from now on`);
    } catch (e) { message.error(e.message); }
  };

  const addHoliday = () => {
    if (!draft.date || !draft.name.trim()) { message.warning('Enter a date and a name'); return; }
    const date = draft.date.format('YYYY-MM-DD');
    if (cal.holidays.some((h) => h.date === date)) { message.warning('That date is already declared'); return; }
    persist({ ...cal, holidays: [...cal.holidays, { date, name: draft.name.trim() }].sort((a, b) => (a.date < b.date ? -1 : 1)) }, 'Holiday declared');
    setDraft({ date: null, name: '' });
  };

  if (!cal) return null;
  const columns = [
    { title: 'Date', dataIndex: 'date', width: 120, render: fmtDate },
    { title: 'Day', dataIndex: 'date', key: 'dow', width: 110, render: (d) => dayjs(d).format('dddd') },
    { title: 'Holiday', dataIndex: 'name' },
    ...(hasPermission('tna-masters', 'delete') ? [{
      title: '', key: 'x', width: 90,
      render: (_, h) => (
        <DeleteConfirm recordLabel={`${h.name} (${fmtDate(h.date)})`} onConfirm={() => persist({ ...cal, holidays: cal.holidays.filter((x) => x.date !== h.date) }, 'Holiday removed')}>
          <Button size="small" danger>Remove</Button>
        </DeleteConfirm>
      ),
    }] : []),
  ];

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={8}>
        <Card size="small" title="Working week">
          <div style={{ marginBottom: 8, fontSize: 13 }}>Weekly off</div>
          <Checkbox.Group disabled={!canEdit} options={WEEKDAYS} value={cal.weeklyOff} onChange={(v) => persist({ ...cal, weeklyOff: v }, 'Weekly off updated')} />
          <Alert
            type="info"
            style={{ marginTop: 12 }}
            title="Working-day activities count working days only and never land on a non-working day (BR-05). Calendar-day activities — buyer and supplier waits — count every day (BR-04)."
          />
        </Card>
      </Col>
      <Col xs={24} xl={16}>
        <Card size="small" title={`${cal.name} — ${cal.holidays.length} days declared`}>
          {canEdit && (
            <Space wrap style={{ marginBottom: 10 }}>
              <DatePicker name="holidayDate" format={DATE_FORMAT} value={draft.date} onChange={(d) => setDraft((x) => ({ ...x, date: d }))} />
              <Input name="holidayName" placeholder="Holiday name" style={{ width: 220 }} value={draft.name} onChange={(e) => setDraft((x) => ({ ...x, name: e.target.value }))} maxLength={60} />
              <Button icon={<PlusOutlined />} onClick={addHoliday}>Declare holiday</Button>
            </Space>
          )}
          <Table rowKey="date" size="small" bordered pagination={false} dataSource={cal.holidays} columns={columns} scroll={{ y: 360 }} />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            The holiday list is owned by HR / Administration (DEP-09). The 2026 list reproduces the CR worked example: 26-Aug, 02-Oct, 20-Oct and 21-Oct fall inside its plan period.
          </div>
        </Card>
      </Col>
    </Row>
  );
};

export default CalendarTab;
