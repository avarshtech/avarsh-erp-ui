import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Segmented, Table, Space, Tag } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import RecordLink from '../../../components/RecordLink';
import { getTablePagination } from '../../../utils/paginationConfig';
import { listPanelIssues, listPanelChecks, listProcessReturns, getCutPos } from '../../../services/production/cuttingService';
import CuttingStatusTag from './CuttingStatusTag';
import PanelIssueDrawer from './PanelIssueDrawer';
import ProcessReturnDrawer from './ProcessReturnDrawer';

/** FR-08/09/10 — panels sent to printing/embroidery/washing, checked and received back. */
const ExternalProcessTab = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [view, setView] = useState('Panel Issues');
  const [issues, setIssues] = useState([]);
  const [checks, setChecks] = useState([]);
  const [returns, setReturns] = useState([]);
  const [cutPos, setCutPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [issueOpen, setIssueOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [i, c, r, p] = await Promise.all([listPanelIssues(), listPanelChecks(), listProcessReturns(), getCutPos()]);
      setIssues(i); setChecks(c); setReturns(r); setCutPos(p);
    } catch { message.error('Failed to load external process records'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const poNo = useCallback((id) => cutPos.find((p) => p.id === id)?.cutPoNo || '—', [cutPos]);

  const issueColumns = useMemo(() => [
    { title: 'Panel PO #', dataIndex: 'panelPoNo', width: 160, render: (v) => <code>{v}</code> },
    { title: 'Process', dataIndex: 'process', width: 120, render: (v) => <Tag color="geekblue">{v}</Tag> },
    { title: 'Cut PO', dataIndex: 'cutPoId', width: 150, render: poNo },
    { title: 'Date', dataIndex: 'date', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    {
      title: 'Panels', dataIndex: 'lines', width: 240,
      render: (lines) => lines.map((l, i) => <Tag key={i}>{l.panel} {l.size} × {l.issueQty}</Tag>),
    },
    { title: 'Issued Qty', key: 'qty', width: 100, align: 'center', render: (_, r) => <strong>{r.lines.reduce((s, l) => s + l.issueQty, 0)}</strong> },
    { title: 'Status', dataIndex: 'status', width: 160, render: (v) => <CuttingStatusTag status={v} /> },
  ], [poNo]);

  const checkColumns = useMemo(() => [
    { title: 'Check #', dataIndex: 'id', width: 90, align: 'center', render: (v) => <RecordLink text={`PC-${String(v).padStart(3, '0')}`} onClick={() => navigate(`/production/cutting/panel-check/${v}`)} /> },
    { title: 'Process', dataIndex: 'process', width: 120, render: (v) => <Tag color="geekblue">{v}</Tag> },
    { title: 'Cut PO', dataIndex: 'cutPoId', width: 150, render: poNo },
    { title: 'Date', dataIndex: 'date', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    { title: 'Ranges Checked', key: 'rows', width: 120, align: 'center', render: (_, r) => r.rows.length },
    {
      title: 'Verified', key: 'verified', width: 100, align: 'center',
      render: (_, r) => `${r.rows.filter((x) => x.verified).length} / ${r.rows.length}`,
    },
    { title: 'Status', dataIndex: 'status', width: 110, render: (v) => <CuttingStatusTag status={v} /> },
    {
      title: 'Actions', key: 'act', width: 90, fixed: 'right', align: 'center',
      render: (_, r) => <ActionButton action="edit" size="small" onClick={() => navigate(`/production/cutting/panel-check/${r.id}`)} />,
    },
  ], [poNo, navigate]);

  const returnColumns = useMemo(() => [
    { title: 'Return DC #', dataIndex: 'returnDcNo', width: 170, render: (v) => <code>{v}</code> },
    { title: 'Cut PO', dataIndex: 'cutPoId', width: 150, render: poNo },
    { title: 'Date', dataIndex: 'date', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    {
      title: 'Returned', key: 'ret', width: 100, align: 'center',
      render: (_, r) => <strong>{r.lines.reduce((s, l) => s + l.returnQty, 0)}</strong>,
    },
    {
      title: 'Outstanding', key: 'diff', width: 110, align: 'center',
      render: (_, r) => {
        const diff = r.lines.reduce((s, l) => s + (l.issuedQty - l.returnQty), 0);
        return diff > 0 ? <span style={{ color: 'var(--error-color)', fontWeight: 600 }}>{diff}</span> : 0;
      },
    },
    { title: 'Status', dataIndex: 'status', width: 110, render: (v) => <CuttingStatusTag status={v} /> },
  ], [poNo]);

  const tables = {
    'Panel Issues': { columns: issueColumns, data: issues, empty: 'No panels issued to external processes yet' },
    'Panel Checks': { columns: checkColumns, data: checks, empty: 'No post-process panel checks yet' },
    'Return DCs': { columns: returnColumns, data: returns, empty: 'No return delivery challans yet' },
  };
  const active = tables[view];

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <Segmented options={Object.keys(tables)} value={view} onChange={setView} />
        <Space>
          <ActionButton action="create" text="Issue Panels" onClick={() => setIssueOpen(true)} />
          <ActionButton action="create" text="Panel Check" onClick={() => navigate('/production/cutting/panel-check/new')} />
          <ActionButton action="create" text="Return DC" onClick={() => setReturnOpen(true)} />
        </Space>
      </Space>
      <Table rowKey="id" size="small" columns={active.columns} dataSource={active.data} loading={loading}
        scroll={{ x: 1000 }} pagination={getTablePagination({ pageSize: 10 }, 'records')}
        locale={{ emptyText: <EmptyState title={active.empty} description="Panels must be checked (FR-09) before they re-enter bundling" /> }} />
      <PanelIssueDrawer open={issueOpen} cutPos={cutPos}
        onClose={() => setIssueOpen(false)} onSaved={() => { setIssueOpen(false); load(); }} />
      <ProcessReturnDrawer open={returnOpen} issues={issues} cutPos={cutPos}
        onClose={() => setReturnOpen(false)} onSaved={() => { setReturnOpen(false); load(); }} />
    </Card>
  );
};

export default ExternalProcessTab;
