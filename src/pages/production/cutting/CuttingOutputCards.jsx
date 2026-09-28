import { useMemo } from 'react';
import dayjs from 'dayjs';
import { Card, Row, Col, Table, Tooltip, Progress, Typography } from 'antd';
import EmptyState from '../../../components/EmptyState';

const { Text } = Typography;
const fmt = (n) => (n || 0).toLocaleString('en-IN');
const BAR_AREA = 120;

/** Pieces cut per day, oldest on the left; a quiet day is a stub, not a gap. */
const DailyBars = ({ days }) => {
  const max = Math.max(1, ...days.map((d) => d.qty));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: BAR_AREA + 18 }}>
      {days.map((d, i) => (
        <div key={d.date} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
          <Tooltip title={`${dayjs(d.date).format('ddd, DD MMM')}: ${fmt(d.qty)} pcs`}>
            <div style={{
              height: Math.max(2, Math.round((d.qty / max) * BAR_AREA)), borderRadius: '3px 3px 0 0',
              background: d.qty ? 'var(--primary-color)' : 'var(--bg-secondary)',
            }} />
          </Tooltip>
          <Text type="secondary" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>
            {i % 5 === 4 || i === days.length - 1 ? dayjs(d.date).format('DD MMM') : ' '}
          </Text>
        </div>
      ))}
    </div>
  );
};

const YESTERDAY_COLUMNS = [
  { title: 'Style', dataIndex: 'styleNo', width: 150, render: (v) => <Text strong>{v}</Text> },
  { title: 'Cut PO', dataIndex: 'cutPoNos', ellipsis: true },
  { title: 'Cut Qty', dataIndex: 'qty', width: 110, align: 'right', render: fmt },
];

const PENDING_COLUMNS = [
  { title: 'Style', dataIndex: 'styleNo', width: 130, render: (v) => <Text strong>{v}</Text> },
  { title: 'Cut POs', dataIndex: 'cutPoCount', width: 80, align: 'center' },
  { title: 'Planned', dataIndex: 'plannedQty', width: 95, align: 'right', render: fmt },
  { title: 'Cut', dataIndex: 'cutQty', width: 95, align: 'right', render: fmt },
  { title: 'Pending', dataIndex: 'pendingQty', width: 95, align: 'right',
    render: (v) => <Text strong type={v > 0 ? 'warning' : 'success'}>{fmt(v)}</Text> },
  { title: 'Done', key: 'pct', width: 120,
    render: (_, r) => <Progress size="small" percent={r.plannedQty ? Math.min(100, Math.round((r.cutQty / r.plannedQty) * 100)) : 0} /> },
];

/** Dashboard output views: the last 30 days, yesterday by style, and what is still to cut by style. */
const CuttingOutputCards = ({ data }) => {
  const days = useMemo(() => data.dailyCut || [], [data.dailyCut]);
  const total = days.reduce((s, d) => s + d.qty, 0);
  const cutDays = days.filter((d) => d.qty > 0).length;
  const yesterday = data.yesterdayByStyle || [];
  const yesterdayTotal = yesterday.reduce((s, r) => s + r.qty, 0);

  return (
    <>
      <Card title="Cutting — Last 30 Days" size="small" style={{ marginBottom: 16 }}
        extra={<Text type="secondary">Total <Text strong>{fmt(total)}</Text> pcs · Avg <Text strong>{fmt(cutDays ? Math.round(total / cutDays) : 0)}</Text> pcs per cutting day</Text>}>
        <DailyBars days={days} />
      </Card>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={10}>
          <Card size="small" title={`Yesterday's Cutting — ${dayjs().subtract(1, 'day').format('DD MMM')}`}
            extra={<Text strong>{fmt(yesterdayTotal)} pcs</Text>}>
            <Table rowKey="styleNo" size="small" pagination={false} columns={YESTERDAY_COLUMNS} dataSource={yesterday}
              locale={{ emptyText: <EmptyState title="Nothing cut yesterday" description="Lays recorded in the Cutting Report show here" /> }} />
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card size="small" title="Cutting POs Raised vs Pending to Cut — Style-wise">
            <Table rowKey="styleNo" size="small" pagination={false} columns={PENDING_COLUMNS}
              dataSource={data.pendingByStyle || []} scroll={{ x: 620 }}
              locale={{ emptyText: <EmptyState title="No approved Cutting POs" description="Approved Cutting POs show here until fully cut" /> }} />
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default CuttingOutputCards;
