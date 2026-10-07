import { useEffect, useMemo, useState } from 'react';
import {
  App, Button, Card, Empty, Space, Table, Tag, Typography,
} from 'antd';
import { GiftOutlined, RollbackOutlined } from '@ant-design/icons';
import SearchFilterBar from '../../../../components/SearchFilterBar';
import useDebouncedSearch from '../../../../hooks/useDebouncedSearch';
import { toastUnlessHandled } from '../../../../utils/apiError';
import { hasPermission } from '../../../../utils/permissions';
import { getJobMaterials, listMaterialJobs } from '../../../../services/production/jobwork/jobWorkMaterialsApi';
import { listFilterOptions } from '../../../../services/production/jobwork/jobWorkTrackerApi';
import { ISSUE_CATEGORY, ISSUE_CATEGORY_LABEL, MATERIAL_KIND_LABEL } from '../../../../utils/jobWorkTracker/constants';
import JobMaterialsCard from '../tracker/JobMaterialsCard';
import VendorReturnDrawer from '../pullback/VendorReturnDrawer';
import PackingIssueDrawer from './PackingIssueDrawer';
import { fmtQty } from '../jwFormat';

const { Text } = Typography;
const AWAITING = [ISSUE_CATEGORY.AWAITING_FABRIC, ISSUE_CATEGORY.AWAITING_TRIMS, ISSUE_CATEGORY.AWAITING_PACKING];
const KEY = 'production-job-work';

/** One job's issue lines, loaded when its row is expanded. */
const JobMaterialRows = ({ jobId, refresh }) => {
  const [rows, setRows] = useState(null);
  useEffect(() => { getJobMaterials(jobId).then((m) => setRows(m.rows)).catch(() => setRows([])); }, [jobId, refresh]);
  return <JobMaterialsCard rows={rows || []} loading={rows === null} />;
};

/** What each open job's vendor holds of our fabric, trims and packing; issue packing or take material back. */
const MaterialsTab = ({ refresh, actions }) => {
  const { message } = App.useApp();
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch(300);
  const [vendorId, setVendorId] = useState();
  const [vendors, setVendors] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [packingFor, setPackingFor] = useState(undefined);
  const [returnFor, setReturnFor] = useState(null);

  useEffect(() => { listFilterOptions().then((o) => setVendors(o.vendors)).catch(() => {}); }, []);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const r = await listMaterialJobs({ q: debouncedSearch, vendorId });
        if (alive) setRows(r);
      } catch (e) { toastUnlessHandled(message, e, 'Could not load materials.'); } finally { if (alive) setLoading(false); }
    };
    load();
    return () => { alive = false; };
  }, [debouncedSearch, vendorId, refresh, message]);

  const canIssue = hasPermission(KEY, 'add');
  const canReturn = hasPermission(KEY, 'receive');
  const columns = useMemo(() => [
    { title: 'Job', dataIndex: 'jobNo', width: 170, render: (v, r) => <Button type="link" size="small" style={{ padding: 0 }} onClick={() => actions.openJob(r.jobId)}>{v}</Button> },
    { title: 'Vendor', dataIndex: 'vendorName', width: 190 },
    { title: 'Order / style', key: 'os', width: 190, render: (_, r) => `${r.orderNo} · ${r.styleNo}` },
    {
      title: 'Sent', key: 'kinds', width: 230,
      render: (_, r) => <Space size={4} wrap>{r.kinds.map((k) => <Tag key={k.kind} color={k.items ? 'blue' : 'default'}>{MATERIAL_KIND_LABEL[k.kind]} {k.items}</Tag>)}</Space>,
    },
    { title: 'Still at vendor', key: 'at', width: 200, render: (_, r) => Object.entries(r.atVendorByUom).map(([u, q]) => `${fmtQty(q)} ${u}`).join(' · ') || '—' },
    { title: 'Waiting on', dataIndex: 'latestIssue', width: 200, render: (i) => (AWAITING.includes(i) ? <Tag color="orange">{ISSUE_CATEGORY_LABEL[i]}</Tag> : <Text type="secondary">—</Text>) },
    {
      title: '', key: 'act', width: 275, fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          {r.packs && <Button size="small" icon={<GiftOutlined />} disabled={!canIssue} onClick={() => setPackingFor(r.jobId)}>Issue packing</Button>}
          <Button size="small" icon={<RollbackOutlined />} disabled={!canReturn} onClick={() => setReturnFor(r)}>Vendor return</Button>
        </Space>
      ),
    },
  ], [actions, canIssue, canReturn]);

  return (
    <Card size="small">
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Fabric, trims and packing are free-issue: we send our own material and the vendor charges labour only. At integration these forms
        move to Material Issue (Packing, Vendor Returns).
      </Text>
      <SearchFilterBar
        searchText={searchText}
        onSearchChange={(e) => setSearchText(e.target ? e.target.value : e)}
        searchPlaceholder="Search job, vendor, order, style"
        filters={[{ type: 'select', key: 'v', props: { placeholder: 'Vendor', value: vendorId, options: vendors, onChange: setVendorId } }]}
        extra={<Button type="primary" icon={<GiftOutlined />} disabled={!canIssue} onClick={() => setPackingFor(null)}>Issue packing</Button>}
        style={{ marginBottom: 12 }}
      />
      <Table
        rowKey="jobId"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={rows}
        expandable={{ expandedRowRender: (r) => <JobMaterialRows jobId={r.jobId} refresh={refresh} /> }}
        scroll={{ x: 1505 }}
        pagination={{ pageSize: 25, showSizeChanger: false, hideOnSinglePage: true }}
        locale={{ emptyText: <Empty description="No open jobs." /> }}
      />
      {packingFor !== undefined && <PackingIssueDrawer jobId={packingFor} onClose={() => setPackingFor(undefined)} onSaved={actions.changed} />}
      {returnFor && (
        <VendorReturnDrawer jobId={returnFor.jobId} title={`Vendor material return — ${returnFor.jobNo} · ${returnFor.vendorName}`}
          onClose={() => setReturnFor(null)} onSaved={actions.changed} />
      )}
    </Card>
  );
};

export default MaterialsTab;
