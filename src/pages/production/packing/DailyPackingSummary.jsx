import { useState, useEffect, useMemo } from 'react';
import { App, Card, DatePicker, Space, Table, Typography } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getDailyPackingSummary } from '../../../services/production/packingService';
import { formatDate, formatNumber } from '../../../utils/formatters';
import { DATE_FORMAT } from '../../../utils/uiConstants';

const { Text } = Typography;

const isFutureDay = (d) => Boolean(d) && d.isAfter(dayjs(), 'day');

const COLUMNS = [
  { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 170, ellipsis: true, render: (v) => <Text strong>{v || '—'}</Text> },
  { title: 'Order', dataIndex: 'orderNo', key: 'orderNo', width: 160 },
  { title: 'Buyer', dataIndex: 'buyerName', key: 'buyerName', ellipsis: true },
  { title: 'Entries', dataIndex: 'entryCount', key: 'entryCount', width: 90, align: 'right' },
  { title: 'Cartons', dataIndex: 'cartons', key: 'cartons', width: 110, align: 'right', render: (v) => formatNumber(v) },
  { title: 'Pieces', dataIndex: 'pieces', key: 'pieces', width: 120, align: 'right', render: (v) => <Text strong>{formatNumber(v)}</Text> },
];

/**
 * Daily Packing — what was packed on one day, per style and order. Every entry
 * dated that day counts, open or completed. `refreshKey` re-reads the day after
 * the register below changes.
 */
const DailyPackingSummary = ({ refreshKey }) => {
  const { message } = App.useApp();
  const [date, setDate] = useState(() => dayjs());
  const dateKey = date.format('YYYY-MM-DD');
  const requestKey = `${dateKey}#${refreshKey}`;
  // Loading is derived: the stored rows belong to an older request until this one lands.
  const [result, setResult] = useState({ key: null, rows: [] });
  const loading = result.key !== requestKey;
  const { rows } = result;

  useEffect(() => {
    let cancelled = false;
    getDailyPackingSummary(dateKey)
      .then((data) => { if (!cancelled) setResult({ key: requestKey, rows: data || [] }); })
      .catch((e) => {
        if (cancelled) return;
        setResult({ key: requestKey, rows: [] });
        message.error(e.message || 'Failed to load the daily packing summary');
      });
    return () => { cancelled = true; };
  }, [dateKey, requestKey, message]);

  const totals = useMemo(
    () => rows.reduce((t, r) => ({ cartons: t.cartons + r.cartons, pieces: t.pieces + r.pieces }), { cartons: 0, pieces: 0 }),
    [rows],
  );

  return (
    <Card
      title={<Space size={8}><CalendarOutlined /><span>Daily Packing</span></Space>}
      extra={(
        <DatePicker
          name="dailyPackingDate"
          aria-label="Daily packing date"
          value={date}
          format={DATE_FORMAT}
          disabledDate={isFutureDay}
          allowClear={false}
          onChange={(d) => d && setDate(d)}
        />
      )}
      style={{ marginBottom: 16 }}
    >
      <Table
        columns={COLUMNS}
        dataSource={rows}
        rowKey="orderId"
        size="small"
        loading={loading}
        pagination={false}
        scroll={{ x: 720 }}
        locale={{ emptyText: `Nothing packed on ${formatDate(date)}` }}
        summary={() => (rows.length ? (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={4}><Text strong>Total</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="right"><Text strong>{formatNumber(totals.cartons)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={5} align="right"><Text strong>{formatNumber(totals.pieces)}</Text></Table.Summary.Cell>
          </Table.Summary.Row>
        ) : null)}
      />
    </Card>
  );
};

export default DailyPackingSummary;
