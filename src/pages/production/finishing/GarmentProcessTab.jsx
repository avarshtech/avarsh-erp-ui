import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Segmented, Table, Space, Tag } from 'antd';
import { ImportOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { listProcessIssues, listProcessReturns, cancelProcessIssue } from '../../../services/production/finishingService';
import FinishingStatusTag from './FinishingStatusTag';
import GarmentIssueDrawer from './GarmentIssueDrawer';
import GarmentReceiveDrawer from './GarmentReceiveDrawer';

const ISSUE_VIEW = 'Garment Issue to Process';
const RECEIVE_VIEW = 'Garment Receive from Process';
const OPEN = ['ISSUED', 'PARTIALLY_RETURNED'];
const fmtDate = (v) => (v ? dayjs(v).format('DD-MMM-YYYY') : '—');
const lineTags = (lines, qtyKey) => (lines || []).map((l) => (
  <Tag key={`${l.color}-${l.size}`}>{l.color} {l.size} × {l[qtyKey]}</Tag>
));

/** External Process — garments sent out for washing, printing or embroidery against a Work Order, and received back. */
const GarmentProcessTab = () => {
  const { message, modal } = App.useApp();
  const [view, setView] = useState(ISSUE_VIEW);
  const [issues, setIssues] = useState([]);
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [issueOpen, setIssueOpen] = useState(false);
  const [receive, setReceive] = useState({ open: false, issueId: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [i, r] = await Promise.all([listProcessIssues(), listProcessReturns()]);
      setIssues(i); setReturns(r);
    } catch { message.error('Failed to load external process records'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const cancelIssue = useCallback((r) => modal.confirm({
    title: `Cancel ${r.issueNo}?`,
    content: 'Nothing has come back against it, so its garments count as never sent.',
    okText: 'Cancel Issue', okButtonProps: { danger: true }, cancelText: 'Keep',
    onOk: async () => {
      try {
        await cancelProcessIssue(r.id);
        message.success(`${r.issueNo} cancelled`);
        load();
      } catch (e) { message.error(e?.response?.data?.message || 'Failed to cancel the issue'); }
    },
  }), [modal, message, load]);

  const issueColumns = useMemo(() => [
    { title: 'Process PO #', dataIndex: 'issueNo', width: 160, fixed: 'left', render: (v) => <code>{v}</code> },
    { title: 'Process', dataIndex: 'processName', width: 130, render: (v) => <Tag color="geekblue">{v}</Tag> },
    { title: 'Work Order', dataIndex: 'workOrderNo', width: 150 },
    { title: 'Style', dataIndex: 'styleNo', width: 130 },
    { title: 'Vendor', dataIndex: 'vendorName', width: 170, ellipsis: true, render: (v) => v || '—' },
    { title: 'Issued', dataIndex: 'issueDate', width: 110, render: fmtDate },
    { title: 'Due Back', dataIndex: 'expectedReturnDate', width: 110, render: fmtDate },
    { title: 'Colour / Size', dataIndex: 'lines', width: 260, render: (l) => lineTags(l, 'issueQty') },
    { title: 'Issued Qty', dataIndex: 'totalIssuedQty', width: 95, align: 'right', render: (v) => <strong>{v}</strong> },
    { title: 'Received', dataIndex: 'totalReceivedQty', width: 90, align: 'right' },
    { title: 'Rejected', dataIndex: 'totalRejectedQty', width: 90, align: 'right',
      render: (v) => (v > 0 ? <span style={{ color: 'var(--error-color)' }}>{v}</span> : 0) },
    { title: 'With Vendor', dataIndex: 'totalPendingQty', width: 105, align: 'right',
      render: (v) => (v > 0 ? <strong style={{ color: 'var(--warning-color)' }}>{v}</strong> : 0) },
    { title: 'Status', dataIndex: 'status', width: 160, render: (v) => <FinishingStatusTag status={v} /> },
    { title: 'Actions', key: 'act', width: 100, fixed: 'right', align: 'center',
      render: (_, r) => (OPEN.includes(r.status) ? (
        <Space size={0}>
          <ActionButton icon={<ImportOutlined />} tooltip="Receive garments back" aria-label={`Receive ${r.issueNo}`}
            onClick={() => setReceive({ open: true, issueId: r.id })} />
          {r.totalReceivedQty + r.totalRejectedQty === 0 && (
            <ActionButton action="cancel" tooltip="Cancel issue" aria-label={`Cancel ${r.issueNo}`} onClick={() => cancelIssue(r)} />
          )}
        </Space>
      ) : null) },
  ], [cancelIssue]);

  const returnColumns = useMemo(() => [
    { title: 'Receipt #', dataIndex: 'returnNo', width: 160, fixed: 'left', render: (v) => <code>{v}</code> },
    { title: 'Process PO #', dataIndex: 'issueNo', width: 160, render: (v) => <code>{v}</code> },
    { title: 'Process', dataIndex: 'processName', width: 130, render: (v) => <Tag color="geekblue">{v}</Tag> },
    { title: 'Work Order', dataIndex: 'workOrderNo', width: 150 },
    { title: 'Vendor', dataIndex: 'vendorName', width: 170, ellipsis: true, render: (v) => v || '—' },
    { title: 'Vendor DC #', dataIndex: 'vendorDcNo', width: 130, render: (v) => v || '—' },
    { title: 'Date', dataIndex: 'returnDate', width: 110, render: fmtDate },
    { title: 'Colour / Size', dataIndex: 'lines', width: 260, render: (l) => lineTags(l, 'receivedQty') },
    { title: 'Received', dataIndex: 'totalReceivedQty', width: 95, align: 'right', render: (v) => <strong>{v}</strong> },
    { title: 'Rejected', dataIndex: 'totalRejectedQty', width: 90, align: 'right',
      render: (v) => (v > 0 ? <span style={{ color: 'var(--error-color)' }}>{v}</span> : 0) },
  ], []);

  const isIssue = view === ISSUE_VIEW;
  const openIssues = useMemo(() => issues.filter((i) => OPEN.includes(i.status)), [issues]);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }} wrap>
        <Segmented options={[ISSUE_VIEW, RECEIVE_VIEW]} value={view} onChange={setView} />
        {isIssue
          ? <ActionButton action="create" text="Issue Garments" onClick={() => setIssueOpen(true)} />
          : <ActionButton action="create" text="Receive Garments" disabled={!openIssues.length}
              tooltip={openIssues.length ? undefined : 'No garments are out with a process vendor'}
              onClick={() => setReceive({ open: true, issueId: null })} />}
      </Space>
      <Table
        rowKey="id"
        size="small"
        loading={loading}
        columns={isIssue ? issueColumns : returnColumns}
        dataSource={isIssue ? issues : returns}
        scroll={{ x: isIssue ? 1950 : 1560 }}
        pagination={getTablePagination({ pageSize: 10 }, isIssue ? 'garment-process-issues' : 'garment-process-returns')}
        locale={{ emptyText: <EmptyState
          title={isIssue ? 'No garments issued to a process' : 'Nothing received back yet'}
          description={isIssue ? 'Issue an approved Work Order\'s garments for washing, printing or embroidery'
            : 'Record what comes back from the vendor against its Process PO'} /> }}
      />
      <GarmentIssueDrawer open={issueOpen} onClose={() => setIssueOpen(false)}
        onSaved={() => { setIssueOpen(false); load(); }} />
      <GarmentReceiveDrawer open={receive.open} issues={openIssues} issueId={receive.issueId}
        onClose={() => setReceive({ open: false, issueId: null })}
        onSaved={() => { setReceive({ open: false, issueId: null }); load(); }} />
    </Card>
  );
};

export default GarmentProcessTab;
