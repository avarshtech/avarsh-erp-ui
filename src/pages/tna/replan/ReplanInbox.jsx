import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Segmented, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import StatusTag from '../../../components/StatusTag';
import { listReplans } from '../../../services/tna/tnaService';
import { REPLAN_STATUS } from '../../../utils/tnaConstants';
import { DATE_FORMAT } from '../../../utils/uiConstants';
import { getTablePagination } from '../../../utils/paginationConfig';
import CascadeModal from './CascadeModal';

/** §13 — re-plan approval inbox. Approving blind is not possible: review opens the cascade. */
const ReplanInbox = () => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('PENDING_APPROVAL');
  const [reviewing, setReviewing] = useState(null);

  const load = useCallback(() => {
    listReplans()
      .then(setRows)
      .catch(() => message.error('Failed to load re-plan requests'))
      .finally(() => setLoading(false));
  }, [message]);
  useEffect(load, [load]);

  const visible = useMemo(() => (tab === 'ALL' ? rows : rows.filter((r) => r.workflowStatus === tab)), [rows, tab]);

  const columns = useMemo(() => [
    {
      title: 'Order',
      dataIndex: 'orderNo',
      width: 190,
      render: (v, r) => (
        <div>
          <Link to={`/tna/plan/${r.planId}`} style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v}</Link>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{r.buyer} · {r.styleNo}</div>
        </div>
      ),
    },
    { title: 'Activity', dataIndex: 'activityName', render: (v, r) => <span><span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{r.activityCode}</span> {v}</span> },
    {
      title: 'Proposed Move',
      key: 'move',
      width: 230,
      render: (_, r) => {
        const shift = dayjs(r.proposedDate).diff(dayjs(r.currentDate), 'day');
        return (
          <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12.5 }}>
            {dayjs(r.currentDate).format(DATE_FORMAT)} → <strong>{dayjs(r.proposedDate).format(DATE_FORMAT)}</strong>
            <Tag color="orange" style={{ marginLeft: 6 }}>+{shift}d</Tag>
          </span>
        );
      },
    },
    { title: 'Reason', dataIndex: 'reasonCode', width: 150 },
    { title: 'Raised by', dataIndex: 'raisedBy', width: 110, render: (v, r) => <div style={{ fontSize: 12.5 }}>{v}<div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dayjs(r.raisedOn).format(DATE_FORMAT)}</div></div> },
    { title: 'Cascade', dataIndex: 'cascade', width: 80, align: 'center', render: (c) => <Tag>{c.length} dates</Tag> },
    { title: 'Status', dataIndex: 'workflowStatus', width: 140, render: (v) => <StatusTag status={v} config={REPLAN_STATUS} getLabel={(s) => REPLAN_STATUS[s].label} size="small" /> },
    {
      title: '',
      key: 'actions',
      width: 90,
      fixed: 'right',
      render: (_, r) => r.workflowStatus === 'PENDING_APPROVAL' && (
        <Button size="small" type="primary" onClick={() => setReviewing(r)}>Review</Button>
      ),
    },
  ], []);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Re-plan Approvals" subtitle="Date changes are proposals until approved here — the cascade preview shows every date that will move" />
      <Card size="small" styles={{ body: { paddingTop: 12 } }}>
        <Segmented
          value={tab}
          onChange={setTab}
          style={{ marginBottom: 12 }}
          options={[
            { value: 'PENDING_APPROVAL', label: `Pending (${rows.filter((r) => r.workflowStatus === 'PENDING_APPROVAL').length})` },
            { value: 'RETURNED', label: 'Returned' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'REJECTED', label: 'Rejected' },
            { value: 'ALL', label: 'All' },
          ]}
        />
        <Table
          rowKey="id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={visible}
          pagination={getTablePagination({ pageSize: 10 }, 'requests')}
          scroll={{ x: 1000 }}
        />
      </Card>
      <CascadeModal
        open={!!reviewing}
        replan={reviewing}
        onClose={() => setReviewing(null)}
        onActioned={() => { setReviewing(null); load(); }}
      />
    </div>
  );
};

export default ReplanInbox;
