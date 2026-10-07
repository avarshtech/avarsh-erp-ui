import { useEffect, useMemo, useState } from 'react';
import {
  App, Button, Card, Empty, Space, Table, Tag, Tooltip, Typography,
} from 'antd';
import { PrinterOutlined, SendOutlined } from '@ant-design/icons';
import SearchFilterBar from '../../../../../components/SearchFilterBar';
import useDebouncedSearch from '../../../../../hooks/useDebouncedSearch';
import { toastUnlessHandled } from '../../../../../utils/apiError';
import { hasPermission } from '../../../../../utils/permissions';
import { listInwardFilterOptions } from '../../../../../services/production/jobwork/jobWorkInwardApi';
import { cancelReturn, getReturnPrint, searchReturns } from '../../../../../services/production/jobwork/jobWorkPrincipalReturnApi';
import { buildReturnChallanHtml } from '../../../../../utils/jobWorkInward/inwardPrint';
import { RETURN_STATUS, TALLY_STATUS_LABEL, toOptions } from '../../../../../utils/jobWorkInward/inwardConstants';
import ReasonModal from '../../components/ReasonModal';
import { DocStatusTag, TallyTag } from '../components/InwardTags';
import { fmtDate, fmtMoney, fmtQty } from '../../jwFormat';

const { Text } = Typography;
const KEY = 'production-job-work';
const TALLY_OPTIONS = toOptions({ PENDING: TALLY_STATUS_LABEL.PENDING, RECORDED: TALLY_STATUS_LABEL.RECORDED });

/** Everything sent back to principals on our challans, with the job charges and their Tally status. */
const ReturnsTab = ({ refresh, actions }) => {
  const { message } = App.useApp();
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch(300);
  const [principalId, setPrincipalId] = useState();
  const [tally, setTally] = useState();
  const [rows, setRows] = useState([]);
  const [principals, setPrincipals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => { listInwardFilterOptions().then((o) => setPrincipals(o.principals)).catch(() => {}); }, [refresh]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const r = await searchReturns({ q: debouncedSearch, principalId, tally });
        if (alive) setRows(r);
      } catch (e) { toastUnlessHandled(message, e, 'Could not load returns.'); } finally { if (alive) setLoading(false); }
    };
    load();
    return () => { alive = false; };
  }, [debouncedSearch, principalId, tally, refresh, message]);

  const columns = useMemo(() => {
    const printChallan = async (id) => {
      try { const d = await getReturnPrint(id); actions.openPrint({ title: `Return challan — ${d.ret.ourChallanNo}`, html: buildReturnChallanHtml(d) }); } catch (e) { toastUnlessHandled(message, e); }
    };
    const canCancel = hasPermission(KEY, 'cancel');
    return [
      { title: 'Return', dataIndex: 'returnNo', width: 160, render: (v, r) => <><Text strong style={{ fontSize: 12 }}>{v}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>{fmtDate(r.date)} · challan {r.ourChallanNo}</Text></> },
      { title: 'Principal', dataIndex: 'principalName', width: 180 },
      { title: 'Job order', dataIndex: 'orderNo', width: 170, render: (v, r) => <Button type="link" size="small" style={{ padding: 0 }} onClick={() => actions.openJobOrder(r.jobOrderId)}>{v} · {r.styleNo}</Button> },
      { title: 'Went back', key: 'what', width: 260, render: (_, r) => `${fmtQty(r.pieces)} good${r.rejectPieces ? ` · ${fmtQty(r.rejectPieces)} rejected` : ''}${r.lotCount ? ` · ${r.lotCount} material lines` : ''}${r.wasteKg ? ` · ${fmtQty(r.wasteKg)} kg waste` : ''}` },
      { title: 'Ship to', key: 'ship', width: 130, render: (_, r) => (r.shipTo ? <Tooltip title={`${r.shipTo.name}, ${r.shipTo.address} — their invoice ${r.shipTo.principalInvoiceNo}`}><Tag color="blue">Their customer</Tag></Tooltip> : <Text type="secondary">Principal</Text>) },
      { title: 'Job charges', key: 'ch', width: 120, align: 'right', render: (_, r) => fmtMoney(r.charge.total) },
      { title: 'Tally', key: 't', width: 170, render: (_, r) => (r.status === RETURN_STATUS.DISPATCHED ? <TallyTag tally={r.tally} overdue={r.overdue} /> : <DocStatusTag status={r.status} />) },
      {
        title: '', key: 'act', width: 170, fixed: 'right',
        render: (_, r) => (
          <Space size={4}>
            <Button size="small" icon={<PrinterOutlined />} onClick={() => printChallan(r.id)}>Challan</Button>
            {r.status === RETURN_STATUS.DISPATCHED && !r.tally && canCancel && <Button size="small" type="link" danger onClick={() => setCancelling(r)}>Cancel</Button>}
          </Space>
        ),
      },
    ];
  }, [actions, message]);

  return (
    <Card size="small">
      <SearchFilterBar
        searchText={searchText}
        onSearchChange={(e) => setSearchText(e.target ? e.target.value : e)}
        searchPlaceholder="Search return, our challan, order, style, principal, Tally invoice"
        filters={[
          { type: 'select', key: 'p', props: { placeholder: 'Principal', value: principalId, options: principals, onChange: setPrincipalId } },
          { type: 'select', key: 't', span: { lg: 4 }, props: { placeholder: 'Tally', value: tally, options: TALLY_OPTIONS, onChange: setTally } },
        ]}
        extra={<Button type="primary" icon={<SendOutlined />} disabled={!hasPermission(KEY, 'receive')} onClick={() => actions.newReturn(null)}>Return to principal</Button>}
        style={{ marginBottom: 12 }}
      />
      <Table rowKey="id" size="middle" loading={loading} columns={columns} dataSource={rows} scroll={{ x: 1530, y: 'calc(100vh - 380px)' }}
        pagination={{ pageSize: 25, showSizeChanger: false, hideOnSinglePage: true }} locale={{ emptyText: <Empty description="Nothing returned to principals yet." /> }} />
      {cancelling && (
        <ReasonModal title={`Cancel ${cancelling.returnNo}`} okText="Cancel return" placeholder="Why is the return cancelled?"
          onSubmit={async (reason) => { await cancelReturn(cancelling.id, { reason }); message.success(`${cancelling.returnNo} cancelled; its material and waste are on hand again.`); actions.changed(); }}
          onClose={() => setCancelling(null)} />
      )}
    </Card>
  );
};

export default ReturnsTab;
