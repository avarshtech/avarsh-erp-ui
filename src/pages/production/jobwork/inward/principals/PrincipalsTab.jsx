import { useEffect, useMemo, useState } from 'react';
import {
  App, Button, Card, Empty, Table, Tag, Typography,
} from 'antd';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { listPrincipals } from '../../../../../services/production/jobwork/jobWorkInwardApi';
import { toastUnlessHandled } from '../../../../../utils/apiError';
import { hasPermission } from '../../../../../utils/permissions';
import { WASTE_RULE_LABEL } from '../../../../../utils/jobWorkInward/inwardConstants';
import { AgeTag } from '../components/InwardTags';
import { fmtDate, fmtQty } from '../../jwFormat';

const { Text } = Typography;

/** The companies we do job work for, with what of theirs is with us and what is not yet billed. */
const PrincipalsTab = ({ refresh, actions }) => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const r = await listPrincipals();
        if (alive) setRows(r);
      } catch (e) { toastUnlessHandled(message, e, 'Could not load principals.'); } finally { if (alive) setLoading(false); }
    };
    load();
    return () => { alive = false; };
  }, [refresh, message]);

  const columns = useMemo(() => [
    { title: 'Principal', dataIndex: 'name', width: 220, render: (v, p) => <><Text strong>{v}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{p.city} · {p.contactPerson} {p.phone}</Text></> },
    { title: 'GSTIN', dataIndex: 'gstin', width: 190, render: (v) => (v ? <><Text style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>{v}</Text> <Tag color="green">Registered</Tag></> : <Tag color="orange">Unregistered</Tag>) },
    { title: 'State', key: 'st', width: 160, render: (_, p) => <>{p.stateName} ({p.stateCode}){p.interState && <Tag style={{ marginLeft: 6 }}>IGST</Tag>}</> },
    { title: 'Cutting waste', dataIndex: 'wasteRule', width: 190, render: (v) => WASTE_RULE_LABEL[v] },
    { title: 'Weight tolerance', dataIndex: 'weightTolerancePct', width: 120, align: 'right', render: (v) => `${v}%` },
    { title: 'Open orders', dataIndex: 'openOrders', width: 100, align: 'right' },
    { title: 'Theirs in store', dataIndex: 'heldByUom', width: 190, render: (list) => (list.length ? list.map((x) => `${fmtQty(x.qty)} ${x.uom}`).join(' · ') : '—') },
    { title: 'Oldest', dataIndex: 'ageLevel', width: 110, render: (v) => <AgeTag level={v} /> },
    { title: 'Not in Tally', dataIndex: 'unbilled', width: 100, align: 'right', render: (v) => (v ? <Tag color="orange">{v} returns</Tag> : '—') },
    { title: 'Last return', dataIndex: 'lastReturn', width: 120, render: fmtDate },
    { title: '', key: 'e', width: 80, fixed: 'right', render: (_, p) => <Button size="small" icon={<EditOutlined />} disabled={!hasPermission('production-job-work', 'add')} onClick={() => actions.editPrincipal(p)}>Edit</Button> },
  ], [actions]);

  return (
    <Card size="small" title="Companies we do job work for" extra={<Button type="primary" icon={<PlusOutlined />} disabled={!hasPermission('production-job-work', 'add')} onClick={() => actions.editPrincipal(null)}>Add principal</Button>}>
      <Table rowKey="id" size="middle" loading={loading} columns={columns} dataSource={rows} scroll={{ x: 1580 }} pagination={false}
        locale={{ emptyText: <Empty description="No principals yet." /> }} />
    </Card>
  );
};

export default PrincipalsTab;
