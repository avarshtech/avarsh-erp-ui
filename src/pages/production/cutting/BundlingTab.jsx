import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Segmented, Table, Space, Tag } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { listBundles, listBundleIssues, getCutPos, listTmbChecks } from '../../../services/production/cuttingService';
import CuttingStatusTag from './CuttingStatusTag';
import BundlingDrawer from './BundlingDrawer';
import BundleIssueDrawer from './BundleIssueDrawer';
import BundleTicketPreview from './BundleTicketPreview';

/** FR-06 + FR-07 — bundle generation, QR tickets and issue to sewing lines. */
const BundlingTab = () => {
  const { message } = App.useApp();
  const [view, setView] = useState('Bundles');
  const [bundles, setBundles] = useState([]);
  const [issues, setIssues] = useState([]);
  const [cutPos, setCutPos] = useState([]);
  const [tmbChecks, setTmbChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bundlingOpen, setBundlingOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [ticket, setTicket] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, i, p, t] = await Promise.all([listBundles(), listBundleIssues(), getCutPos(), listTmbChecks()]);
      setBundles(b); setIssues(i); setCutPos(p); setTmbChecks(t);
    } catch { message.error('Failed to load bundles'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const poOf = useCallback((id) => cutPos.find((p) => p.id === id), [cutPos]);

  const bundleColumns = useMemo(() => [
    { title: 'Bundle #', dataIndex: 'bundleNo', width: 90, align: 'center', render: (v) => <strong>B-{v}</strong> },
    { title: 'Cut PO', dataIndex: 'cuttingPoId', width: 150, render: (v) => poOf(v)?.cutPoNo || '—' },
    { title: 'Size', dataIndex: 'size', width: 70, align: 'center' },
    { title: 'Pieces', dataIndex: 'qty', width: 80, align: 'center' },
    { title: 'Serial Range', dataIndex: 'range', width: 110, align: 'center', render: (v) => <code>{v}</code> },
    { title: 'Status', dataIndex: 'status', width: 150, render: (v) => <CuttingStatusTag status={v} /> },
    {
      title: 'Ticket', key: 'ticket', width: 90, align: 'center', fixed: 'right',
      render: (_, r) => <ActionButton action="print" size="small" onClick={() => setTicket({ bundle: r, po: poOf(r.cuttingPoId) })} />,
    },
  ], [poOf]);

  const issueColumns = useMemo(() => [
    { title: 'Issue #', dataIndex: 'issueNo', width: 170, render: (v) => <code>{v}</code> },
    { title: 'Work Order', dataIndex: 'workOrderNo', width: 150 },
    { title: 'Cut PO', dataIndex: 'cuttingPoNo', width: 150 },
    { title: 'Date', dataIndex: 'issueDate', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    {
      title: 'Bundles', dataIndex: 'bundles', width: 220,
      render: (rows) => (rows || []).map((b) => <Tag key={b.id}>B-{b.bundleNo} ({b.size})</Tag>),
    },
    { title: 'Total Pieces', dataIndex: 'totalPcs', width: 110, align: 'center', render: (v) => <strong>{v}</strong> },
    { title: 'Issued By', dataIndex: 'issuedBy', width: 130 },
  ], []);

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <Segmented options={['Bundles', 'Issues to Sewing']} value={view} onChange={setView} />
        <Space>
          <ActionButton action="create" text="Generate Bundles" onClick={() => setBundlingOpen(true)} />
          <ActionButton action="send" text="Issue to Sewing" onClick={() => setIssueOpen(true)} />
        </Space>
      </Space>
      {view === 'Bundles' ? (
        <Table rowKey="id" size="small" columns={bundleColumns} dataSource={bundles} loading={loading}
          scroll={{ x: 850 }} pagination={getTablePagination({ pageSize: 12 }, 'bundles')}
          locale={{ emptyText: <EmptyState title="No bundles" description="Generate bundles once TMB check has passed" /> }} />
      ) : (
        <Table rowKey="id" size="small" columns={issueColumns} dataSource={issues} loading={loading}
          scroll={{ x: 1000 }} pagination={getTablePagination({ pageSize: 10 }, 'issues')}
          locale={{ emptyText: <EmptyState title="No bundle issues" description="Issue verified bundles to a sewing line" /> }} />
      )}
      <BundlingDrawer open={bundlingOpen} cutPos={cutPos} tmbChecks={tmbChecks}
        onClose={() => setBundlingOpen(false)} onSaved={() => { setBundlingOpen(false); load(); }} />
      <BundleIssueDrawer open={issueOpen} cutPos={cutPos} bundles={bundles}
        onClose={() => setIssueOpen(false)} onSaved={() => { setIssueOpen(false); load(); }} />
      <BundleTicketPreview ticket={ticket} onClose={() => setTicket(null)} />
    </Card>
  );
};

export default BundlingTab;
